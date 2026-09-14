import axios from 'axios';

const BASE = 'https://api.the-odds-api.com/v4';
const API_KEY = process.env.ODDS_API_KEY;

// All cricket sport keys available on this plan
const CRICKET_SPORTS = [
  'cricket_caribbean_premier_league',
  'cricket_international_t20',
  'cricket_odi',
];

export type OddsOutcome = {
  name: string;
  price: number; // decimal odds
};

export type OddsMatch = {
  id: string;
  sport_key: string;
  sport_title: string;
  commence_time: string;
  home_team: string;
  away_team: string;
  bookmakers: Array<{
    key: string;
    title: string;
    markets: Array<{
      key: string;
      outcomes: OddsOutcome[];
    }>;
  }>;
};

// Cache odds for 60s to avoid burning quota
const cache: { data: OddsMatch[]; fetchedAt: number } = { data: [], fetchedAt: 0 };
const CACHE_TTL_MS = 60_000;

export const oddsApiService = {
  async getAllCricketOdds(): Promise<OddsMatch[]> {
    if (!API_KEY) return [];

    // Return cached data if fresh
    if (Date.now() - cache.fetchedAt < CACHE_TTL_MS && cache.data.length > 0) {
      return cache.data;
    }

    try {
      const results = await Promise.allSettled(
        CRICKET_SPORTS.map(sport =>
          axios.get<OddsMatch[]>(`${BASE}/sports/${sport}/odds/`, {
            params: {
              apiKey: API_KEY,
              regions: 'uk',
              markets: 'h2h',
              oddsFormat: 'decimal',
            },
          }).then(r => r.data)
        )
      );

      const all: OddsMatch[] = [];
      results.forEach(r => {
        if (r.status === 'fulfilled') all.push(...r.value);
      });

      cache.data = all;
      cache.fetchedAt = Date.now();
      return all;
    } catch (err: any) {
      console.error('OddsAPI error:', err.response?.data || err.message);
      return cache.data; // return stale cache on error
    }
  },

  /** Get odds for a specific match by matching team names */
  async getOddsForMatch(homeTeam: string, awayTeam: string): Promise<OddsMatch | null> {
    const all = await this.getAllCricketOdds();
    const normalize = (s: string) => s.toLowerCase().replace(/[^a-z]/g, '');
    const h = normalize(homeTeam);
    const a = normalize(awayTeam);
    return (
      all.find(m => {
        const mh = normalize(m.home_team);
        const ma = normalize(m.away_team);
        return (mh.includes(h) || h.includes(mh)) && (ma.includes(a) || a.includes(ma));
      }) ?? null
    );
  },

  /** Build a simple back/lay odds object from bookmaker h2h market */
  extractH2H(match: OddsMatch): { home: { lagai: number; khai: number } | null; away: { lagai: number; khai: number } | null } {
    // Use first available bookmaker
    const bk = match.bookmakers?.[0];
    const market = bk?.markets?.find(m => m.key === 'h2h');
    if (!market) return { home: null, away: null };

    const homeOutcome = market.outcomes.find(o => o.name === match.home_team);
    const awayOutcome = market.outcomes.find(o => o.name === match.away_team);

    // Back (Lagai) = bookmaker price, Lay (Khai) = price + small spread
    return {
      home: homeOutcome ? { lagai: homeOutcome.price, khai: +(homeOutcome.price + 0.02).toFixed(2) } : null,
      away: awayOutcome ? { lagai: awayOutcome.price, khai: +(awayOutcome.price + 0.02).toFixed(2) } : null,
    };
  },
};
