/**
 * Migration script to update existing items and requests with new hierarchical category fields
 */

const { PrismaClient } = require('@prisma/client');
const categories = require('../src/data/categories.json');

const prisma = new PrismaClient();

// Map legacy category enum to listing type and tier1
const LEGACY_TO_NEW = {
  'tools': { listingType: 'item', tier1: 'Tools' },
  'outdoor_recreation': { listingType: 'item', tier1: 'Outdoor & Recreation' },
  'party_events': { listingType: 'item', tier1: 'Party & Events' },
  'lawn_garden': { listingType: 'item', tier1: 'Lawn & Garden' },
  'vehicles_transport': { listingType: 'item', tier1: 'Vehicles & Transport' },
  'workspace': { listingType: 'item', tier1: 'Workspace' },
  'specialized_equipment': { listingType: 'item', tier1: 'Specialized Equipment' },
  'services': { listingType: 'service', tier1: null }, // Need to determine from title
  'other': { listingType: 'item', tier1: null },
};

// Levenshtein distance for fuzzy matching
function levenshteinDistance(str1, str2) {
  const m = str1.length;
  const n = str2.length;
  const matrix = [];

  for (let i = 0; i <= n; i++) {
    matrix[i] = [i];
  }
  for (let j = 0; j <= m; j++) {
    matrix[0][j] = j;
  }

  for (let i = 1; i <= n; i++) {
    for (let j = 1; j <= m; j++) {
      if (str2.charAt(i - 1) === str1.charAt(j - 1)) {
        matrix[i][j] = matrix[i - 1][j - 1];
      } else {
        matrix[i][j] = Math.min(
          matrix[i - 1][j - 1] + 1,
          matrix[i][j - 1] + 1,
          matrix[i - 1][j] + 1
        );
      }
    }
  }

  return matrix[n][m];
}

// Find best match for a title in category hierarchy
function findBestMatch(title, listingType) {
  const normalized = title.toLowerCase().trim();
  const key = listingType === 'service' ? 'services' : 'items';
  let bestMatch = null;
  let bestScore = 0;

  for (const tier1 in categories[key]) {
    for (const tier2 in categories[key][tier1]) {
      const tier3Items = categories[key][tier1][tier2];

      for (const item of tier3Items) {
        if (item === 'Other') continue;

        const itemNormalized = item.toLowerCase();

        // Exact match
        if (itemNormalized === normalized) {
          return { tier1, tier2, tier3: item, matchScore: 1.0, isOther: false };
        }

        // Substring match
        if (itemNormalized.includes(normalized) || normalized.includes(itemNormalized)) {
          const score = 0.85;
          if (score > bestScore) {
            bestScore = score;
            bestMatch = { tier1, tier2, tier3: item, matchScore: score, isOther: false };
          }
          continue;
        }

        // Word overlap
        const titleWords = normalized.split(/\s+/);
        const itemWords = itemNormalized.split(/\s+/);
        const overlap = titleWords.filter(w => itemWords.some(iw => iw.includes(w) || w.includes(iw))).length;
        if (overlap > 0) {
          const score = 0.5 + (overlap / Math.max(titleWords.length, itemWords.length)) * 0.3;
          if (score > bestScore) {
            bestScore = score;
            bestMatch = { tier1, tier2, tier3: item, matchScore: score, isOther: false };
          }
        }

        // Levenshtein distance
        const distance = levenshteinDistance(normalized, itemNormalized);
        const maxAllowedDistance = Math.max(3, Math.floor(normalized.length * 0.4));

        if (distance <= maxAllowedDistance) {
          const score = 1 - (distance / Math.max(normalized.length, itemNormalized.length));
          if (score > bestScore) {
            bestScore = score;
            bestMatch = { tier1, tier2, tier3: item, matchScore: score, isOther: false };
          }
        }
      }
    }
  }

  return bestMatch;
}

// Get default tier2 and tier3 for a tier1
function getDefaultForTier1(tier1, listingType) {
  const key = listingType === 'service' ? 'services' : 'items';
  const tier1Data = categories[key][tier1];

  if (!tier1Data) return null;

  const tier2 = Object.keys(tier1Data)[0];
  if (!tier2) return null;

  const tier3Items = tier1Data[tier2];
  // Find first non-Other item, or use Other
  const tier3 = tier3Items.find(i => i !== 'Other') || 'Other';

  return { tier2, tier3 };
}

async function migrateItems() {
  console.log('Migrating items...');

  const items = await prisma.item.findMany({
    where: {
      OR: [
        { listingType: null },
        { categoryTier1: null },
      ]
    }
  });

  console.log(`Found ${items.length} items to migrate`);

  for (const item of items) {
    const legacyMapping = LEGACY_TO_NEW[item.category] || { listingType: 'item', tier1: null };
    let listingType = legacyMapping.listingType;
    let tier1 = legacyMapping.tier1;
    let tier2 = null;
    let tier3 = null;
    let isOther = false;
    let customItemName = null;

    // Try to find a match based on title
    const match = findBestMatch(item.title, listingType);

    if (match && match.matchScore >= 0.5) {
      tier1 = match.tier1;
      tier2 = match.tier2;
      tier3 = match.tier3;
      isOther = match.isOther;
      console.log(`  Item "${item.title}" -> ${tier1} > ${tier2} > ${tier3} (score: ${match.matchScore.toFixed(2)})`);
    } else if (tier1) {
      // Use default for the tier1 from legacy category
      const defaults = getDefaultForTier1(tier1, listingType);
      if (defaults) {
        tier2 = defaults.tier2;
        tier3 = 'Other';
        isOther = true;
        customItemName = item.title;
        console.log(`  Item "${item.title}" -> ${tier1} > ${tier2} > Other (custom: ${item.title})`);
      }
    } else {
      // Fallback to first category
      const key = listingType === 'service' ? 'services' : 'items';
      tier1 = Object.keys(categories[key])[0];
      const defaults = getDefaultForTier1(tier1, listingType);
      if (defaults) {
        tier2 = defaults.tier2;
        tier3 = 'Other';
        isOther = true;
        customItemName = item.title;
        console.log(`  Item "${item.title}" -> ${tier1} > ${tier2} > Other (fallback, custom: ${item.title})`);
      }
    }

    if (tier1 && tier2 && tier3) {
      await prisma.item.update({
        where: { id: item.id },
        data: {
          listingType,
          categoryTier1: tier1,
          categoryTier2: tier2,
          categoryTier3: tier3,
          isOther,
          customItemName,
        }
      });
    }
  }

  console.log('Items migration complete!\n');
}

async function migrateRequests() {
  console.log('Migrating requests...');

  const requests = await prisma.request.findMany({
    where: {
      OR: [
        { listingType: null },
        { categoryTier1: null },
      ]
    }
  });

  console.log(`Found ${requests.length} requests to migrate`);

  for (const request of requests) {
    const legacyMapping = LEGACY_TO_NEW[request.category] || { listingType: 'item', tier1: null };
    let listingType = legacyMapping.listingType;
    let tier1 = legacyMapping.tier1;
    let tier2 = null;
    let tier3 = null;
    let isOther = false;
    let customNeed = null;

    // Try to find a match based on title
    const match = findBestMatch(request.title, listingType);

    if (match && match.matchScore >= 0.5) {
      tier1 = match.tier1;
      tier2 = match.tier2;
      tier3 = match.tier3;
      isOther = match.isOther;
      console.log(`  Request "${request.title}" -> ${tier1} > ${tier2} > ${tier3} (score: ${match.matchScore.toFixed(2)})`);
    } else if (tier1) {
      // Use default for the tier1 from legacy category
      const defaults = getDefaultForTier1(tier1, listingType);
      if (defaults) {
        tier2 = defaults.tier2;
        tier3 = 'Other';
        isOther = true;
        customNeed = request.title;
        console.log(`  Request "${request.title}" -> ${tier1} > ${tier2} > Other (custom: ${request.title})`);
      }
    } else {
      // Fallback to first category
      const key = listingType === 'service' ? 'services' : 'items';
      tier1 = Object.keys(categories[key])[0];
      const defaults = getDefaultForTier1(tier1, listingType);
      if (defaults) {
        tier2 = defaults.tier2;
        tier3 = 'Other';
        isOther = true;
        customNeed = request.title;
        console.log(`  Request "${request.title}" -> ${tier1} > ${tier2} > Other (fallback, custom: ${request.title})`);
      }
    }

    if (tier1 && tier2 && tier3) {
      await prisma.request.update({
        where: { id: request.id },
        data: {
          listingType,
          categoryTier1: tier1,
          categoryTier2: tier2,
          categoryTier3: tier3,
          isOther,
          customNeed,
        }
      });
    }
  }

  console.log('Requests migration complete!\n');
}

async function main() {
  console.log('Starting category migration...\n');

  await migrateItems();
  await migrateRequests();

  console.log('Migration complete!');
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
