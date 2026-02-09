const prisma = require('../config/database');
const { findMatchesForRequest } = require('../utils/matching');
const { getSpecsForItem, validateBorrowerSpecs } = require('../utils/specUtils');

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

  // Set expiration to 48 hours from now
  const expiresAt = new Date();
  expiresAt.setHours(expiresAt.getHours() + 48);

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
      expiresAt,
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
  if (request.matches) {
    for (const match of request.matches) {
      if (match.item?.owner?.ratingsReceived) {
        const ratings = match.item.owner.ratingsReceived;
        match.item.owner.averageRating = ratings.length > 0
          ? parseFloat((ratings.reduce((sum, r) => sum + r.overallRating, 0) / ratings.length).toFixed(2))
          : null;
        match.item.owner.totalRatings = ratings.length;
        delete match.item.owner.ratingsReceived;
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

  const [requests, total] = await Promise.all([
    prisma.request.findMany({
      where,
      include: {
        _count: { select: { matches: true } },
        matches: {
          where: { lenderResponse: 'accepted' },
          take: 1,
        },
      },
      orderBy: { createdAt: 'desc' },
      take: parseInt(limit),
      skip: parseInt(offset),
    }),
    prisma.request.count({ where }),
  ]);

  res.json({
    requests,
    pagination: {
      total,
      limit: parseInt(limit),
      offset: parseInt(offset),
    },
  });
}

/**
 * Cancel a request
 * PUT /api/requests/:id/cancel
 */
async function cancelRequest(req, res) {
  const { id } = req.params;

  const request = await prisma.request.findUnique({
    where: { id },
  });

  if (!request) {
    return res.status(404).json({ error: 'Request not found' });
  }

  if (request.requesterId !== req.user.id) {
    return res.status(403).json({ error: 'Not authorized to cancel this request' });
  }

  if (request.status === 'cancelled') {
    return res.status(400).json({ error: 'Request is already cancelled' });
  }

  if (request.status === 'accepted') {
    return res.status(400).json({ error: 'Cannot cancel an accepted request. Cancel the transaction instead.' });
  }

  const updatedRequest = await prisma.request.update({
    where: { id },
    data: { status: 'cancelled' },
  });

  res.json(updatedRequest);
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
      take: parseInt(limit),
      skip: parseInt(offset),
    }),
    prisma.request.count({ where }),
  ]);

  // Calculate distance if coordinates provided
  let resultsWithDistance = requests;
  if (latitude && longitude) {
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
      });
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
      limit: parseInt(limit),
      offset: parseInt(offset),
    },
  });
}

module.exports = { createRequest, getRequest, getMyRequests, cancelRequest, getRequestMatches, browseRequests };
