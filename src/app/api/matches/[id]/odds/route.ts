import { NextResponse } from 'next/server';
import { sportmonksService } from '@/services/sportmonks';
import { entitySportService } from '@/services/entitysport';

export async function GET(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    if (id.startsWith('ent-')) {
      const data = await entitySportService.getMatchOdds(id.replace('ent-', ''));
      return NextResponse.json(data || { data: [] });
    }
    const data = await sportmonksService.getMatchOdds(id);
    return NextResponse.json(data);
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : 'Unable to load odds' }, { status: 500 });
  }
}
