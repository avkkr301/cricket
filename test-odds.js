const axios = require('axios');
const dotenv = require('dotenv');
const path = require('path');
dotenv.config({ path: path.resolve(__dirname, '.env.local') });

async function test() {
  const url = `https://cricket.sportmonks.com/api/v2.0/odds?api_token=${process.env.SPORTMONKS_API_TOKEN}`;
  try {
    const res = await axios.get(url);
    console.log('Odds access:', res.data.data ? 'YES' : 'NO');
  } catch(e) {
    console.error('Error:', e.response ? e.response.data : e.message);
  }
}
test();
