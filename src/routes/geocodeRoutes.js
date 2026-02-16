const express = require('express');
const rateLimit = require('express-rate-limit');
const https = require('https');

const router = express.Router();

// Rate limit: 20 requests per 15 minutes per IP
const geocodeLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 20,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many geocode requests, please try again later' },
});

router.get('/', geocodeLimiter, (req, res) => {
  const { q } = req.query;

  if (!q || typeof q !== 'string' || q.trim().length < 2) {
    return res.status(400).json({ error: 'Query parameter "q" is required (min 2 characters)' });
  }

  const encodedQuery = encodeURIComponent(q.trim());
  const url = `https://nominatim.openstreetmap.org/search?format=json&q=${encodedQuery}&limit=1&addressdetails=1`;

  const options = {
    headers: {
      'User-Agent': 'GoodNeighbors/1.0 (neighborhood sharing app)',
    },
  };

  https.get(url, options, (nominatimRes) => {
    let data = '';

    nominatimRes.on('data', (chunk) => {
      data += chunk;
    });

    nominatimRes.on('end', () => {
      try {
        const results = JSON.parse(data);

        if (results && results.length > 0) {
          const result = results[0];
          res.json({
            latitude: parseFloat(result.lat),
            longitude: parseFloat(result.lon),
            displayName: result.address
              ? [result.address.city || result.address.town || result.address.village, result.address.state].filter(Boolean).join(', ') || result.display_name.split(',').slice(0, 2).join(',')
              : result.display_name.split(',').slice(0, 2).join(','),
          });
        } else {
          res.status(404).json({ error: 'Location not found' });
        }
      } catch (error) {
        console.error('[Geocode] Parse error:', error.message);
        res.status(500).json({ error: 'Geocoding service error' });
      }
    });
  }).on('error', (error) => {
    console.error('[Geocode] Request error:', error.message);
    res.status(500).json({ error: 'Geocoding service unavailable' });
  });
});

module.exports = router;
