import { NextResponse } from 'next/server';
import { adminDb } from '@/lib/firebase/admin';

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const matchId = searchParams.get('matchId');
    const userId = searchParams.get('userId');

    if (!userId) {
      return NextResponse.json({ error: 'Missing parameters' }, { status: 400 });
    }

    const betsSnap = await adminDb.collection('bets').where('userId', '==', userId).get();

    const bets = betsSnap.docs
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
