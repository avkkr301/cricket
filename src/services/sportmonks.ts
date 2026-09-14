import axios from 'axios';

const SPORTMONKS_BASE_URL = 'https://cricket.sportmonks.com/api/v2.0';
const API_TOKEN = process.env.SPORTMONKS_API_TOKEN;

const sportmonksClient = axios.create({
  baseURL: SPORTMONKS_BASE_URL,
  params: {
    api_token: API_TOKEN,
  },
});

export const sportmonksService = {
  /**
   * Fetch live cricket matches (in-play)
   */
  async getLiveMatches() {
    try {
      const response = await sportmonksClient.get('/livescores', {
        params: {
          include: 'localteam,visitorteam,runs,scoreboards',
        }
      });
      return response.data;
    } catch (error: any) {
      console.error('Sportmonks getLiveMatches Error:', error.response?.data || error.message);
      throw new Error('Failed to fetch live matches');
    }
  },

  /**
   * Fetch upcoming cricket matches (fixtures)
   */
  async getUpcomingMatches() {
    try {
      const today = new Date();
      // Today + Tomorrow = 48 hours
      const endOfTomorrow = new Date(today);
      endOfTomorrow.setDate(today.getDate() + 2);

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
    } catch (error: any) {
      console.error('Sportmonks getUpcomingMatches Error:', error.response?.data || error.message);
      throw new Error('Failed to fetch upcoming matches');
    }
  },

  async getFixture(id: string) {
    try {
      const response = await sportmonksClient.get(`/fixtures/${id}`, {
        params: { include: 'localteam,visitorteam,runs,scoreboards' },
      });
      return response.data;
    } catch (error: any) {
      console.error('Sportmonks getFixture Error:', error.response?.data || error.message);
      throw new Error('Failed to fetch match');
    }
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
    } catch (error: any) {
      console.error(`Sportmonks getMatchOdds Error for ${matchId}:`, error.response?.data || error.message);
      throw new Error('Failed to fetch match odds');
    }
  }
};
