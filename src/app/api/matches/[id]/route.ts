import { NextResponse } from 'next/server';
import { sportmonksService } from '@/services/sportmonks';
import { cricapiService } from '@/services/cricapi';
import { entitySportService } from '@/services/entitysport';

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;

    // CricAPI IDs are prefixed with "cric-"
    if (id.startsWith('cric-')) {
      const rawId = id.replace('cric-', '');
      const match = await cricapiService.getMatchDetail(rawId);
      if (!match) return NextResponse.json({ error: 'Match not found' }, { status: 404 });
      return NextResponse.json({ data: match });
    }

    if (id.startsWith('ent-')) {
      const match = await entitySportService.getMatchDetail(id.replace('ent-', ''));
      if (!match) return NextResponse.json({ error: 'Match not found' }, { status: 404 });
      return NextResponse.json({ data: match });
    }

    // Otherwise use Sportmonks. Some plans return an error for the fixture
    // detail endpoint even though the fixture is available in the live/feed
    // response, so fall back to those normalized records.
    try {
      const data = await sportmonksService.getFixture(id);
      return NextResponse.json(data);
    } catch (detailError) {
      const [liveResult, upcomingResult] = await Promise.allSettled([
        sportmonksService.getLiveMatches(),
        sportmonksService.getUpcomingMatches(),
      ]);
      const fallbackMatches = [
        ...(liveResult.status === 'fulfilled' ? liveResult.value?.data || [] : []),
        ...(upcomingResult.status === 'fulfilled' ? upcomingResult.value?.data || [] : []),
      ];
      const fallbackMatch = fallbackMatches.find((match: { id?: number | string }) => String(match.id) === id);

      if (fallbackMatch) {
        return NextResponse.json({ data: fallbackMatch });
      }

      throw detailError;
    }
  } catch (error: unknown) {
    return NextResponse.json({ error: error instanceof Error ? error.message : 'Unable to load match' }, { status: 500 });
  }
}
