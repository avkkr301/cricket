import { NextResponse } from 'next/server';
import { adminDb } from '@/lib/firebase/admin';

/**
 * Settles pending bets one at a time in a transaction. The status check and
 * wallet credit are atomic, so retries cannot pay the same bet twice.
 */
export async function POST(req: Request) {
  try {
    const { matchId, winnerTeam } = await req.json();

    if (typeof matchId !== 'string' || !matchId || typeof winnerTeam !== 'string' || !winnerTeam.trim()) {
      return NextResponse.json({ error: 'matchId and winnerTeam required' }, { status: 400 });
    }

    const betsSnap = await adminDb
      .collection('bets')
      .where('matchId', '==', matchId)
      .where('status', '==', 'PENDING')
      .get();

    let settled = 0;
    let wonCount = 0;
    let lostCount = 0;

    for (const betDoc of betsSnap.docs) {
      const betRef = adminDb.collection('bets').doc(betDoc.id);
      const outcome = await adminDb.runTransaction(async (transaction) => {
        const freshBet = await transaction.get(betRef);
        if (!freshBet.exists || freshBet.data()?.status !== 'PENDING') return null;

        const bet = freshBet.data()!;
        const isBackBet = bet.selection?.startsWith('LAGAI');
        const selectionTeam = bet.selection?.replace(/^(LAGAI|KHAI) - /, '').split(' (')[0].trim();
        const userWon = isBackBet && selectionTeam === winnerTeam.trim();
        const settledAt = new Date();

        if (!userWon) {
          transaction.update(betRef, { status: 'LOST', settledAt, winnings: 0 });
          return 'LOST';
        }

        const winnings = Number((Number(bet.amount) * Number(bet.odds)).toFixed(2));
        const userRef = adminDb.collection('users').doc(bet.userId);
        const userDoc = await transaction.get(userRef);
        if (!userDoc.exists) throw new Error(`User ${bet.userId} does not exist.`);

        const currentBalance = Number(userDoc.data()?.walletBalance) || 0;
        transaction.update(userRef, { walletBalance: currentBalance + winnings });
        transaction.set(adminDb.collection('transactions').doc(), {
          senderId: 'SYSTEM',
          receiverId: bet.userId,
          amount: winnings,
          type: 'WIN_REWARD',
          note: `Won bet on ${selectionTeam} - Match ${matchId}`,
          betId: betDoc.id,
          timestamp: settledAt,
        });
        transaction.update(betRef, { status: 'WON', settledAt, winnings });
        return 'WON';
      });

      if (outcome === 'WON') wonCount++;
      if (outcome === 'LOST') lostCount++;
      if (outcome) settled++;
    }

    return NextResponse.json({
      success: true,
      message: `Settled ${settled} bets. Won: ${wonCount}, Lost: ${lostCount}`,
      settled,
      wonCount,
      lostCount,
    });
  } catch (error) {
    console.error('Settle Error:', error);
    return NextResponse.json({ error: error instanceof Error ? error.message : 'Unable to settle bets' }, { status: 500 });
  }
}
