const axios = require('axios');
const dotenv = require('dotenv');
const path = require('path');
dotenv.config({ path: path.resolve(__dirname, '.env.local') });

async function test() {
  const url = `https://cricket.sportmonks.com/api/v2.0/fixtures?api_token=${process.env.SPORTMONKS_API_TOKEN}&filter[starts_between]=2026-09-14,2026-10-14&include=localteam,visitorteam`;
  try {
    const res = await axios.get(url);
    console.log(res.data.data.map(m => m.starting_at).slice(0, 5));
  } catch(e) {
    console.error(e.response ? e.response.data : e.message);
  }
}
test();
