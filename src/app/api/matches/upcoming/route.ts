import { NextResponse } from 'next/server';
import { sportmonksService } from '@/services/sportmonks';
import { cricapiService } from '@/services/cricapi';
import { entitySportService } from '@/services/entitysport';

export async function GET() {
  try {
    const [sportmonksData, cricapiMatches, entitySportMatches] = await Promise.allSettled([
      sportmonksService.getUpcomingMatches(),
      cricapiService.getUpcomingMatches(),
      entitySportService.getUpcomingMatches(),
    ]);

    const sportmonks = sportmonksData.status === 'fulfilled' ? (sportmonksData.value?.data || []) : [];
    const cricapi    = cricapiMatches.status  === 'fulfilled' ? cricapiMatches.value : [];
    const entitysport = entitySportMatches.status === 'fulfilled' ? entitySportMatches.value : [];

    const taggedSportmonks = sportmonks.map((m: object) => ({ ...m, source: 'sportmonks' }));

    const combined = [...taggedSportmonks, ...cricapi, ...entitysport];

    return NextResponse.json({ data: combined, total: combined.length });
  } catch (error: unknown) {
    return NextResponse.json({ error: error instanceof Error ? error.message : 'Unable to load upcoming matches' }, { status: 500 });
  }
}
