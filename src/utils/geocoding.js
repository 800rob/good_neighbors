/**
 * Geocoding utility using OpenStreetMap Nominatim API
 * Free geocoding service - no API key required
 */

const https = require('https');

/**
 * Geocode an address to latitude/longitude coordinates
 * @param {Object} addressParts - Address components
 * @param {string} addressParts.address - Street address
 * @param {string} addressParts.city - City
 * @param {string} addressParts.state - State
 * @param {string} addressParts.zipCode - ZIP code
 * @returns {Promise<{latitude: number, longitude: number} | null>}
 */
async function geocodeAddress({ address, city, state, zipCode }) {
  // Build address string from available parts
  const addressParts = [address, city, state, zipCode].filter(Boolean);

  if (addressParts.length < 2) {
    // Need at least 2 parts for a reasonable geocode
    return null;
  }

  const addressString = addressParts.join(', ');
  const encodedAddress = encodeURIComponent(addressString);

  const url = `https://nominatim.openstreetmap.org/search?format=json&q=${encodedAddress}&limit=1`;

  return new Promise((resolve) => {
    const options = {
      headers: {
        'User-Agent': 'GoodNeighbors/1.0 (neighborhood sharing app)'
      }
    };

    https.get(url, options, (res) => {
      let data = '';

      res.on('data', (chunk) => {
        data += chunk;
      });

      res.on('end', () => {
        try {
          const results = JSON.parse(data);

          if (results && results.length > 0) {
            const { lat, lon } = results[0];
            resolve({
              latitude: parseFloat(lat),
              longitude: parseFloat(lon)
            });
          } else {
            console.log(`[Geocoding] No results for: ${addressString}`);
            resolve(null);
          }
        } catch (error) {
          console.error('[Geocoding] Parse error:', error.message);
          resolve(null);
        }
      });
    }).on('error', (error) => {
      console.error('[Geocoding] Request error:', error.message);
      resolve(null);
    });
  });
}

module.exports = { geocodeAddress };
