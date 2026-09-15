import axios from 'axios';

const SPORTMONKS_BASE_URL = 'https://cricket.sportmonks.com/api/v2.0';
const API_TOKEN = process.env.SPORTMONKS_API_TOKEN;

const sportmonksClient = axios.create({
  baseURL: SPORTMONKS_BASE_URL,
  params: {
    api_token: API_TOKEN,
  },
});

export type SportmonksBall = Record<string, unknown>;

export const sportmonksService = {
  /**
   * Fetch live cricket matches (in-play)
   */
  async getLiveMatches() {
    try {
      const response = await sportmonksClient.get('/livescores', {
        params: {
          include: 'localteam,visitorteam,runs,scoreboards,balls',
        }
      });
      return response.data;
    } catch (error: unknown) {
      console.error('Sportmonks getLiveMatches Error:', axios.isAxiosError(error) ? error.response?.data : error instanceof Error ? error.message : error);
      throw new Error('Failed to fetch live matches');
    }
  },

  /**
   * Fetch upcoming cricket matches (fixtures)
   */
  async getUpcomingMatches() {
    try {
      const today = new Date();
      // Load a full week so the home tab can show at least five fixtures,
      // while still placing live matches ahead of upcoming ones.
      const endOfTomorrow = new Date(today);
      endOfTomorrow.setDate(today.getDate() + 7);

      const startDate = today.toISOString().split('T')[0];
      const endDate = endOfTomorrow.toISOString().split('T')[0];

      const response = await sportmonksClient.get('/fixtures', {
        params: {
          'filter[starts_between]': `${startDate},${endDate}`,
          include: 'localteam,visitorteam',
          sort: 'starting_at',
        },
      });
      return response.data;
    } catch (error: unknown) {
      console.error('Sportmonks getUpcomingMatches Error:', axios.isAxiosError(error) ? error.response?.data : error instanceof Error ? error.message : error);
      throw new Error('Failed to fetch upcoming matches');
    }
  },

  async getFixture(id: string) {
    try {
      const response = await sportmonksClient.get(`/fixtures/${id}`, {
        params: { include: 'localteam,visitorteam,runs,scoreboards,balls' },
      });
      return response.data;
    } catch (error: unknown) {
      console.error('Sportmonks getFixture Error:', axios.isAxiosError(error) ? error.response?.data : error instanceof Error ? error.message : error);
      throw new Error('Failed to fetch match');
    }
  },

  async getSettlementResult(id: string): Promise<{ finished: boolean; winnerTeam?: string }> {
    const response = await this.getFixture(id);
    const match = response?.data;
    const home = match?.localteam?.name;
    const away = match?.visitorteam?.name;
    const winnerId = match?.winner_team_id ?? match?.winnerTeamId;
    const winnerTeam = winnerId === match?.localteam_id || winnerId === match?.localteam?.id
      ? home
      : winnerId === match?.visitorteam_id || winnerId === match?.visitorteam?.id
        ? away
        : match?.winner_team || match?.winnerTeam || match?.result?.winner;
    const status = String(match?.status || '').toLowerCase();
    return {
      finished: Boolean(match?.status === 'Finished' || status.includes('finished') || match?.status === 3),
      winnerTeam,
    };
  },

  /**
   * Fetch odds for a specific match
   * Note: You need the 'odds' endpoint access in your Sportmonks plan
   */
  async getMatchOdds(matchId: string) {
    try {
      // Typically odds are nested or have a specific endpoint. 
      // Adjust the endpoint based on your specific Sportmonks plan (pre-match or in-play).
      const response = await sportmonksClient.get(`/odds/fixture/${matchId}`);
      return response.data;
    } catch (error: unknown) {
      console.error(`Sportmonks getMatchOdds Error for ${matchId}:`, axios.isAxiosError(error) ? error.response?.data : error instanceof Error ? error.message : error);
      throw new Error('Failed to fetch match odds');
    }
  }
};
