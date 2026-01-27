const prisma = require('../config/database');
const { findMatchesForRequest } = require('../utils/matching');

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
  } = req.body;

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
    },
    include: {
      requester: {
        select: { id: true, fullName: true, neighborhood: true },
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
        select: { id: true, fullName: true, neighborhood: true, profilePhotoUrl: true },
      },
      matches: {
        include: {
          item: {
            include: {
              owner: {
                select: { id: true, fullName: true, neighborhood: true },
              },
            },
          },
        },
        orderBy: { matchScore: 'desc' },
      },
    },
  });

  if (!request) {
    return res.status(404).json({ error: 'Request not found' });
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
              fullName: true,
              neighborhood: true,
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

module.exports = { createRequest, getRequest, getMyRequests, cancelRequest, getRequestMatches };
