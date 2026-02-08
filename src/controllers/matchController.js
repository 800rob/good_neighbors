const prisma = require('../config/database');
const { notifyUser } = require('../services/notificationService');

/**
 * Respond to a match (lender accepts or declines)
 * PUT /api/matches/:id/respond
 */
async function respondToMatch(req, res) {
  const { id } = req.params;
  const { response } = req.body; // 'accepted' or 'declined'

  if (!['accepted', 'declined'].includes(response)) {
    return res.status(400).json({ error: 'Response must be "accepted" or "declined"' });
  }

  const match = await prisma.match.findUnique({
    where: { id },
    include: {
      item: true,
      request: true,
    },
  });

  if (!match) {
    return res.status(404).json({ error: 'Match not found' });
  }

  // Verify the current user is the item owner (lender)
  if (match.item.ownerId !== req.user.id) {
    return res.status(403).json({ error: 'Not authorized to respond to this match' });
  }

  // Check if already responded
  if (match.lenderResponse !== 'pending') {
    return res.status(400).json({ error: 'Already responded to this match' });
  }

  // Check if request is still open
  if (match.request.status === 'cancelled' || match.request.status === 'expired') {
    return res.status(400).json({ error: 'Request is no longer active' });
  }

  // Update match response
  const updatedMatch = await prisma.match.update({
    where: { id },
    data: {
      lenderResponse: response,
      respondedAt: new Date(),
    },
    include: {
      item: {
        include: {
          owner: {
            select: { id: true, firstName: true, lastName: true, neighborhood: true },
          },
        },
      },
      request: {
        include: {
          requester: {
            select: { id: true, firstName: true, lastName: true, neighborhood: true },
          },
        },
      },
    },
  });

  // If accepted, update request status
  if (response === 'accepted') {
    await prisma.request.update({
      where: { id: match.requestId },
      data: { status: 'accepted' },
    });
  }

  // Notify the requester (borrower) of the response
  const notificationType = response === 'accepted' ? 'match_accepted' : 'match_declined';
  const lenderFullName = [updatedMatch.item.owner.firstName, updatedMatch.item.owner.lastName].filter(Boolean).join(' ');
  await notifyUser(updatedMatch.request.requesterId, notificationType, {
    matchId: updatedMatch.id,
    itemId: updatedMatch.item.id,
    itemTitle: updatedMatch.item.title,
    lenderId: updatedMatch.item.owner.id,
    lenderName: lenderFullName,
    requestId: updatedMatch.requestId,
  });

  res.json({
    match: updatedMatch,
    message: response === 'accepted'
      ? 'Match accepted! The borrower can now create a transaction.'
      : 'Match declined.',
  });
}

/**
 * Get matches for items owned by current user (lender view)
 * GET /api/matches/incoming
 */
async function getIncomingMatches(req, res) {
  const { status = 'pending', limit = 20, offset = 0 } = req.query;

  // Get all items owned by user
  const userItems = await prisma.item.findMany({
    where: { ownerId: req.user.id },
    select: { id: true },
  });

  const itemIds = userItems.map(item => item.id);

  const where = {
    itemId: { in: itemIds },
    lenderResponse: status,
    request: {
      status: { in: ['open', 'matched'] },
      expiresAt: { gt: new Date() },
    },
  };

  const [matches, total] = await Promise.all([
    prisma.match.findMany({
      where,
      include: {
        item: true,
        request: {
          include: {
            requester: {
              select: {
                id: true, firstName: true, lastName: true, neighborhood: true, profilePhotoUrl: true,
                ratingsReceived: { select: { overallRating: true } },
              },
            },
          },
        },
      },
      orderBy: { createdAt: 'desc' },
      take: parseInt(limit),
      skip: parseInt(offset),
    }),
    prisma.match.count({ where }),
  ]);

  // Compute averageRating / totalRatings for each requester, strip raw ratings
  const enrichedMatches = matches.map(match => {
    const ratings = match.request?.requester?.ratingsReceived || [];
    const totalRatings = ratings.length;
    const averageRating = totalRatings > 0
      ? parseFloat((ratings.reduce((sum, r) => sum + r.overallRating, 0) / totalRatings).toFixed(2))
      : null;
    return {
      ...match,
      request: {
        ...match.request,
        requester: {
          ...match.request.requester,
          ratingsReceived: undefined,
          averageRating,
          totalRatings,
        },
      },
    };
  });

  res.json({
    matches: enrichedMatches,
    pagination: {
      total,
      limit: parseInt(limit),
      offset: parseInt(offset),
    },
  });
}

module.exports = { respondToMatch, getIncomingMatches };
