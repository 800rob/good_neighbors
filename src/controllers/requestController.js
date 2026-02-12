const prisma = require('../config/database');
const { findMatchesForRequest } = require('../utils/matching');
const { getSpecsForItem, validateBorrowerSpecs } = require('../utils/specUtils');
const { isAvailableForDates, getItemIdsWithConflicts } = require('../utils/dateConflict');

/**
 * Create a new request (borrower posts need)
 * POST /api/requests
 */
async function createRequest(req, res) {
  const {
    category,
    title,
    description,
    neededFrom,
    neededUntil,
    maxBudget,
    maxDistanceMiles = 10,
    latitude,
    longitude,
    // New hierarchical category fields
    listingType,
    categoryTier1,
    categoryTier2,
    categoryTier3,
    isOther,
    customNeed,
    // Specs/details
    details,
  } = req.body;

  // Validate specs if provided
  if (details && details.specs && listingType && categoryTier1 && categoryTier2 && categoryTier3) {
    const specDefs = getSpecsForItem(listingType, categoryTier1, categoryTier2, categoryTier3);
    if (specDefs) {
      const validation = validateBorrowerSpecs(specDefs, details.specs);
      if (!validation.valid) {
        return res.status(400).json({ error: 'Invalid specs', details: validation.errors });
      }
    }
  }

  // Use requester's location if not provided
  const reqLat = latitude || req.user.latitude;
  const reqLon = longitude || req.user.longitude;

  if (!reqLat || !reqLon) {
    return res.status(400).json({
      error: 'Location required. Please provide latitude/longitude or update your profile with a location.',
    });
  }

  const request = await prisma.request.create({
    data: {
      requesterId: req.user.id,
      category,
      title,
      description,
      neededFrom: new Date(neededFrom),
      neededUntil: new Date(neededUntil),
      maxBudget: maxBudget ? parseFloat(maxBudget) : null,
      maxDistanceMiles: parseFloat(maxDistanceMiles),
      latitude: parseFloat(reqLat),
      longitude: parseFloat(reqLon),
      // New hierarchical category fields
      listingType: listingType || null,
      categoryTier1: categoryTier1 || null,
      categoryTier2: categoryTier2 || null,
      categoryTier3: categoryTier3 || null,
      isOther: isOther || false,
      customNeed: customNeed || null,
      details: details || {},
    },
    include: {
      requester: {
        select: { id: true, firstName: true, lastName: true, neighborhood: true },
      },
    },
  });

  // Auto-generate matches
  const matches = await findMatchesForRequest(request.id);

  res.status(201).json({
    request,
    matchesFound: matches.length,
    matches: matches.slice(0, 5), // Return top 5 matches
  });
}

/**
 * Get request details
 * GET /api/requests/:id
 */
async function getRequest(req, res) {
  const { id } = req.params;

  const request = await prisma.request.findUnique({
    where: { id },
    include: {
      requester: {
        select: { id: true, firstName: true, lastName: true, neighborhood: true, profilePhotoUrl: true },
      },
      matches: {
        include: {
          item: {
            include: {
              owner: {
                select: {
                  id: true, firstName: true, lastName: true, neighborhood: true, state: true,
                  ratingsReceived: { select: { overallRating: true } },
                },
              },
            },
          },
        },
        orderBy: { matchScore: 'desc' },
      },
      transactions: {
        select: { id: true, itemId: true, status: true },
      },
    },
  });

  if (!request) {
    return res.status(404).json({ error: 'Request not found' });
  }

  // Compute averageRating for each match's item owner
  // and re-validate date availability for each match
  if (request.matches) {
    // Batch check date conflicts for all matched items
    let conflictedItemIds = new Set();
    if (request.neededFrom && request.neededUntil) {
      const itemIds = request.matches.map(m => m.item?.id).filter(Boolean);
      if (itemIds.length > 0) {
        conflictedItemIds = await getItemIdsWithConflicts(itemIds, request.neededFrom, request.neededUntil);
      }
    }

    for (const match of request.matches) {
      if (match.item?.owner?.ratingsReceived) {
        const ratings = match.item.owner.ratingsReceived;
        match.item.owner.averageRating = ratings.length > 0
          ? parseFloat((ratings.reduce((sum, r) => sum + r.overallRating, 0) / ratings.length).toFixed(2))
          : null;
        match.item.owner.totalRatings = ratings.length;
        delete match.item.owner.ratingsReceived;
      }

      // Annotate with real-time date availability
      if (request.neededFrom && request.neededUntil && match.item) {
        const rulesOk = isAvailableForDates(match.item, request.neededFrom, request.neededUntil);
        const noConflict = !conflictedItemIds.has(match.item.id);
        match.dateAvailable = rulesOk && noConflict;
      } else {
        match.dateAvailable = true; // No dates to check, assume available
      }
    }
  }

  res.json(request);
}

/**
 * Get current user's requests
 * GET /api/requests/my-requests
 */
async function getMyRequests(req, res) {
  const { status, limit = 20, offset = 0 } = req.query;

  const where = { requesterId: req.user.id };
  if (status) where.status = status;

  const parsedLimit = Math.min(Math.max(parseInt(limit) || 20, 1), 100);
  const parsedOffset = Math.max(parseInt(offset) || 0, 0);

  const [requests, total] = await Promise.all([
    prisma.request.findMany({
      where,
      include: {
        _count: { select: { matches: true } },
        matches: {
          where: { lenderResponse: { not: 'declined' } },
          include: {
            item: {
              select: { id: true, details: true, availableFrom: true, availableUntil: true },
            },
          },
        },
      },
      orderBy: { createdAt: 'desc' },
      take: parsedLimit,
      skip: parsedOffset,
    }),
    prisma.request.count({ where }),
  ]);

  // Re-validate match availability for open/matched requests
  // Batch-check date conflicts for all matched items
  const activeRequests = requests.filter(r =>
    ['open', 'matched'].includes(r.status) && r.matches.length > 0 && r.neededFrom && r.neededUntil
  );

  const allMatchedItemIds = activeRequests.flatMap(r => r.matches.map(m => m.item?.id).filter(Boolean));

  let conflictedItemIds = new Set();
  if (allMatchedItemIds.length > 0 && activeRequests.length > 0) {
    // Use the first request's dates as a baseline for batch conflict check
    // Each request may have different dates, so we check per-request below
    const uniqueItemIds = [...new Set(allMatchedItemIds)];
    // We'll check per-request instead of batch since dates differ
    for (const r of activeRequests) {
      const itemIds = r.matches.map(m => m.item?.id).filter(Boolean);
      if (itemIds.length > 0) {
        const conflicts = await getItemIdsWithConflicts(itemIds, r.neededFrom, r.neededUntil);
        for (const id of conflicts) conflictedItemIds.add(`${r.id}:${id}`);
      }
    }
  }

  const enrichedRequests = requests.map(r => {
    let availableMatchCount = r._count.matches;

    if (['open', 'matched'].includes(r.status) && r.neededFrom && r.neededUntil) {
      availableMatchCount = r.matches.filter(m => {
        if (!m.item) return false;
        // Check custom availability rules
        if (!isAvailableForDates(m.item, r.neededFrom, r.neededUntil)) return false;
        // Check booking conflicts
        if (conflictedItemIds.has(`${r.id}:${m.item.id}`)) return false;
        return true;
      }).length;
    }

    // Strip match item details from response (not needed by frontend list views)
    const { matches, ...rest } = r;
    return { ...rest, availableMatchCount };
  });

  res.json({
    requests: enrichedRequests,
    pagination: { total, limit: parsedLimit, offset: parsedOffset },
  });
}

/**
 * Cancel a request
 * PUT /api/requests/:id/cancel
 */
async function cancelRequest(req, res) {
  const { id } = req.params;

  try {
    const updatedRequest = await prisma.$transaction(async (tx) => {
      const request = await tx.request.findUnique({
        where: { id },
      });

      if (!request) {
        const err = new Error('Request not found');
        err.statusCode = 404;
        throw err;
      }

      if (request.requesterId !== req.user.id) {
        const err = new Error('Not authorized to cancel this request');
        err.statusCode = 403;
        throw err;
      }

      if (request.status === 'cancelled') {
        const err = new Error('Request is already cancelled');
        err.statusCode = 400;
        throw err;
      }

      if (request.status === 'accepted') {
        const err = new Error('Cannot cancel an accepted request. Cancel the transaction instead.');
        err.statusCode = 400;
        throw err;
      }

      return tx.request.update({
        where: { id },
        data: { status: 'cancelled' },
      });
    });

    res.json(updatedRequest);
  } catch (err) {
    if (err.statusCode) {
      return res.status(err.statusCode).json({ error: err.message });
    }
    throw err;
  }
}

/**
 * Get matches for a request
 * GET /api/requests/:id/matches
 */
async function getRequestMatches(req, res) {
  const { id } = req.params;

  const request = await prisma.request.findUnique({
    where: { id },
  });

  if (!request) {
    return res.status(404).json({ error: 'Request not found' });
  }

  const matches = await prisma.match.findMany({
    where: { requestId: id },
    include: {
      item: {
        include: {
          owner: {
            select: {
              id: true,
              firstName: true,
              lastName: true,
              neighborhood: true,
              state: true,
              profilePhotoUrl: true,
              latitude: true,
              longitude: true,
            },
          },
        },
      },
    },
    orderBy: { matchScore: 'desc' },
  });

  res.json(matches);
}

/**
 * Browse open requests (public, with optional auth to exclude own)
 * GET /api/requests/browse
 */
async function browseRequests(req, res) {
  const {
    search,
    listingType,
    categoryTier1,
    categoryTier2,
    categoryTier3,
    latitude,
    longitude,
    radiusMiles = 25,
    neededFrom,
    neededUntil,
    status,
    limit = 20,
    offset = 0,
  } = req.query;

  const where = {
    status: { in: status ? [].concat(status) : ['open', 'matched'] },
  };

  // Exclude current user's own requests if authenticated
  if (req.user?.id) {
    where.requesterId = { not: req.user.id };
  }

  // Hierarchical category filters
  if (listingType) where.listingType = listingType;
  if (categoryTier1) where.categoryTier1 = categoryTier1;
  if (categoryTier2) where.categoryTier2 = categoryTier2;
  if (categoryTier3) where.categoryTier3 = categoryTier3;

  // Keyword search in title and description
  if (search) {
    where.AND = where.AND || [];
    where.AND.push({
      OR: [
        { title: { contains: search, mode: 'insensitive' } },
        { description: { contains: search, mode: 'insensitive' } },
      ],
    });
  }

  // Date range overlap: request.neededFrom <= filterUntil AND request.neededUntil >= filterFrom
  if (neededFrom) {
    where.AND = where.AND || [];
    where.AND.push({
      OR: [
        { neededUntil: null },
        { neededUntil: { gte: new Date(neededFrom) } },
      ],
    });
  }
  if (neededUntil) {
    where.AND = where.AND || [];
    where.AND.push({
      OR: [
        { neededFrom: null },
        { neededFrom: { lte: new Date(neededUntil) } },
      ],
    });
  }

  const parsedLimit = Math.min(Math.max(parseInt(limit) || 20, 1), 100);
  const parsedOffset = Math.max(parseInt(offset) || 0, 0);
  const hasDistanceFilter = latitude && longitude;

  // Over-fetch when distance filtering to compensate for post-query filtering
  const fetchLimit = hasDistanceFilter ? parsedLimit * 3 : parsedLimit;

  const [requests, total] = await Promise.all([
    prisma.request.findMany({
      where,
      include: {
        requester: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            neighborhood: true,
            isVerified: true,
            profilePhotoUrl: true,
            ratingsReceived: {
              select: { overallRating: true },
            },
          },
        },
        _count: { select: { matches: true } },
      },
      orderBy: { createdAt: 'desc' },
      take: fetchLimit,
      skip: parsedOffset,
    }),
    prisma.request.count({ where }),
  ]);

  // Calculate distance if coordinates provided
  let resultsWithDistance = requests;
  if (hasDistanceFilter) {
    const lat = parseFloat(latitude);
    const lon = parseFloat(longitude);
    const { calculateDistance } = require('../utils/distance');

    resultsWithDistance = requests
      .map((r) => {
        const distance =
          r.latitude && r.longitude
            ? calculateDistance(lat, lon, r.latitude, r.longitude)
            : null;
        return { ...r, distance };
      })
      .filter((r) => {
        if (!radiusMiles || !r.distance) return true;
        return r.distance <= parseFloat(radiusMiles);
      })
      .slice(0, parsedLimit);
  }

  // Compute averageRating / totalRatings from ratingsReceived
  const enrichedResults = resultsWithDistance.map((r) => {
    const ratings = r.requester?.ratingsReceived || [];
    const avgRating = ratings.length > 0
      ? parseFloat((ratings.reduce((sum, rt) => sum + rt.overallRating, 0) / ratings.length).toFixed(2))
      : null;
    return {
      ...r,
      requester: {
        ...r.requester,
        averageRating: avgRating,
        totalRatings: ratings.length,
        ratingsReceived: undefined,
      },
    };
  });

  res.json({
    requests: enrichedResults,
    pagination: {
      total,
      limit: parsedLimit,
      offset: parsedOffset,
    },
  });
}

/**
 * Update a request
 * PUT /api/requests/:id
 */
async function updateRequest(req, res) {
  const { id } = req.params;

  const request = await prisma.request.findUnique({ where: { id } });

  if (!request) {
    return res.status(404).json({ error: 'Request not found' });
  }

  if (request.requesterId !== req.user.id) {
    return res.status(403).json({ error: 'Not authorized to edit this request' });
  }

  if (!['open', 'matched'].includes(request.status)) {
    return res.status(400).json({ error: 'Only open or matched requests can be edited' });
  }

  const {
    title,
    description,
    neededFrom,
    neededUntil,
    maxBudget,
    maxDistanceMiles,
    listingType,
    categoryTier1,
    categoryTier2,
    categoryTier3,
    isOther,
    customNeed,
    details,
  } = req.body;

  // Build update data — only include fields that were provided
  const data = {};
  if (title !== undefined) data.title = title;
  if (description !== undefined) data.description = description;
  if (neededFrom !== undefined) data.neededFrom = new Date(neededFrom);
  if (neededUntil !== undefined) data.neededUntil = new Date(neededUntil);
  if (maxBudget !== undefined) data.maxBudget = maxBudget ? parseFloat(maxBudget) : null;
  if (maxDistanceMiles !== undefined) data.maxDistanceMiles = parseFloat(maxDistanceMiles);
  if (listingType !== undefined) data.listingType = listingType;
  if (categoryTier1 !== undefined) data.categoryTier1 = categoryTier1;
  if (categoryTier2 !== undefined) data.categoryTier2 = categoryTier2;
  if (categoryTier3 !== undefined) data.categoryTier3 = categoryTier3;
  if (isOther !== undefined) data.isOther = isOther;
  if (customNeed !== undefined) data.customNeed = customNeed;
  if (details !== undefined) data.details = details;
  // Map tier1 to legacy category if category changed
  if (categoryTier1 !== undefined) {
    const TIER1_TO_LEGACY = {
      'Tools': 'tools',
      'Outdoor & Recreation': 'outdoor_recreation',
      'Party & Events': 'party_events',
      'Lawn & Garden': 'lawn_garden',
      'Vehicles & Transport': 'vehicles_transport',
      'Workspace': 'workspace',
      'Specialized Equipment': 'specialized_equipment',
      'Emergency & Cleanup': 'other',
      'Home & Repair': 'services',
      'Yard & Outdoor': 'services',
      'Automotive': 'services',
      'Moving & Hauling': 'services',
      'Cleaning': 'services',
      'Tech & Assembly': 'services',
      'Creative & Media': 'services',
      'Personal Services': 'services',
      'Event Services': 'services',
    };
    data.category = TIER1_TO_LEGACY[categoryTier1] || 'other';
  }

  const updated = await prisma.request.update({
    where: { id },
    data,
    include: {
      requester: {
        select: { id: true, firstName: true, lastName: true, neighborhood: true },
      },
    },
  });

  // Re-run matching if dates or category changed
  const datesChanged = neededFrom !== undefined || neededUntil !== undefined;
  const categoryChanged = categoryTier1 !== undefined || categoryTier2 !== undefined || categoryTier3 !== undefined;
  if (datesChanged || categoryChanged) {
    try {
      await findMatchesForRequest(id);
    } catch (err) {
      // Non-fatal — the update succeeded, just log matching error
      console.error('Re-matching after edit failed:', err.message);
    }
  }

  res.json(updated);
}

module.exports = { createRequest, getRequest, getMyRequests, cancelRequest, getRequestMatches, browseRequests, updateRequest };
