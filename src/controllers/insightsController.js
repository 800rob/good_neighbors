const prisma = require('../config/database');
const { calculateDistance } = require('../utils/distance');

/**
 * Get nearby demand insights for a lender
 * Shows how many open requests match the user's listed items
 * GET /api/insights/nearby-demand
 */
async function getNearbyDemand(req, res) {
  const userId = req.user.id;
  const { radiusMiles = 10, expandedRadiusMiles = 25 } = req.query;

  // Get user's items with their categories
  const userItems = await prisma.item.findMany({
    where: { ownerId: userId, isAvailable: true },
    select: { id: true, category: true, title: true },
  });

  if (userItems.length === 0) {
    return res.json({
      nearbyDemand: {
        count: 0,
        requests: [],
        message: 'List items to see nearby demand',
      },
      expandedDemand: {
        count: 0,
        additionalCount: 0,
        radiusMiles: parseFloat(expandedRadiusMiles),
      },
    });
  }

  // Get user's location
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { latitude: true, longitude: true },
  });

  if (!user?.latitude || !user?.longitude) {
    return res.json({
      nearbyDemand: {
        count: 0,
        requests: [],
        message: 'Set your location to see nearby demand',
      },
      expandedDemand: {
        count: 0,
        additionalCount: 0,
        radiusMiles: parseFloat(expandedRadiusMiles),
      },
    });
  }

  const userLat = parseFloat(user.latitude);
  const userLng = parseFloat(user.longitude);
  const userCategories = [...new Set(userItems.map(i => i.category))];

  // Find open requests in matching categories (excluding user's own)
  const openRequests = await prisma.request.findMany({
    where: {
      status: { in: ['open', 'matched'] },
      requesterId: { not: userId },
      category: { in: userCategories },
    },
    include: {
      requester: {
        select: { id: true, firstName: true, lastName: true, neighborhood: true },
      },
      _count: { select: { matches: true } },
    },
    orderBy: { createdAt: 'desc' },
  });

  // Calculate distances and filter
  const nearbyRequests = [];
  const expandedRequests = [];

  for (const request of openRequests) {
    const distance = calculateDistance(
      userLat,
      userLng,
      parseFloat(request.latitude),
      parseFloat(request.longitude)
    );

    const requestWithDistance = {
      id: request.id,
      title: request.title,
      category: request.category,
      neededFrom: request.neededFrom,
      neededUntil: request.neededUntil,
      maxBudget: request.maxBudget,
      distance: Math.round(distance * 10) / 10,
      requester: {
        firstName: request.requester.firstName,
        neighborhood: request.requester.neighborhood,
      },
      matchCount: request._count.matches,
    };

    if (distance <= parseFloat(radiusMiles)) {
      nearbyRequests.push(requestWithDistance);
    } else if (distance <= parseFloat(expandedRadiusMiles)) {
      expandedRequests.push(requestWithDistance);
    }
  }

  // Sort by distance
  nearbyRequests.sort((a, b) => a.distance - b.distance);
  expandedRequests.sort((a, b) => a.distance - b.distance);

  res.json({
    nearbyDemand: {
      count: nearbyRequests.length,
      requests: nearbyRequests.slice(0, 10), // Top 10
      radiusMiles: parseFloat(radiusMiles),
    },
    expandedDemand: {
      count: nearbyRequests.length + expandedRequests.length,
      additionalCount: expandedRequests.length,
      radiusMiles: parseFloat(expandedRadiusMiles),
      requests: expandedRequests.slice(0, 5), // Top 5 expanded
    },
  });
}

/**
 * Get nearby supply insights for a borrower
 * Shows how many available items match the user's open requests
 * GET /api/insights/nearby-supply
 */
async function getNearbySupply(req, res) {
  const userId = req.user.id;
  const { radiusMiles = 10, expandedRadiusMiles = 25 } = req.query;

  // Get user's open requests
  const userRequests = await prisma.request.findMany({
    where: {
      requesterId: userId,
      status: { in: ['open', 'matched'] },
    },
    select: { id: true, category: true, title: true, latitude: true, longitude: true, maxDistanceMiles: true },
  });

  if (userRequests.length === 0) {
    return res.json({
      nearbySupply: {
        count: 0,
        items: [],
        message: 'Post a request to see nearby supply',
      },
      expandedSupply: {
        count: 0,
        additionalCount: 0,
        radiusMiles: parseFloat(expandedRadiusMiles),
      },
    });
  }

  // Get user's location from their requests or profile
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { latitude: true, longitude: true },
  });

  const userLat = parseFloat(user?.latitude || userRequests[0]?.latitude || 0);
  const userLng = parseFloat(user?.longitude || userRequests[0]?.longitude || 0);

  if (!userLat || !userLng) {
    return res.json({
      nearbySupply: {
        count: 0,
        items: [],
        message: 'Set your location to see nearby supply',
      },
      expandedSupply: {
        count: 0,
        additionalCount: 0,
        radiusMiles: parseFloat(expandedRadiusMiles),
      },
    });
  }

  const userCategories = [...new Set(userRequests.map(r => r.category))];

  // Find available items in matching categories (excluding user's own)
  const availableItems = await prisma.item.findMany({
    where: {
      isAvailable: true,
      ownerId: { not: userId },
      category: { in: userCategories },
    },
    include: {
      owner: {
        select: { id: true, firstName: true, lastName: true, neighborhood: true, latitude: true, longitude: true },
      },
    },
    orderBy: { createdAt: 'desc' },
  });

  // Calculate distances and filter
  const nearbyItems = [];
  const expandedItems = [];

  for (const item of availableItems) {
    const ownerLat = parseFloat(item.owner.latitude || 0);
    const ownerLng = parseFloat(item.owner.longitude || 0);

    if (!ownerLat || !ownerLng) continue;

    const distance = calculateDistance(userLat, userLng, ownerLat, ownerLng);

    const itemWithDistance = {
      id: item.id,
      title: item.title,
      category: item.category,
      pricingType: item.pricingType,
      priceAmount: item.priceAmount,
      condition: item.condition,
      distance: Math.round(distance * 10) / 10,
      owner: {
        firstName: item.owner.firstName,
        neighborhood: item.owner.neighborhood,
      },
    };

    if (distance <= parseFloat(radiusMiles)) {
      nearbyItems.push(itemWithDistance);
    } else if (distance <= parseFloat(expandedRadiusMiles)) {
      expandedItems.push(itemWithDistance);
    }
  }

  // Sort by distance
  nearbyItems.sort((a, b) => a.distance - b.distance);
  expandedItems.sort((a, b) => a.distance - b.distance);

  res.json({
    nearbySupply: {
      count: nearbyItems.length,
      items: nearbyItems.slice(0, 10), // Top 10
      radiusMiles: parseFloat(radiusMiles),
    },
    expandedSupply: {
      count: nearbyItems.length + expandedItems.length,
      additionalCount: expandedItems.length,
      radiusMiles: parseFloat(expandedRadiusMiles),
      items: expandedItems.slice(0, 5), // Top 5 expanded
    },
  });
}

module.exports = {
  getNearbyDemand,
  getNearbySupply,
};
