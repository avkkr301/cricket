import { NextResponse } from 'next/server';
import { sportmonksService } from '@/services/sportmonks';
import { cricapiService } from '@/services/cricapi';

export async function GET() {
  try {
    const [sportmonksData, cricapiMatches] = await Promise.allSettled([
      sportmonksService.getUpcomingMatches(),
      cricapiService.getUpcomingMatches(),
    ]);

    const sportmonks = sportmonksData.status === 'fulfilled' ? (sportmonksData.value?.data || []) : [];
    const cricapi    = cricapiMatches.status  === 'fulfilled' ? cricapiMatches.value : [];

    const taggedSportmonks = sportmonks.map((m: object) => ({ ...m, source: 'sportmonks' }));

    const combined = [...taggedSportmonks, ...cricapi];

    return NextResponse.json({ data: combined, total: combined.length });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
