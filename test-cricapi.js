const axios = require('axios');
const dotenv = require('dotenv');
const path = require('path');
dotenv.config({ path: path.resolve(__dirname, '.env.local') });

async function test() {
  try {
    const res = await axios.get(`https://api.cricapi.com/v1/currentMatches?apikey=${process.env.CRICAPI_KEY}&offset=0`);
    const matches = res.data.data || [];
    console.log(`Total matches: ${matches.length}`);
    const live = matches.filter(m => m.matchStarted && !m.matchEnded);
    const upcoming = matches.filter(m => !m.matchStarted);
    console.log(`Live: ${live.length}, Upcoming: ${upcoming.length}`);
    console.log('Sample live:', live.slice(0,3).map(m => `${m.name} [${m.status}]`));
    console.log('Sample upcoming:', upcoming.slice(0,3).map(m => `${m.name} - ${m.dateTimeGMT}`));
  } catch(e) {
    console.error(e.response ? e.response.data : e.message);
  }
}
test();
