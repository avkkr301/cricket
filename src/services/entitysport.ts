import axios from 'axios';

const ENTITYSPORT_BASE_URL = process.env.ENTITYSPORT_BASE_URL || 'https://rest.entitysport.com/v2';
const API_TOKEN = process.env.ENTITYSPORT_API_TOKEN;

const entitySportClient = axios.create({
  baseURL: ENTITYSPORT_BASE_URL,
  timeout: 10000,
});

type EntityTeam = { team_id?: number; name?: string; short_name?: string; logo_url?: string };

type EntityMatch = {
  match_id?: number;
  title?: string;
  short_title?: string;
  date_start?: string;
  date_end?: string;
  status?: number;
  status_str?: string;
  match_status?: string;
  competition?: { title?: string; abbreviation?: string };
  teama?: EntityTeam;
  teamb?: EntityTeam;
  score?: string;
  winning_team?: string;
  winner_team?: string;
  winning_team_id?: number;
  result?: string;
  venue?: { name?: string };
  balls?: unknown[];
};

export type EntitySportMatch = {
  id: string;
  source: 'entitysport';
  localteam: { name: string; code: string };
  visitorteam: { name: string; code: string };
  note: string;
  status: string;
  starting_at?: string;
  score?: string;
  winnerTeam?: string;
  matchType?: string;
  balls?: unknown[];
};

function mapStatus(raw: EntityMatch): string {
  const status = String(raw.status_str || raw.match_status || '').toLowerCase();
  if (status.includes('live') || status.includes('in progress')) return 'Inprogress';
  if (status.includes('complete') || status.includes('result') || status.includes('finished')) return 'Finished';
  if (raw.status === 3) return 'Finished';
  if (raw.status === 2) return 'Inprogress';
  return 'NS';
}

function normalise(raw: EntityMatch): EntitySportMatch {
  const home = raw.teama || {};
  const away = raw.teamb || {};
  const resultText = String(raw.winning_team || raw.winner_team || raw.result || '');
  const winningTeam = raw.winning_team_id === home.team_id
    ? home.name
    : raw.winning_team_id === away.team_id
      ? away.name
      : resultText.toLowerCase().includes(String(home.name || '').toLowerCase())
        ? home.name
        : resultText.toLowerCase().includes(String(away.name || '').toLowerCase())
          ? away.name
          : undefined;
  return {
    id: `ent-${raw.match_id}`,
    source: 'entitysport',
    localteam: { name: home.name || 'Team 1', code: home.short_name || 'T1' },
    visitorteam: { name: away.name || 'Team 2', code: away.short_name || 'T2' },
    note: raw.competition?.title || raw.title || '',
    status: mapStatus(raw),
    starting_at: raw.date_start,
    score: raw.score,
    winnerTeam: winningTeam,
    matchType: raw.competition?.abbreviation?.toLowerCase(),
    balls: raw.balls,
  };
}

function withToken(params: Record<string, string | number> = {}) {
  return { ...params, token: API_TOKEN };
}

async function getMatches(params: Record<string, string | number>) {
  if (!API_TOKEN) return [];
  const response = await entitySportClient.get('/matches/', { params: withToken(params) });
  const matches = (response.data?.response?.items || response.data?.response || []) as EntityMatch[];
  return Array.isArray(matches) ? matches.map(normalise) : [];
}

export const entitySportService = {
  async getLiveMatches(): Promise<EntitySportMatch[]> {
    return getMatches({ status: 2 });
  },

  async getUpcomingMatches(): Promise<EntitySportMatch[]> {
    const start = new Date();
    const dates = Array.from({ length: 7 }, (_, index) => {
      const date = new Date(start);
      date.setDate(start.getDate() + index);
      return date.toISOString().slice(0, 10);
    });
    const matches = await Promise.all(dates.map((date) => getMatches({ status: 1, date })));
    const unique = new Map<string, EntitySportMatch>();
    matches.flat().forEach((match) => unique.set(match.id, match));
    return [...unique.values()];
  },

  async getMatchDetail(id: string): Promise<EntitySportMatch | null> {
    if (!API_TOKEN) return null;
    const response = await entitySportClient.get(`/matches/${id}`, { params: withToken() });
    const raw = response.data?.response?.items?.[0] || response.data?.response;
    return raw ? normalise(raw as EntityMatch) : null;
  },

  async getMatchOdds(id: string) {
    if (!API_TOKEN) return null;
    const response = await entitySportClient.get(`/matches/${id}/odds`, { params: withToken() });
    return response.data;
  },
};
