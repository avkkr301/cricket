const axios = require('axios');
const dotenv = require('dotenv');
dotenv.config({ path: '.env.local' });

const KEY = 'e46f93ce0ecd85ed50991fe86a2579d8';

async function test() {
  try {
    // List all available sports
    const sports = await axios.get(`https://api.the-odds-api.com/v4/sports/?apiKey=${KEY}`);
    const cricket = sports.data.filter(s => s.group === 'Cricket' || s.key.includes('cricket'));
    console.log('Cricket sports available:');
    cricket.forEach(s => console.log(' -', s.key, '|', s.title, '| active:', s.active));

    // Check remaining quota
    console.log('\nRequests remaining:', sports.headers['x-requests-remaining']);
    console.log('Requests used:', sports.headers['x-requests-used']);
  } catch(e) {
    console.error(e.response ? e.response.data : e.message);
  }
}
test();
