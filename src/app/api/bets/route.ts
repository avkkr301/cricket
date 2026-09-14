import { NextResponse } from 'next/server';
import { adminDb } from '@/lib/firebase/admin';
import { entitySportService } from '@/services/entitysport';
import { cricapiService } from '@/services/cricapi';
import { sportmonksService } from '@/services/sportmonks';
import { settleMatchBets } from '@/lib/bets/settle';

async function getMatchResult(matchId: string): Promise<{ finished: boolean; winnerTeam?: string }> {
  if (matchId.startsWith('ent-')) {
    const match = await entitySportService.getMatchDetail(matchId.slice(4));
    return { finished: match?.status === 'Finished', winnerTeam: match?.winnerTeam };
  }
  if (matchId.startsWith('cric-')) {
    const match = await cricapiService.getMatchDetail(matchId.slice(5));
    return { finished: match?.status === 'Finished', winnerTeam: match?.winnerTeam };
  }
  if (/^\d+$/.test(matchId)) return sportmonksService.getSettlementResult(matchId);
  return { finished: false };
}

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const matchId = searchParams.get('matchId');
    const userId = searchParams.get('userId');
    const role = searchParams.get('role') || 'USER';

    if (!userId) {
      return NextResponse.json({ error: 'Missing parameters' }, { status: 400 });
    }

    let betDocs;
    if (role === 'ADMIN') {
      betDocs = (await adminDb.collection('bets').get()).docs;
    } else if (role === 'MANAGER') {
      const usersSnap = await adminDb.collection('users').where('parentId', '==', userId).get();
      const networkIds = [userId, ...usersSnap.docs.map((doc) => doc.id)];
      const chunks = Array.from({ length: Math.ceil(networkIds.length / 30) }, (_, index) =>
        networkIds.slice(index * 30, index * 30 + 30)
      );
      const snapshots = await Promise.all(chunks.map((ids) => adminDb.collection('bets').where('userId', 'in', ids).get()));
      const docs = snapshots.flatMap((snapshot) => snapshot.docs);
      betDocs = docs;
    } else {
      betDocs = (await adminDb.collection('bets').where('userId', '==', userId).get()).docs;
    }

    // Settlement is server-triggered when bet history is requested, so users
    // do not need to keep the match detail page open.
    const pendingMatchIds = [...new Set(
      betDocs
        .filter((doc) => doc.data().status === 'PENDING')
        .map((doc) => String(doc.data().matchId ?? ''))
        .filter(Boolean),
    )];

    await Promise.allSettled(pendingMatchIds.map(async (pendingMatchId) => {
      const result = await getMatchResult(pendingMatchId);
      if (result.finished && result.winnerTeam) {
        await settleMatchBets(pendingMatchId, result.winnerTeam);
      }
    }));

    await Promise.allSettled(betDocs
      .filter((doc) => doc.data().status !== 'PENDING' && !doc.data().winnerTeam)
      .map(async (doc) => {
        const matchId = String(doc.data().matchId ?? '');
        const result = await getMatchResult(matchId);
        if (result.finished && result.winnerTeam) {
          await adminDb.collection('bets').doc(doc.id).update({ winnerTeam: result.winnerTeam });
        }
      }));

    // Re-read after settlement so this response immediately reflects WON/LOST.
    if (pendingMatchIds.length > 0) {
      const refreshed = role === 'ADMIN'
        ? (await adminDb.collection('bets').get()).docs
        : role === 'USER'
          ? (await adminDb.collection('bets').where('userId', '==', userId).get()).docs
          : betDocs;
      if (role !== 'MANAGER') betDocs = refreshed;
    }

    const bets = betDocs
      .map((doc) => {
        const data = doc.data();
        const placedAt = data.placedAt ?? data.createdAt;
        return {
          id: doc.id,
          matchId: String(data.matchId ?? ''),
          ...data,
          placedAt: placedAt?.toDate?.()?.toISOString() ?? (placedAt instanceof Date ? placedAt.toISOString() : null),
        };
      })
      .filter((bet) => !matchId || bet.matchId === matchId)
      .sort((a, b) => (b.placedAt ?? '').localeCompare(a.placedAt ?? ''));

    return NextResponse.json({ bets });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : 'Unable to load bets' }, { status: 500 });
  }
}
