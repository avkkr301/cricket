const axios = require('axios');
const dotenv = require('dotenv');
const path = require('path');
dotenv.config({ path: path.resolve(__dirname, '.env.local') });

async function test() {
  const url = `https://cricket.sportmonks.com/api/v2.0/livescores?api_token=${process.env.SPORTMONKS_API_TOKEN}&include=localteam,visitorteam`;
  try {
    const res = await axios.get(url);
    console.log(res.data.data.map(m => `${m.localteam.name} vs ${m.visitorteam.name} (${m.status})`));
  } catch(e) {
    console.error(e.response ? e.response.data : e.message);
  }
}
test();
