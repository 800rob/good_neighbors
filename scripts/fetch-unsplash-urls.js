/**
 * Fetch Unsplash CDN URLs for seed data (compliant hotlinking).
 *
 * Usage:
 *   UNSPLASH_ACCESS_KEY=<your-key> node scripts/fetch-unsplash-urls.js
 *
 * Get a free API key at https://unsplash.com/developers
 *
 * Instead of downloading images, this script:
 *   1. Searches Unsplash for each item
 *   2. Triggers the download endpoint (Unsplash requirement)
 *   3. Saves CDN URLs + attribution to unsplash-credits.json
 *
 * Output: good-neighbors-web/public/unsplash-credits.json
 *
 * Unsplash demo apps: 50 req/hour. Each image = 2 API calls.
 * The script auto-pauses at the limit and resumes after 61 minutes.
 */

const https = require('https');
const fs = require('fs');
const path = require('path');

const ACCESS_KEY = process.env.UNSPLASH_ACCESS_KEY;
if (!ACCESS_KEY) {
  console.error('ERROR: Set UNSPLASH_ACCESS_KEY environment variable.');
  console.error('Get a free key at https://unsplash.com/developers');
  process.exit(1);
}

const OUTPUT_PATH = path.resolve(__dirname, '../../good-neighbors-web/public/unsplash-credits.json');

// Curated search queries optimized for good Unsplash results
const IMAGE_MAP = {
  // Shared between seed.js and seedDemo.js
  'miter-saw':          'miter saw woodworking',
  'table-saw':          'table saw woodworking workshop',
  'party-speaker':      'bluetooth party speaker JBL',
  'pressure-washer':    'pressure washer cleaning driveway',
  'garage-workshop':    'garage workshop workbench tools',
  'camping-tent':       'camping tent outdoors forest',
  'handyman-service':   'handyman home repair tools',

  // seed.js only
  'cordless-drill':     'cordless drill dewalt power tool',
  'mountain-bike':      'mountain bike trail riding',
  'folding-tables':     'folding tables event setup',
  'lawn-mower':         'lawn mower grass cutting',
  'utility-trailer':    'utility trailer hauling',
  'appliance-dolly':    'appliance dolly hand truck moving',
  'tool-set':           'basic tool set hammer screwdriver',
  'party-decorations':  'party decorations balloons streamers',

  // seedDemo.js only
  'alpine-skis-rossignol': 'alpine skis mountain resort',
  'alpine-skis-powder':    'powder skis deep snow skiing',
  'ski-boots-salomon':     'ski boots alpine skiing',
  'ski-boots-nordica':     'ski boots performance alpine',
  'snowboard-burton':      'snowboard all mountain winter',
  'snowboard-ride':        'freestyle snowboard park',
  'snowshoes':             'snowshoes winter hiking trail',
  'circular-saw':          'circular saw cordless cutting wood',
  'extension-ladder':      'extension ladder fiberglass tall',
  'bounce-house':          'bounce house inflatable kids party',
  'projector-screen':      'projector screen outdoor movie night',
  'pickup-truck-ford':     'ford f250 pickup truck',
  'pickup-truck-toyota':   'toyota tacoma pickup truck',
  'dslr-camera':           'canon dslr camera lens photography',
  'generator':             'portable generator honda camping',
  'moving-help':           'moving helpers carrying furniture truck',
  'snow-removal':          'snow removal shoveling driveway winter',
  'house-cleaning':        'house cleaning service supplies',
  'pet-sitting':           'pet sitting dog golden retriever happy',
  'portrait-photography':  'portrait photography natural light outdoor',
  'furniture-assembly':    'furniture assembly ikea tools',
};

const RATE_LIMIT = 50;
const DELAY_MS = 1000;
const PAUSE_MS = 61 * 60 * 1000;

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function httpsGet(url, headers = {}) {
  return new Promise((resolve, reject) => {
    const parsedUrl = new URL(url);
    const options = {
      hostname: parsedUrl.hostname,
      path: parsedUrl.pathname + parsedUrl.search,
      headers,
    };
    https.get(options, (res) => {
      // Follow redirects
      if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
        return httpsGet(res.headers.location, headers).then(resolve).catch(reject);
      }
      let body = '';
      res.on('data', (chunk) => { body += chunk; });
      res.on('end', () => {
        if (res.statusCode >= 400) {
          const err = new Error(`HTTP ${res.statusCode}`);
          err.statusCode = res.statusCode;
          try { err.body = JSON.parse(body); } catch { err.body = body; }
          reject(err);
        } else {
          try { resolve(JSON.parse(body)); } catch { resolve(body); }
        }
      });
    }).on('error', reject);
  });
}

async function main() {
  // Load existing credits to allow resuming
  let credits = {};
  if (fs.existsSync(OUTPUT_PATH)) {
    try {
      credits = JSON.parse(fs.readFileSync(OUTPUT_PATH, 'utf8'));
    } catch { /* ignore parse errors */ }
  }

  const keys = Object.keys(IMAGE_MAP);
  let fetched = 0;
  let skipped = 0;
  let apiCalls = 0;

  console.log(`Fetching Unsplash URLs for ${keys.length} images\n`);

  for (const key of keys) {
    // Skip already-fetched entries (idempotent)
    if (credits[key] && credits[key].url) {
      console.log(`  SKIP  ${key} (already fetched)`);
      skipped++;
      continue;
    }

    // Each image requires 2 API calls (search + download trigger).
    if (apiCalls + 2 > RATE_LIMIT) {
      fs.writeFileSync(OUTPUT_PATH, JSON.stringify(credits, null, 2));
      console.log(`\n  Saved progress: ${OUTPUT_PATH}`);
      console.log(`  Rate limit reached (${apiCalls}/${RATE_LIMIT} calls used).`);
      console.log(`  Remaining images can be fetched by re-running the script after 1 hour.`);
      break;
    }

    const query = IMAGE_MAP[key];
    console.log(`  FETCH ${key}  [${apiCalls + 2}/${RATE_LIMIT} calls]  (query: "${query}")`);

    try {
      // API call 1: search
      const searchUrl = `https://api.unsplash.com/search/photos?query=${encodeURIComponent(query)}&per_page=1&orientation=squarish`;
      const data = await httpsGet(searchUrl, {
        Authorization: `Client-ID ${ACCESS_KEY}`,
      });
      apiCalls++;

      if (!data.results || data.results.length === 0) {
        console.log(`  WARN  No results for "${query}" — skipping`);
        continue;
      }

      const photo = data.results[0];

      // API call 2: trigger download endpoint (Unsplash requirement)
      await httpsGet(photo.links.download_location, {
        Authorization: `Client-ID ${ACCESS_KEY}`,
      });
      apiCalls++;

      credits[key] = {
        url: photo.urls.regular,
        photographer: photo.user.name,
        username: photo.user.username,
        photoUrl: photo.links.html,
        profileUrl: photo.user.links.html,
      };

      fetched++;
      console.log(`  OK    ${key} — by ${photo.user.name} (@${photo.user.username})`);
      console.log(`        ${photo.urls.regular.substring(0, 80)}...`);
    } catch (err) {
      const status = err.statusCode;
      const msg = err.body?.errors?.[0] || err.message;
      console.error(`  ERROR ${key}: ${status || ''} ${msg}`);

      if (status === 403) {
        fs.writeFileSync(OUTPUT_PATH, JSON.stringify(credits, null, 2));
        console.log(`\n  Got 403 — likely rate-limited. Pausing for 61 minutes...`);
        console.log(`  Resume time: ${new Date(Date.now() + PAUSE_MS).toLocaleTimeString()}\n`);
        await sleep(PAUSE_MS);
        apiCalls = 0;
        console.log('  Resuming...\n');
      }
    }

    await sleep(DELAY_MS);
  }

  // Write final output
  fs.writeFileSync(OUTPUT_PATH, JSON.stringify(credits, null, 2));

  console.log(`\nDone! Fetched: ${fetched}, Skipped: ${skipped}`);
  console.log(`Output: ${OUTPUT_PATH}`);

  // Print summary for manual verification
  console.log('\n=== URL Summary ===\n');
  for (const [k, v] of Object.entries(credits)) {
    console.log(`${k}:`);
    console.log(`  URL: ${v.url?.substring(0, 80)}...`);
    console.log(`  By:  ${v.photographer} (@${v.username})\n`);
  }

  console.log('\nPhotos provided by Unsplash (https://unsplash.com)');
}

main().catch((err) => {
  console.error('Fatal error:', err.message);
  process.exit(1);
});
