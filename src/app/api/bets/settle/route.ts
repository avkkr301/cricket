import { NextResponse } from 'next/server';
import { settleMatchBets } from '@/lib/bets/settle';

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

    const { settled, wonCount, lostCount } = await settleMatchBets(matchId, winnerTeam);

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
