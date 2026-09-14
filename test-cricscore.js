const axios = require('axios');
const dotenv = require('dotenv');
const path = require('path');
dotenv.config({ path: path.resolve(__dirname, '.env.local') });

async function test() {
  try {
    const res = await axios.get(`https://api.cricapi.com/v1/cricScore?apikey=${process.env.CRICAPI_KEY}`);
    const matches = res.data.data || [];
    // Print full first match to see all fields
    console.log(JSON.stringify(matches[0], null, 2));
    console.log('\n--- All matchType values ---');
    matches.forEach(m => console.log(`${m.t1} vs ${m.t2} | matchType: ${m.matchType} | ms: ${m.ms}`));
  } catch(e) {
    console.error(e.response ? e.response.data : e.message);
  }
}
test();
