const prisma = require('../config/database');
const { calculateDistance } = require('./distance');

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

  // Find matching items
  const items = await prisma.item.findMany({
    where: {
      category: request.category,
      isAvailable: true,
      ownerId: { not: request.requesterId }, // Exclude requester's own items
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

    // Skip if price exceeds budget (when both are set)
    if (
      request.maxBudget &&
      item.priceAmount &&
      parseFloat(item.priceAmount) > parseFloat(request.maxBudget)
    ) {
      continue;
    }

    // Calculate match score (0-100)
    const matchScore = calculateMatchScore(request, item, distance);

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
 * Calculate match score based on various factors
 * @param {object} request - The request object
 * @param {object} item - The item object with owner
 * @param {number} distance - Distance in miles
 * @returns {number} Score from 0-100
 */
function calculateMatchScore(request, item, distance) {
  let score = 100;

  // Distance factor: lose up to 30 points based on distance
  const maxDistance = parseFloat(request.maxDistanceMiles);
  const distancePenalty = (distance / maxDistance) * 30;
  score -= distancePenalty;

  // Price factor: lose up to 25 points based on price
  if (request.maxBudget && item.priceAmount) {
    const priceRatio = parseFloat(item.priceAmount) / parseFloat(request.maxBudget);
    const pricePenalty = priceRatio * 25;
    score -= pricePenalty;
  } else if (item.pricingType === 'free') {
    // Bonus for free items
    score += 10;
  }

  // Owner rating factor: up to 20 points based on rating
  const ratings = item.owner.ratingsReceived || [];
  if (ratings.length > 0) {
    const avgRating =
      ratings.reduce((sum, r) => sum + r.overallRating, 0) / ratings.length;
    const ratingBonus = (avgRating / 5) * 20;
    score += ratingBonus;
  }

  // Condition factor: up to 15 points based on item condition
  const conditionScores = { new: 15, excellent: 12, good: 8, fair: 4, poor: 0 };
  score += conditionScores[item.condition] || 0;

  // Clamp score between 0 and 100
  return Math.max(0, Math.min(100, Math.round(score)));
}

module.exports = { findMatchesForRequest, calculateMatchScore };
