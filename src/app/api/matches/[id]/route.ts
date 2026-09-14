import { NextResponse } from 'next/server';
import { sportmonksService } from '@/services/sportmonks';
import { cricapiService } from '@/services/cricapi';

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

    // Otherwise use Sportmonks
    const data = await sportmonksService.getFixture(id);
    return NextResponse.json(data);
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
