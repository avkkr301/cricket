import { adminDb } from '@/lib/firebase/admin';
import { calculateBet, roundMoney } from './math';

export type SettlementSummary = {
  settled: number;
  wonCount: number;
  lostCount: number;
};

function normaliseTeam(value: string): string {
  return value.toLowerCase().replace(/[^a-z0-9]/g, '');
}

function getSelection(selection: string): { team: string; isBack: boolean } {
  const match = selection.match(/^(?:LAGAI|BACK|WIN|KHAI|LAY|LOSE)\s*-\s*/i);
  const isBack = Boolean(match && /^(?:LAGAI|BACK|WIN)\b/i.test(selection));
  return {
    team: selection.replace(/^(?:LAGAI|BACK|WIN|KHAI|LAY|LOSE)\s*-\s*/i, '').split(' (')[0].trim(),
    isBack,
  };
}

export async function settleMatchBets(matchId: string, winnerTeam: string): Promise<SettlementSummary> {
  const betsSnap = await adminDb.collection('bets')
    .where('matchId', '==', matchId)
    .where('status', '==', 'PENDING')
    .get();

  const winner = normaliseTeam(winnerTeam);
  const summary: SettlementSummary = { settled: 0, wonCount: 0, lostCount: 0 };

  for (const betDoc of betsSnap.docs) {
    const outcome = await adminDb.runTransaction(async (transaction) => {
      const betRef = adminDb.collection('bets').doc(betDoc.id);
      const freshBet = await transaction.get(betRef);
      if (!freshBet.exists || freshBet.data()?.status !== 'PENDING') return null;

      const bet = freshBet.data()!;
      const selection = getSelection(String(bet.selection || ''));
      const selectionTeam = normaliseTeam(selection.team);
      const selectedTeamWon = selectionTeam === winner || selectionTeam.includes(winner) || winner.includes(selectionTeam);
      const userWon = selection.isBack ? selectedTeamWon : !selectedTeamWon;
      const settledAt = new Date();

      if (!userWon) {
        transaction.update(betRef, { status: 'LOST', settledAt, winnings: 0, winnerTeam });
        return 'LOST' as const;
      }

      const betType = bet.type === 'KHAI' || !selection.isBack ? 'KHAI' : 'LAGAI';
      const market = bet.market === 'BOOKMAKER' || bet.market === 'SESSION'
        ? bet.market
        : Number(bet.odds) > 10 ? 'BOOKMAKER' : 'MATCH_ODDS';
      const winnings = roundMoney(calculateBet(
        Number(bet.amount),
        Number(bet.odds),
        betType,
        market,
      ).returnAmount);
      const userRef = adminDb.collection('users').doc(String(bet.userId));
      const userDoc = await transaction.get(userRef);
      if (!userDoc.exists) throw new Error(`User ${bet.userId} does not exist.`);

      const currentBalance = roundMoney(Number(userDoc.data()?.walletBalance) || 0);
      transaction.update(userRef, { walletBalance: roundMoney(currentBalance + winnings) });
      transaction.set(adminDb.collection('transactions').doc(), {
        senderId: 'SYSTEM',
        receiverId: bet.userId,
        amount: winnings,
        type: 'WIN_REWARD',
        note: `Won bet on ${selection.team} - Match ${matchId}`,
        betId: betDoc.id,
        timestamp: settledAt,
      });
      transaction.update(betRef, { status: 'WON', settledAt, winnings, winnerTeam });
      return 'WON' as const;
    });

    if (outcome) {
      summary.settled++;
      if (outcome === 'WON') summary.wonCount++;
      else summary.lostCount++;
    }
  }

  return summary;
}
