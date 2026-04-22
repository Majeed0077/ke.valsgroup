// You would first need to install axios: npm install axios
const express = require('express');
const axios = require('axios'); // Use axios instead of request-promise

const app = express();
const port = 3000;

app.set('trust proxy', true);

app.get('/track', async (req, res) => {
  const clientIp = req.ip;
  console.log(`Client IP: ${clientIp}`);

  try {
    // The axios.get method returns a response object, the actual data is in the `data` property.
    const response = await axios.get(`https://ipinfo.io/${clientIp}/json`);
    const data = response.data; // axios automatically parses JSON

    if (data && data.loc) {
      const [lat, lon] = data.loc.split(',');
      res.json({ lat, lon });
    } else {
      console.log('Could not find location in API response:', data);
      res.status(404).json({ error: 'Could not find location for the given IP' });
    }
  } catch (err) {
    // axios provides more detailed error objects
    console.error('IP lookup failed:', err.message);
    res.status(500).json({ error: 'IP lookup failed' });
  }
});

app.listen(port, () => {
  console.log(`Tracker API running at http://localhost:${port}`);
});