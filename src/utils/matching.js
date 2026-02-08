const prisma = require('../config/database');
const { calculateDistance } = require('./distance');
const { notifyUser } = require('../services/notificationService');
const { getSpecsForItem } = require('./specUtils');

/**
 * Extract keywords from text (removes common stop words)
 * @param {string} text - Text to extract keywords from
 * @returns {string[]} Array of lowercase keywords
 */
function extractKeywords(text) {
  if (!text) return [];

  const stopWords = new Set([
    'a', 'an', 'the', 'and', 'or', 'but', 'is', 'are', 'was', 'were', 'be', 'been',
    'being', 'have', 'has', 'had', 'do', 'does', 'did', 'will', 'would', 'could',
    'should', 'may', 'might', 'must', 'shall', 'can', 'need', 'to', 'of', 'in',
    'for', 'on', 'with', 'at', 'by', 'from', 'as', 'into', 'through', 'during',
    'before', 'after', 'above', 'below', 'between', 'under', 'again', 'further',
    'then', 'once', 'here', 'there', 'when', 'where', 'why', 'how', 'all', 'each',
    'few', 'more', 'most', 'other', 'some', 'such', 'no', 'nor', 'not', 'only',
    'own', 'same', 'so', 'than', 'too', 'very', 'just', 'i', 'me', 'my', 'we',
    'our', 'you', 'your', 'he', 'him', 'his', 'she', 'her', 'it', 'its', 'they',
    'them', 'their', 'what', 'which', 'who', 'whom', 'this', 'that', 'these',
    'those', 'am', 'any', 'looking', 'need', 'want', 'like', 'please', 'thanks'
  ]);

  return text
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, ' ')  // Remove punctuation
    .split(/\s+/)
    .filter(word => word.length > 2 && !stopWords.has(word));
}

/**
 * Check if two titles are essentially the same
 * @param {string} title1
 * @param {string} title2
 * @returns {boolean}
 */
function titlesMatch(title1, title2) {
  if (!title1 || !title2) return false;
  const normalize = (t) => t.toLowerCase().replace(/[^a-z0-9]/g, '');
  return normalize(title1) === normalize(title2);
}

/**
 * Calculate text relevance score between request and item
 * @param {object} request - The request object
 * @param {object} item - The item object
 * @returns {{score: number, titleMatch: boolean}} Relevance score and title match flag
 */
function calculateTextRelevance(request, item) {
  // Check for exact/near-exact title match first
  const exactTitleMatch = titlesMatch(request.title, item.title);

  const requestKeywords = new Set([
    ...extractKeywords(request.title),
    ...extractKeywords(request.description)
  ]);

  const itemKeywords = new Set([
    ...extractKeywords(item.title),
    ...extractKeywords(item.description)
  ]);

  if (requestKeywords.size === 0) return { score: 50, titleMatch: exactTitleMatch };

  // Count matching keywords
  let matchCount = 0;
  for (const keyword of requestKeywords) {
    // Check for exact match or partial match (keyword contained in item keyword)
    for (const itemKeyword of itemKeywords) {
      if (itemKeyword === keyword ||
          itemKeyword.includes(keyword) ||
          keyword.includes(itemKeyword)) {
        matchCount++;
        break;
      }
    }
  }

  // Calculate percentage of request keywords found in item
  const relevanceScore = (matchCount / requestKeywords.size) * 100;
  return { score: Math.round(relevanceScore), titleMatch: exactTitleMatch };
}

/**
 * Calculate spec matching score between borrower request and lender item.
 * Returns a score 0-15 and whether the item should be hard excluded.
 *
 * @param {Object|null} requestDetails - Borrower's details JSON (with specs)
 * @param {Object|null} itemDetails - Lender's details JSON (with specs)
 * @param {Array|null} specDefs - Spec definitions for this tier3 item
 * @returns {{ score: number, excluded: boolean, breakdown: Object }}
 */
function calculateSpecScore(requestDetails, itemDetails, specDefs) {
  const result = { score: 0, excluded: false, breakdown: {} };

  // If no spec defs or either side has no specs, return 0 (neutral)
  if (!specDefs || !requestDetails?.specs || !itemDetails?.specs) {
    return result;
  }

  const requestSpecs = requestDetails.specs;
  const itemSpecs = itemDetails.specs;

  let totalWeight = 0;
  let weightedScore = 0;

  for (const def of specDefs) {
    const reqSpec = requestSpecs[def.key];
    const itemSpec = itemSpecs[def.key];

    // Skip if borrower didn't specify this spec
    if (!reqSpec || reqSpec.value === undefined || reqSpec.value === null || reqSpec.value === '') {
      continue;
    }

    // If lender didn't fill this spec, score it as 0 for this field
    if (!itemSpec || itemSpec.value === undefined || itemSpec.value === null || itemSpec.value === '') {
      const weight = def.matchWeight || 1;
      totalWeight += weight;
      // If borrower marked as required and lender didn't even fill it → exclude
      if (reqSpec.requiredMatch) {
        result.excluded = true;
        result.breakdown[def.key] = { score: 0, reason: 'Lender did not specify (required)' };
      } else {
        result.breakdown[def.key] = { score: 0, reason: 'Lender did not specify' };
      }
      continue;
    }

    const weight = def.matchWeight || 1;
    totalWeight += weight;
    let fieldScore = 0;

    switch (def.type) {
      case 'number': {
        const reqVal = reqSpec.value;
        const itemVal = itemSpec.value;
        const flexibility = reqSpec.flexibility !== undefined ? reqSpec.flexibility : (def.defaultFlexibility || 0);

        if (flexibility > 0) {
          const distance = Math.abs(itemVal - reqVal);
          if (distance <= flexibility) {
            // Within flexibility range: score from 0.7 (at edge) to 1.0 (exact)
            fieldScore = 1.0 - (distance / flexibility) * 0.3;
          } else {
            // Outside flexibility: decay to 0
            const overBy = distance - flexibility;
            fieldScore = Math.max(0, 0.7 * Math.exp(-overBy / (flexibility || 1)));
          }
        } else {
          // No flexibility: exact match = 1.0, otherwise decay based on distance
          if (itemVal === reqVal) {
            fieldScore = 1.0;
          } else {
            const maxDiff = Math.max(Math.abs(reqVal), 1);
            fieldScore = Math.max(0, 1 - Math.abs(itemVal - reqVal) / maxDiff);
          }
        }

        if (reqSpec.requiredMatch && fieldScore < 0.5) {
          result.excluded = true;
          result.breakdown[def.key] = { score: fieldScore, reason: 'Required match failed' };
        } else {
          result.breakdown[def.key] = { score: fieldScore };
        }
        break;
      }

      case 'boolean': {
        fieldScore = (reqSpec.value === itemSpec.value) ? 1.0 : 0;
        if (reqSpec.requiredMatch && fieldScore === 0) {
          result.excluded = true;
          result.breakdown[def.key] = { score: 0, reason: 'Required match failed' };
        } else {
          result.breakdown[def.key] = { score: fieldScore };
        }
        break;
      }

      case 'select': {
        if (reqSpec.value === itemSpec.value) {
          fieldScore = 1.0;
        } else {
          fieldScore = 0;
        }
        if (reqSpec.requiredMatch && fieldScore === 0) {
          result.excluded = true;
          result.breakdown[def.key] = { score: 0, reason: 'Required match failed' };
        } else {
          result.breakdown[def.key] = { score: fieldScore };
        }
        break;
      }

      case 'multi-select': {
        const reqArr = Array.isArray(reqSpec.value) ? reqSpec.value : [];
        const itemArr = Array.isArray(itemSpec.value) ? itemSpec.value : [];
        if (reqArr.length > 0) {
          const intersection = reqArr.filter(v => itemArr.includes(v));
          fieldScore = intersection.length / reqArr.length;
        } else {
          fieldScore = 1.0; // No preference = full match
        }
        if (reqSpec.requiredMatch && fieldScore < 0.5) {
          result.excluded = true;
          result.breakdown[def.key] = { score: fieldScore, reason: 'Required match failed' };
        } else {
          result.breakdown[def.key] = { score: fieldScore };
        }
        break;
      }

      case 'text':
        // Text is informational only, no scoring
        fieldScore = 0;
        totalWeight -= weight; // Don't count text fields in the weight
        result.breakdown[def.key] = { score: 0, reason: 'Informational only' };
        break;

      default:
        totalWeight -= weight;
        break;
    }

    weightedScore += fieldScore * weight;
  }

  // Calculate final score: proportional 0-15
  if (totalWeight > 0) {
    result.score = Math.round((weightedScore / totalWeight) * 15 * 10) / 10; // 1 decimal precision
    result.score = Math.min(15, Math.max(0, result.score));
  }

  return result;
}

/**
 * Find and create matches for a request
 * @param {string} requestId - UUID of the request
 * @returns {Promise<Array>} Array of created matches
 */
async function findMatchesForRequest(requestId) {
  // Get request details
  const request = await prisma.request.findUnique({
    where: { id: requestId },
    include: { requester: true },
  });

  if (!request) {
    throw new Error('Request not found');
  }

  // Extract keywords from request for filtering
  const requestKeywords = extractKeywords(request.title + ' ' + (request.description || ''));

  // Build search conditions - match by category OR by text similarity
  const searchConditions = {
    isAvailable: true,
    ownerId: { not: request.requesterId },
  };

  // Find items in same category OR items matching keywords
  const items = await prisma.item.findMany({
    where: {
      ...searchConditions,
      OR: [
        { category: request.category },
        // Also search by title/description keywords
        ...requestKeywords.slice(0, 5).map(keyword => ({
          title: { contains: keyword, mode: 'insensitive' }
        })),
        ...requestKeywords.slice(0, 5).map(keyword => ({
          description: { contains: keyword, mode: 'insensitive' }
        }))
      ]
    },
    include: {
      owner: {
        include: {
          ratingsReceived: {
            select: { overallRating: true },
          },
        },
      },
    },
  });

  // Load spec defs once for this request's tier3 (cached for all items)
  let specDefs = null;
  if (request.listingType && request.categoryTier1 && request.categoryTier2 && request.categoryTier3) {
    specDefs = getSpecsForItem(request.listingType, request.categoryTier1, request.categoryTier2, request.categoryTier3);
  }

  const matches = [];

  for (const item of items) {
    // Calculate distance
    const distance = calculateDistance(
      parseFloat(request.latitude),
      parseFloat(request.longitude),
      parseFloat(item.owner.latitude || 0),
      parseFloat(item.owner.longitude || 0)
    );

    // Skip if beyond max distance
    if (distance > parseFloat(request.maxDistanceMiles)) {
      continue;
    }

    // Skip if price exceeds budget (tier-aware when possible)
    if (item.priceAmount) {
      const requestBudgetTiers = request.details?.budgetTiers;
      const itemPricingType = item.pricingType; // e.g. 'daily', 'hourly'

      if (requestBudgetTiers && itemPricingType && itemPricingType !== 'free' && requestBudgetTiers[itemPricingType]) {
        // Same-tier comparison: item's pricing type matches a requester budget tier
        if (parseFloat(item.priceAmount) > requestBudgetTiers[itemPricingType]) {
          continue;
        }
      } else if (request.maxBudget && parseFloat(item.priceAmount) > parseFloat(request.maxBudget)) {
        // Fallback: old maxBudget comparison for requests without budgetTiers
        continue;
      }
    }

    // Calculate spec score (0-15) and check for hard exclusions
    const specResult = calculateSpecScore(request.details, item.details, specDefs);
    if (specResult.excluded) {
      continue; // Hard exclude: required spec didn't match
    }

    // Calculate text relevance
    const { score: textRelevance, titleMatch } = calculateTextRelevance(request, item);

    // Skip items with very low text relevance (unless same category with no keywords)
    const sameCategory = item.category === request.category;
    if (textRelevance < 10 && !sameCategory) {
      continue;
    }

    // For same category but different items, require some text relevance
    if (sameCategory && textRelevance < 5 && requestKeywords.length > 0) {
      // Check if at least one keyword matches
      const hasAnyMatch = requestKeywords.some(keyword => {
        const itemText = (item.title + ' ' + (item.description || '')).toLowerCase();
        return itemText.includes(keyword);
      });
      if (!hasAnyMatch) {
        continue; // Skip items in same category but with no keyword overlap
      }
    }

    // Calculate match score (0-100), now including spec score
    const matchScore = calculateMatchScore(request, item, distance, textRelevance, titleMatch, specResult.score);

    matches.push({
      requestId: request.id,
      itemId: item.id,
      distanceMiles: distance,
      matchScore,
      lenderNotified: false,
      lenderResponse: 'pending',
    });
  }

  // Create all matches in database
  if (matches.length > 0) {
    await prisma.match.createMany({
      data: matches,
    });

    // Update request status to matched
    await prisma.request.update({
      where: { id: requestId },
      data: { status: 'matched' },
    });

    // Notify each item owner (lender) of the match
    const requesterFullName = [request.requester.firstName, request.requester.lastName].filter(Boolean).join(' ');
    for (const matchData of matches) {
      const item = items.find(i => i.id === matchData.itemId);
      if (item) {
        // Format price for notification
        let itemPrice = null;
        if (item.pricingType === 'free') {
          itemPrice = 'Free';
        } else if (item.priceAmount) {
          itemPrice = `$${item.priceAmount}/${item.pricingType}`;
        }

        await notifyUser(item.ownerId, 'match_created', {
          matchId: matchData.itemId, // Will be replaced with actual match ID after fetching
          requestId: request.id,
          itemId: item.id,
          itemTitle: item.title,
          itemPrice,
          requesterId: request.requesterId,
          requesterName: requesterFullName,
        });
      }
    }
  }

  // Return created matches with full details
  return prisma.match.findMany({
    where: { requestId },
    include: {
      item: {
        include: { owner: true },
      },
    },
    orderBy: { matchScore: 'desc' },
  });
}

/**
 * Compare price using matching budget tiers when available.
 * Returns a ratio (0-1+) where >= 1 means budget covers the price, or null if no tier match.
 * @param {object} request - The request with details.budgetTiers
 * @param {object} item - The item with pricingType and priceAmount
 * @returns {number|null} Score ratio or null if tier data unavailable
 */
function getTierPriceScore(request, item) {
  const budgetTiers = request.details?.budgetTiers;
  const pricingType = item.pricingType;
  const priceAmount = parseFloat(item.priceAmount);

  if (!budgetTiers || !pricingType || pricingType === 'free' || isNaN(priceAmount) || priceAmount === 0) {
    return null;
  }

  // Direct tier match (e.g. both have 'daily')
  if (budgetTiers[pricingType]) {
    const budget = budgetTiers[pricingType];
    return budget >= priceAmount ? 1 : budget / priceAmount;
  }

  // No matching tier found
  return null;
}

/**
 * Calculate match score based on various factors
 * @param {object} request - The request object
 * @param {object} item - The item object with owner
 * @param {number} distance - Distance in miles
 * @param {number} textRelevance - Text relevance score (0-100)
 * @param {boolean} titleMatch - Whether titles match exactly
 * @param {number} specScore - Spec matching score (0-15), default 0
 * @returns {number} Score from 0-100
 */
function calculateMatchScore(request, item, distance, textRelevance, titleMatch, specScore = 0) {
  // EXACT TITLE MATCH = HIGH SCORE (88-95 range)
  // "Pressure Washer" requesting "Pressure Washer" should be ~90-95%
  if (titleMatch) {
    let score = 88;

    // Add small bonuses for other factors
    if (item.category === request.category) score += 2;
    if (item.pricingType === 'free') score += 2;
    else if (item.priceAmount) {
      const tierScore = getTierPriceScore(request, item);
      if (tierScore !== null) {
        // Tier-aware: full 2 points if budget >= price, proportional otherwise
        score += tierScore >= 1 ? 2 : Math.round(tierScore * 2);
      } else if (!request.maxBudget || parseFloat(item.priceAmount) <= parseFloat(request.maxBudget)) {
        score += 1;
      }
    }

    // Owner rating bonus (up to 2 points)
    const ratings = item.owner?.ratingsReceived || [];
    if (ratings.length > 0) {
      const avgRating = ratings.reduce((sum, r) => sum + r.overallRating, 0) / ratings.length;
      score += (avgRating / 5) * 2;
    }

    // Small distance penalty (max -3)
    const maxDistance = parseFloat(request.maxDistanceMiles);
    const distancePenalty = Math.min(3, (distance / maxDistance) * 3);
    score -= distancePenalty;

    // Cap exact matches at 95% - 100% should be impossible
    return Math.max(85, Math.min(95, Math.round(score)));
  }

  // For non-exact matches, use weighted scoring
  let score = 0;

  // TEXT RELEVANCE is the primary factor (reduced from 60 to 45 to make room for specs)
  const textScore = (textRelevance / 100) * 45;
  score += textScore;

  // SPEC SCORE: up to 15 points based on spec matching
  score += specScore;

  // Category match bonus (8 points)
  if (item.category === request.category) {
    score += 8;
  }

  // Distance factor: up to 12 points (closer = better)
  const maxDistance = parseFloat(request.maxDistanceMiles);
  const distanceScore = ((maxDistance - distance) / maxDistance) * 12;
  score += Math.max(0, distanceScore);

  // Price factor: up to 8 points based on price fit
  if (item.pricingType === 'free') {
    score += 8;
  } else if (item.priceAmount) {
    const tierScore = getTierPriceScore(request, item);
    if (tierScore !== null) {
      // Tier-aware scoring: budget >= price = full 8 pts, otherwise proportional
      score += tierScore >= 1 ? 8 : 8 * tierScore;
    } else if (request.maxBudget) {
      // Fallback: old maxBudget logic
      const priceRatio = parseFloat(item.priceAmount) / parseFloat(request.maxBudget);
      if (priceRatio <= 1) {
        score += 8 * (1 - priceRatio * 0.5);
      }
    } else {
      // No budget specified - neutral
      score += 4;
    }
  } else {
    // No price on item - neutral
    score += 4;
  }

  // Condition factor: up to 4 points based on item condition
  const conditionScores = { new: 4, excellent: 3, good: 2, fair: 1, poor: 0 };
  score += conditionScores[item.condition] || 0;

  // Owner rating factor: up to 6 points
  const ratings = item.owner?.ratingsReceived || [];
  if (ratings.length > 0) {
    const avgRating = ratings.reduce((sum, r) => sum + r.overallRating, 0) / ratings.length;
    score += (avgRating / 5) * 6;
  }

  // Cap non-exact matches at 98% - 100% should be impossible
  return Math.max(0, Math.min(98, Math.round(score)));
}

module.exports = { findMatchesForRequest, calculateMatchScore, calculateTextRelevance, calculateSpecScore, extractKeywords };
