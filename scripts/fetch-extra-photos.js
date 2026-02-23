/**
 * Fetch 3 additional Unsplash photos per item to fill out listings.
 *
 * Unsplash API compliance:
 *   - Triggers download endpoint for every photo used (required by API guidelines)
 *   - Stores full attribution (photographer, username, photo URL, profile URL)
 *   - Uses hotlink-compliant CDN URLs (images.unsplash.com)
 *   - Respects 50 req/hour demo rate limit with auto-pause & resume
 *
 * Usage:
 *   UNSPLASH_ACCESS_KEY=<key> node scripts/fetch-extra-photos.js
 *
 * Re-run safe: skips items that already have 4+ photos.
 */

const https = require('https');
const fs = require('fs');
const path = require('path');
const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();
const ACCESS_KEY = process.env.UNSPLASH_ACCESS_KEY;
if (!ACCESS_KEY) {
  console.error('ERROR: Set UNSPLASH_ACCESS_KEY environment variable.');
  process.exit(1);
}

const CREDITS_PATH = path.resolve(__dirname, '../../good-neighbors-web/public/unsplash-credits.json');
const PROGRESS_PATH = path.resolve(__dirname, '.extra-photos-progress.json');
const TARGET_TOTAL = 4; // aim for 4 photos per item
const RATE_LIMIT = 48;  // stay under 50
const DELAY_MS = 1200;

// Search queries per item — 3 varied queries for photo diversity
// Each array has 3 queries; results[0] from each query → 3 new photos
const ITEM_QUERIES = {
  'Rossignol Experience 82':      ['alpine ski equipment closeup', 'ski resort groomed slopes', 'downhill skiing mountain'],
  'K2 Mindbender 108':            ['powder skiing deep snow', 'backcountry skiing mountain', 'freeride skiing fresh tracks'],
  'Salomon X Access 80':          ['ski boots closeup buckle', 'ski lodge gear room', 'skier putting on boots snow'],
  'Nordica Sportmachine 100':     ['ski boot fitting shop', 'ski equipment rental shop', 'winter ski gear lineup'],
  'Burton Custom 155':            ['snowboard closeup bindings', 'snowboarder carving turn', 'snowboard park halfpipe'],
  'Ride Twinpig':                 ['freestyle snowboard trick', 'snowboard terrain park', 'snowboarding powder spray'],
  'MSR Evo Trail Snowshoes':      ['snowshoeing trail winter', 'snowshoes closeup snow', 'winter hiking snowy forest'],
  'DeWalt 20V MAX Circular Saw':  ['cordless circular saw wood', 'carpenter cutting lumber', 'woodworking power tools workshop'],
  'DeWalt 12\" Sliding':          ['miter saw workshop wood', 'compound miter saw cutting', 'woodworker miter saw angle'],
  'DeWalt 10\" Portable':         ['table saw woodworking shop', 'portable table saw jobsite', 'carpenter using table saw'],
  'Werner 20ft':                  ['tall ladder against house', 'painter on extension ladder', 'ladder home exterior repair'],
  'Sun Joe SPX3000':              ['power washing house exterior', 'high pressure water cleaning', 'cleaning outdoor patio hose'],
  'Kids Bounce House':            ['inflatable bounce house kids party', 'backyard birthday party inflatable', 'children jumping bounce house'],
  'Epson Projector':              ['outdoor movie night backyard', 'projector screen setup garden', 'movie night patio lights'],
  'JBL PartyBox':                 ['outdoor party bluetooth speaker', 'portable speaker backyard gathering', 'music speaker party setup'],
  'Ford F-250':                   ['ford pickup truck hauling', 'heavy duty pickup bed loaded', 'pickup truck towing trailer'],
  'Toyota Tacoma':                ['toyota tacoma offroad', 'midsize pickup truck loaded', 'tacoma truck adventure camping'],
  'Canon EOS 5D':                 ['professional dslr camera lens', 'photographer with camera outdoors', 'camera equipment lens lineup'],
  'Honda EU2200i':                ['portable generator camping outdoor', 'inverter generator power tools', 'generator powering campsite'],
  'Heated Garage Workshop':       ['home workshop organized tools', 'garage workbench power tools', 'clean workshop tool wall'],
  'REI Co-op Passage 4':          ['four person tent campsite', 'camping tent mountain sunrise', 'tent setup forest campground'],
  'Moving Help':                  ['movers carrying furniture', 'moving truck loading boxes', 'moving day helpers carrying'],
  'Experienced Handyman':         ['handyman fixing home repair', 'home repair tools organized', 'carpenter repairing woodwork'],
  'Professional House Cleaning':  ['professional cleaning kitchen', 'house cleaner mopping floor', 'cleaning supplies organized bucket'],
  'Snow Removal':                 ['snow plow driveway clearing', 'shoveling snow walkway winter', 'snow blower clearing path'],
  'Pet Sitting':                  ['dog walker park happy dogs', 'pet sitter playing with dog', 'happy dog garden outdoors'],
  'Portrait & Family Photography':['portrait photographer camera outdoor', 'family photo session park', 'natural light portrait session'],
  'Furniture Assembly':           ['assembling furniture tools', 'ikea furniture assembly helper', 'building furniture with drill'],
};

function sleep(ms) {
  return new Promise(r => setTimeout(r, ms));
}

function httpsGet(url, headers = {}) {
  return new Promise((resolve, reject) => {
    const parsed = new URL(url);
    https.get({
      hostname: parsed.hostname,
      path: parsed.pathname + parsed.search,
      headers,
    }, (res) => {
      if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
        return httpsGet(res.headers.location, headers).then(resolve).catch(reject);
      }
      let body = '';
      res.on('data', c => body += c);
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
  // Load existing credits
  let credits = {};
  if (fs.existsSync(CREDITS_PATH)) {
    try { credits = JSON.parse(fs.readFileSync(CREDITS_PATH, 'utf8')); } catch {}
  }

  // Load progress (which items are already done)
  let progress = {};
  if (fs.existsSync(PROGRESS_PATH)) {
    try { progress = JSON.parse(fs.readFileSync(PROGRESS_PATH, 'utf8')); } catch {}
  }

  // Load items from DB
  const items = await prisma.item.findMany({
    select: { id: true, title: true, photoUrls: true },
  });

  console.log(`Found ${items.length} items in database\n`);

  let apiCalls = 0;
  let updated = 0;
  let skipped = 0;

  for (const item of items) {
    const currentPhotos = Array.isArray(item.photoUrls) ? item.photoUrls : [];

    // Skip if already has enough photos
    if (currentPhotos.length >= TARGET_TOTAL) {
      console.log(`  SKIP  "${item.title}" — already has ${currentPhotos.length} photos`);
      skipped++;
      continue;
    }

    // Skip if already processed in a previous run
    if (progress[item.id] === 'done') {
      console.log(`  SKIP  "${item.title}" — already processed`);
      skipped++;
      continue;
    }

    // Find matching queries
    const matchKey = Object.keys(ITEM_QUERIES).find(k => item.title.includes(k));
    if (!matchKey) {
      console.log(`  WARN  "${item.title}" — no queries defined, skipping`);
      skipped++;
      continue;
    }

    const queries = ITEM_QUERIES[matchKey];
    const needed = TARGET_TOTAL - currentPhotos.length;
    const queriesToRun = queries.slice(0, needed);

    // Check rate limit: each query = 1 search + 1 download = 2 calls
    if (apiCalls + (queriesToRun.length * 2) > RATE_LIMIT) {
      // Save progress and stop
      fs.writeFileSync(PROGRESS_PATH, JSON.stringify(progress, null, 2));
      fs.writeFileSync(CREDITS_PATH, JSON.stringify(credits, null, 2));
      console.log(`\n  Rate limit approaching (${apiCalls}/${RATE_LIMIT} calls used).`);
      console.log(`  Progress saved. Re-run after ~1 hour to continue.`);
      console.log(`  Updated ${updated} items so far, ${skipped} skipped.`);
      await prisma.$disconnect();
      return;
    }

    console.log(`\n  FETCH "${item.title}" — need ${needed} more photos`);

    const newUrls = [];
    const existingUrlSet = new Set(currentPhotos);

    for (let i = 0; i < queriesToRun.length; i++) {
      const query = queriesToRun[i];
      try {
        // Search Unsplash — request a few results to avoid duplicates
        const searchUrl = `https://api.unsplash.com/search/photos?query=${encodeURIComponent(query)}&per_page=3&orientation=landscape`;
        const data = await httpsGet(searchUrl, {
          Authorization: `Client-ID ${ACCESS_KEY}`,
        });
        apiCalls++;

        if (!data.results || data.results.length === 0) {
          console.log(`    WARN  No results for "${query}"`);
          continue;
        }

        // Pick first result that isn't already in the item's photos
        let photo = null;
        for (const r of data.results) {
          if (!existingUrlSet.has(r.urls.regular)) {
            photo = r;
            break;
          }
        }
        if (!photo) {
          console.log(`    WARN  All results for "${query}" already used`);
          continue;
        }

        // Trigger download endpoint (Unsplash API requirement)
        await httpsGet(photo.links.download_location, {
          Authorization: `Client-ID ${ACCESS_KEY}`,
        });
        apiCalls++;

        const url = photo.urls.regular;
        newUrls.push(url);
        existingUrlSet.add(url);

        // Store attribution
        const creditKey = `${item.id.slice(0, 8)}-extra-${i + 1}`;
        credits[creditKey] = {
          url,
          photographer: photo.user.name,
          username: photo.user.username,
          photoUrl: photo.links.html,
          profileUrl: photo.user.links.html,
          itemTitle: item.title,
        };

        console.log(`    OK  [${i + 1}/${queriesToRun.length}] "${query}" — by ${photo.user.name} (@${photo.user.username})`);
      } catch (err) {
        console.error(`    ERROR "${query}": ${err.statusCode || ''} ${err.body?.errors?.[0] || err.message}`);

        if (err.statusCode === 403) {
          // Rate limited — save and bail
          fs.writeFileSync(PROGRESS_PATH, JSON.stringify(progress, null, 2));
          fs.writeFileSync(CREDITS_PATH, JSON.stringify(credits, null, 2));
          console.log(`\n  Got 403 — rate limited. Re-run after ~1 hour.`);
          await prisma.$disconnect();
          return;
        }
      }

      await sleep(DELAY_MS);
    }

    // Update DB with new photos appended
    if (newUrls.length > 0) {
      const updatedPhotos = [...currentPhotos, ...newUrls];
      await prisma.item.update({
        where: { id: item.id },
        data: { photoUrls: updatedPhotos },
      });
      console.log(`    DB updated: ${currentPhotos.length} → ${updatedPhotos.length} photos`);
      updated++;
    }

    progress[item.id] = 'done';
    await sleep(DELAY_MS);
  }

  // Save final state
  fs.writeFileSync(CREDITS_PATH, JSON.stringify(credits, null, 2));
  if (fs.existsSync(PROGRESS_PATH)) fs.unlinkSync(PROGRESS_PATH);

  console.log(`\n--- Done ---`);
  console.log(`Updated: ${updated}, Skipped: ${skipped}`);
  console.log(`Total API calls: ${apiCalls}`);
  console.log(`Credits saved: ${CREDITS_PATH}`);

  // Summary
  const finalItems = await prisma.item.findMany({ select: { title: true, photoUrls: true } });
  console.log(`\nPhoto counts:`);
  for (const it of finalItems) {
    const n = Array.isArray(it.photoUrls) ? it.photoUrls.length : 0;
    console.log(`  ${n} photos — ${it.title}`);
  }

  console.log('\nPhotos provided by Unsplash (https://unsplash.com)');
  await prisma.$disconnect();
}

main().catch(async (err) => {
  console.error('Fatal error:', err);
  await prisma.$disconnect();
  process.exit(1);
});
