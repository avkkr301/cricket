import axios from 'axios';

const CRICAPI_BASE = 'https://api.cricapi.com/v1';
const API_KEY = process.env.CRICAPI_KEY;

const cricapiClient = axios.create({ baseURL: CRICAPI_BASE });

// Normalised match shape shared with Sportmonks
export type CricAPIMatch = {
  id: string;
  source: 'cricapi';
  localteam:   { name: string; code: string };
  visitorteam: { name: string; code: string };
  note: string;
  status: string;
  starting_at?: string;
  score?: string;
  winnerTeam?: string;
  matchType?: string; // 't20' | 'odi' | 'test' | 't10' etc.
};

type RawCricScore = {
  id: string;
  t1: string; t1s: string; t1img: string;
  t2: string; t2s: string; t2img: string;
  ms: 'live' | 'fixture' | 'result';
  series: string;
  matchType?: string;
  t1score?: string;
  t2score?: string;
};

function mapStatus(ms: string): string {
  if (ms === 'live')    return 'Inprogress';
  if (ms === 'fixture') return 'NS';
  return 'Finished';
}

function normalise(raw: RawCricScore): CricAPIMatch {
  return {
    id:          `cric-${raw.id}`,
    source:      'cricapi',
    localteam:   { name: raw.t1 || 'Team 1', code: raw.t1s || 'T1' },
    visitorteam: { name: raw.t2 || 'Team 2', code: raw.t2s || 'T2' },
    note:          raw.series || '',
    status:      mapStatus(raw.ms),
    score:       raw.t1score && raw.t2score ? `${raw.t1}: ${raw.t1score} | ${raw.t2}: ${raw.t2score}` : undefined,
    matchType:   raw.matchType?.toLowerCase(),
  };
}

export const cricapiService = {
  async getAllMatches(): Promise<CricAPIMatch[]> {
    if (!API_KEY) return [];
    try {
      const res = await cricapiClient.get('/cricScore', {
        params: { apikey: API_KEY },
      });
      const raw: RawCricScore[] = res.data.data || [];
      return raw
        .map(normalise)
        .filter(m => m.status !== 'Finished');
    } catch (err: any) {
      console.error('CricAPI getAllMatches error:', err.response?.data || err.message);
      return [];
    }
  },

  /** Only live (in-progress) */
  async getLiveMatches(): Promise<CricAPIMatch[]> {
    const all = await this.getAllMatches();
    return all.filter(m => m.status === 'Inprogress');
  },

  /** Fixture (not started) matches */
  async getUpcomingMatches(): Promise<CricAPIMatch[]> {
    const all = await this.getAllMatches();
    return all.filter(m => m.status === 'NS');
  },

  /** Single match detail via match_info */
  async getMatchDetail(rawId: string): Promise<CricAPIMatch | null> {
    if (!API_KEY) return null;
    try {
      const res = await cricapiClient.get('/match_info', {
        params: { apikey: API_KEY, id: rawId },
      });
      const d = res.data.data;
      if (!d) return null;
      return {
        id:          `cric-${d.id}`,
        source:      'cricapi',
        localteam:   { name: d.teamInfo?.[0]?.name || d.teams?.[0] || 'Team 1', code: d.teamInfo?.[0]?.shortname || 'T1' },
        visitorteam: { name: d.teamInfo?.[1]?.name || d.teams?.[1] || 'Team 2', code: d.teamInfo?.[1]?.shortname || 'T2' },
        note:        d.series_id || '',
        status:      d.matchStarted && !d.matchEnded ? 'Inprogress' : d.matchEnded ? 'Finished' : 'NS',
        starting_at: d.dateTimeGMT,
        score:       d.score?.map((s: { inning: string; r: number; w: number; o: number }) => `${s.inning}: ${s.r}/${s.w} (${s.o} ov)`).join(' | '),
        winnerTeam: d.matchWinner || d.winner || d.winningTeam,
      };
    } catch (err: any) {
      console.error('CricAPI matchDetail error:', err.response?.data || err.message);
      return null;
    }
  },
};
