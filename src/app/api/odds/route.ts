import { NextResponse } from 'next/server';
import { oddsApiService } from '@/services/oddsapi';

/**
 * GET /api/odds?home=TeamA&away=TeamB
 * Returns real Lagai/Khai odds from The Odds API bookmakers.
 */
export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const home = searchParams.get('home') || '';
    const away = searchParams.get('away') || '';

    if (!home || !away) {
      return NextResponse.json({ error: 'home and away params required' }, { status: 400 });
    }

    const match = await oddsApiService.getOddsForMatch(home, away);
    if (!match) {
      return NextResponse.json({ found: false, odds: null });
    }

    const odds = oddsApiService.extractH2H(match);
    return NextResponse.json({ found: true, odds, raw: match });
  } catch (error: unknown) {
    return NextResponse.json({ error: error instanceof Error ? error.message : 'Unable to load odds' }, { status: 500 });
  }
}
