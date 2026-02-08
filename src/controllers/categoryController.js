const categories = require('../data/categories.json');
const pricingSuggestions = require('../data/pricingSuggestions.json');
const { getSpecsForItem } = require('../utils/specUtils');

/**
 * Get complete category hierarchy
 * GET /api/categories/hierarchy
 */
function getHierarchy(req, res) {
  res.json(categories);
}

/**
 * Get tier 1 categories for a type
 * GET /api/categories/tier1?type=item|service
 */
function getTier1(req, res) {
  const { type } = req.query;

  if (!type || !['item', 'service'].includes(type)) {
    return res.status(400).json({ error: 'Type must be "item" or "service"' });
  }

  const key = type === 'item' ? 'items' : 'services';
  const tier1Categories = Object.keys(categories[key]);

  res.json({
    type,
    categories: tier1Categories
  });
}

/**
 * Get tier 2 subcategories
 * GET /api/categories/tier2?type=item&tier1=Tools
 */
function getTier2(req, res) {
  const { type, tier1 } = req.query;

  if (!type || !['item', 'service'].includes(type)) {
    return res.status(400).json({ error: 'Type must be "item" or "service"' });
  }

  if (!tier1) {
    return res.status(400).json({ error: 'tier1 is required' });
  }

  const key = type === 'item' ? 'items' : 'services';
  const tier1Data = categories[key][tier1];

  if (!tier1Data) {
    return res.status(404).json({ error: `Category "${tier1}" not found for type "${type}"` });
  }

  const subcategories = Object.keys(tier1Data);

  res.json({
    type,
    tier1,
    subcategories
  });
}

/**
 * Get tier 3 items/services
 * GET /api/categories/tier3?type=item&tier1=Tools&tier2=Power%20Tools
 */
function getTier3(req, res) {
  const { type, tier1, tier2 } = req.query;

  if (!type || !['item', 'service'].includes(type)) {
    return res.status(400).json({ error: 'Type must be "item" or "service"' });
  }

  if (!tier1 || !tier2) {
    return res.status(400).json({ error: 'tier1 and tier2 are required' });
  }

  const key = type === 'item' ? 'items' : 'services';
  const tier2Data = categories[key]?.[tier1]?.[tier2];

  if (!tier2Data) {
    return res.status(404).json({
      error: `Subcategory "${tier2}" not found in "${tier1}" for type "${type}"`
    });
  }

  res.json({
    type,
    tier1,
    tier2,
    items: tier2Data
  });
}

/**
 * Levenshtein distance for fuzzy matching
 */
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

/**
 * Fuzzy search for category suggestions
 * GET /api/categories/search?query=snow%20board&type=item
 */
function searchCategories(req, res) {
  const { query, type } = req.query;

  if (!query) {
    return res.status(400).json({ error: 'Query is required' });
  }

  if (!type || !['item', 'service'].includes(type)) {
    return res.status(400).json({ error: 'Type must be "item" or "service"' });
  }

  const normalized = query.toLowerCase().trim().replace(/\s+/g, ' ');
  const key = type === 'item' ? 'items' : 'services';
  const results = [];

  // Search through all tier3 items
  for (const tier1 in categories[key]) {
    for (const tier2 in categories[key][tier1]) {
      const tier3Items = categories[key][tier1][tier2];

      for (const item of tier3Items) {
        if (item === 'Other') continue;

        const itemNormalized = item.toLowerCase();

        // Exact match
        if (itemNormalized === normalized) {
          results.push({
            tier1,
            tier2,
            tier3: item,
            matchScore: 1.0,
            distance: 0
          });
          continue;
        }

        // Substring match
        if (itemNormalized.includes(normalized) || normalized.includes(itemNormalized)) {
          results.push({
            tier1,
            tier2,
            tier3: item,
            matchScore: 0.85,
            distance: Math.abs(itemNormalized.length - normalized.length)
          });
          continue;
        }

        // Levenshtein distance
        const distance = levenshteinDistance(normalized, itemNormalized);
        const maxAllowedDistance = Math.max(2, Math.floor(normalized.length * 0.3));

        if (distance <= maxAllowedDistance) {
          const matchScore = 1 - (distance / Math.max(normalized.length, itemNormalized.length));
          results.push({
            tier1,
            tier2,
            tier3: item,
            matchScore: Math.round(matchScore * 100) / 100,
            distance
          });
        }
      }
    }
  }

  // Sort by match score (highest first), then by distance (lowest first)
  results.sort((a, b) => {
    if (b.matchScore !== a.matchScore) {
      return b.matchScore - a.matchScore;
    }
    return a.distance - b.distance;
  });

  res.json({
    query,
    type,
    suggestions: results.slice(0, 5)
  });
}

/**
 * Validate category selection
 * POST /api/categories/validate
 */
function validateCategories(req, res) {
  const { type, tier1, tier2, tier3, customTitle } = req.body;
  const errors = [];

  // Type validation
  if (!type || !['item', 'service'].includes(type)) {
    errors.push('Type must be "item" or "service"');
  }

  const key = type === 'item' ? 'items' : 'services';

  // Tier 1 validation
  if (!tier1) {
    errors.push('Category (tier1) is required');
  } else if (!categories[key]?.[tier1]) {
    errors.push(`Invalid category: "${tier1}"`);
  }

  // Tier 2 validation
  if (!tier2) {
    errors.push('Subcategory (tier2) is required');
  } else if (tier1 && !categories[key]?.[tier1]?.[tier2]) {
    errors.push(`Invalid subcategory: "${tier2}" for category "${tier1}"`);
  }

  // Tier 3 validation
  if (!tier3) {
    errors.push('Item/service (tier3) is required');
  } else if (tier1 && tier2) {
    const validItems = categories[key]?.[tier1]?.[tier2] || [];
    if (!validItems.includes(tier3)) {
      errors.push(`Invalid item: "${tier3}" for subcategory "${tier2}"`);
    }
  }

  // Custom title validation
  if (tier3 === 'Other') {
    if (!customTitle || customTitle.trim() === '') {
      errors.push('Custom title is required when "Other" is selected');
    } else {
      // Check if custom title matches an existing category
      const searchResults = fuzzySearchInternal(customTitle, type);
      const closeMatch = searchResults.find(m => m.matchScore > 0.85);
      if (closeMatch) {
        errors.push(
          `"${customTitle}" matches existing item "${closeMatch.tier3}" ` +
          `in ${closeMatch.tier1} → ${closeMatch.tier2}. Please select it from the dropdown.`
        );
      }
    }
  }

  res.json({
    isValid: errors.length === 0,
    errors
  });
}

/**
 * Internal fuzzy search (used by validation)
 */
function fuzzySearchInternal(query, type) {
  const normalized = query.toLowerCase().trim().replace(/\s+/g, ' ');
  const key = type === 'item' ? 'items' : 'services';
  const results = [];

  for (const tier1 in categories[key]) {
    for (const tier2 in categories[key][tier1]) {
      const tier3Items = categories[key][tier1][tier2];

      for (const item of tier3Items) {
        if (item === 'Other') continue;

        const itemNormalized = item.toLowerCase();

        if (itemNormalized === normalized) {
          results.push({ tier1, tier2, tier3: item, matchScore: 1.0, distance: 0 });
          continue;
        }

        if (itemNormalized.includes(normalized) || normalized.includes(itemNormalized)) {
          results.push({
            tier1, tier2, tier3: item,
            matchScore: 0.85,
            distance: Math.abs(itemNormalized.length - normalized.length)
          });
          continue;
        }

        const distance = levenshteinDistance(normalized, itemNormalized);
        const maxAllowedDistance = Math.max(2, Math.floor(normalized.length * 0.3));

        if (distance <= maxAllowedDistance) {
          const matchScore = 1 - (distance / Math.max(normalized.length, itemNormalized.length));
          results.push({ tier1, tier2, tier3: item, matchScore, distance });
        }
      }
    }
  }

  results.sort((a, b) => b.matchScore - a.matchScore || a.distance - b.distance);
  return results.slice(0, 5);
}

/**
 * Get pricing suggestions for a category/item
 * GET /api/categories/pricing?type=item&tier1=Tools&tier2=Power%20Tools&tier3=Drill%20(Cordless)&condition=good
 */
function getPricingSuggestions(req, res) {
  const { type, tier1, tier2, tier3, condition = 'good' } = req.query;

  if (!type || !['item', 'service'].includes(type)) {
    return res.status(400).json({ error: 'Type must be "item" or "service"' });
  }

  if (!tier1) {
    return res.status(400).json({ error: 'tier1 is required' });
  }

  let basePricing = null;

  if (type === 'item') {
    // Try to find specific pricing: tier1 > tier2 > tier3
    const tier1Data = pricingSuggestions.items[tier1];
    if (tier1Data && tier2) {
      const tier2Data = tier1Data[tier2];
      if (tier2Data) {
        // Try specific tier3 first, then default for tier2
        basePricing = tier2Data[tier3] || tier2Data.default;
      }
    }

    // Fallback to a generic default for items
    if (!basePricing) {
      basePricing = { hourly: 5, daily: 20, weekly: 60, monthly: 150 };
    }
  } else {
    // Services
    const tier1Data = pricingSuggestions.services[tier1];
    if (tier1Data && tier2) {
      const tier2Data = tier1Data[tier2];
      if (tier2Data && tier2Data.default) {
        basePricing = tier2Data.default;
      } else if (tier1Data.default) {
        basePricing = tier1Data.default;
      }
    } else if (tier1Data && tier1Data.default) {
      basePricing = tier1Data.default;
    }

    // Fallback to generic service default
    if (!basePricing) {
      basePricing = pricingSuggestions.services.default || { hourly: 25, daily: 150, weekly: 500, monthly: 1500 };
    }
  }

  // Apply condition multiplier for items
  let conditionMultiplier = 1.0;
  if (type === 'item' && condition && pricingSuggestions.conditionMultipliers[condition]) {
    conditionMultiplier = pricingSuggestions.conditionMultipliers[condition];
  }

  // Calculate suggested prices
  const suggestions = {
    hourly: Math.round(basePricing.hourly * conditionMultiplier * 100) / 100,
    daily: Math.round(basePricing.daily * conditionMultiplier * 100) / 100,
    weekly: Math.round(basePricing.weekly * conditionMultiplier * 100) / 100,
    monthly: Math.round(basePricing.monthly * conditionMultiplier * 100) / 100,
  };

  // Add ranges (low/high)
  const ranges = {
    hourly: {
      low: Math.round(suggestions.hourly * 0.7 * 100) / 100,
      suggested: suggestions.hourly,
      high: Math.round(suggestions.hourly * 1.3 * 100) / 100,
    },
    daily: {
      low: Math.round(suggestions.daily * 0.7 * 100) / 100,
      suggested: suggestions.daily,
      high: Math.round(suggestions.daily * 1.3 * 100) / 100,
    },
    weekly: {
      low: Math.round(suggestions.weekly * 0.7 * 100) / 100,
      suggested: suggestions.weekly,
      high: Math.round(suggestions.weekly * 1.3 * 100) / 100,
    },
    monthly: {
      low: Math.round(suggestions.monthly * 0.7 * 100) / 100,
      suggested: suggestions.monthly,
      high: Math.round(suggestions.monthly * 1.3 * 100) / 100,
    },
  };

  res.json({
    type,
    tier1,
    tier2: tier2 || null,
    tier3: tier3 || null,
    condition: type === 'item' ? condition : null,
    conditionMultiplier: type === 'item' ? conditionMultiplier : null,
    suggestions,
    ranges,
  });
}

/**
 * Get spec definitions for a specific item/service
 * GET /api/categories/specs?type=item&tier1=Outdoor%20%26%20Recreation&tier2=Winter%20Sports&tier3=Alpine%20Skis
 */
function getSpecs(req, res) {
  const { type, tier1, tier2, tier3 } = req.query;

  if (!type || !['item', 'service'].includes(type)) {
    return res.status(400).json({ error: 'Type must be "item" or "service"' });
  }

  if (!tier1 || !tier2 || !tier3) {
    return res.status(400).json({ error: 'tier1, tier2, and tier3 are required' });
  }

  const specs = getSpecsForItem(type, tier1, tier2, tier3);

  res.json({
    type,
    tier1,
    tier2,
    tier3,
    specs // null if no specs defined for this item
  });
}

module.exports = {
  getHierarchy,
  getTier1,
  getTier2,
  getTier3,
  searchCategories,
  validateCategories,
  getPricingSuggestions,
  getSpecs,
  levenshteinDistance,
  fuzzySearchInternal
};
