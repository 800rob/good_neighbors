const prisma = require('../config/database');
const { refreshMatchGroups } = require('../utils/matchGrouping');

/**
 * Get borrower's multi-match opportunities (match groups)
 * GET /api/match-groups/borrower
 */
async function getBorrowerMatchGroups(req, res) {
  const parsedLimit = Math.min(Math.max(parseInt(req.query.limit) || 20, 1), 100);
  const parsedOffset = Math.max(parseInt(req.query.offset) || 0, 0);

  const where = {
    borrowerId: req.user.id,
    status: { not: 'expired' },
  };

  const [groups, total] = await Promise.all([
    prisma.matchGroup.findMany({
      where,
      include: {
        lender: {
          select: {
            id: true, firstName: true, lastName: true,
            neighborhood: true, profilePhotoUrl: true,
          },
        },
      },
      orderBy: { score: 'desc' },
      take: parsedLimit,
      skip: parsedOffset,
    }),
    prisma.matchGroup.count({ where }),
  ]);

  // For each group, fetch the actual matches
  const enrichedGroups = await Promise.all(groups.map(async (group) => {
    const matches = await prisma.match.findMany({
      where: {
        request: {
          requesterId: group.borrowerId,
          status: { in: ['open', 'matched', 'accepted'] },
        },
        item: { ownerId: group.lenderId },
        lenderResponse: { not: 'declined' },
      },
      include: {
        item: {
          include: {
            owner: {
              select: {
                id: true, firstName: true, lastName: true,
                neighborhood: true, profilePhotoUrl: true,
              },
            },
          },
        },
        request: {
          select: {
            id: true, title: true, status: true,
            neededFrom: true, neededUntil: true,
            categoryTier1: true, categoryTier2: true, categoryTier3: true,
          },
        },
      },
      orderBy: { matchScore: 'desc' },
    });

    return { ...group, matches };
  }));

  res.json({
    matchGroups: enrichedGroups,
    pagination: { total, limit: parsedLimit, offset: parsedOffset },
  });
}

/**
 * Get lender's grouped incoming matches
 * GET /api/match-groups/lender
 */
async function getLenderMatchGroups(req, res) {
  const parsedLimit = Math.min(Math.max(parseInt(req.query.limit) || 20, 1), 100);
  const parsedOffset = Math.max(parseInt(req.query.offset) || 0, 0);

  const where = {
    lenderId: req.user.id,
    status: { not: 'expired' },
  };

  const [groups, total] = await Promise.all([
    prisma.matchGroup.findMany({
      where,
      include: {
        borrower: {
          select: {
            id: true, firstName: true, lastName: true,
            neighborhood: true, profilePhotoUrl: true,
          },
        },
      },
      orderBy: { score: 'desc' },
      take: parsedLimit,
      skip: parsedOffset,
    }),
    prisma.matchGroup.count({ where }),
  ]);

  // For each group, fetch the actual matches
  const enrichedGroups = await Promise.all(groups.map(async (group) => {
    const matches = await prisma.match.findMany({
      where: {
        request: {
          requesterId: group.borrowerId,
          status: { in: ['open', 'matched', 'accepted'] },
        },
        item: { ownerId: group.lenderId },
        lenderResponse: { not: 'declined' },
      },
      include: {
        item: {
          select: {
            id: true, title: true, photoUrls: true,
            pricingType: true, priceAmount: true,
            protectionPreference: true, condition: true,
          },
        },
        request: {
          include: {
            requester: {
              select: {
                id: true, firstName: true, lastName: true,
                neighborhood: true, profilePhotoUrl: true,
              },
            },
          },
        },
      },
      orderBy: { matchScore: 'desc' },
    });

    return { ...group, matches };
  }));

  res.json({
    matchGroups: enrichedGroups,
    pagination: { total, limit: parsedLimit, offset: parsedOffset },
  });
}

/**
 * Lender batch responds to a match group
 * POST /api/match-groups/:id/respond
 */
async function respondToMatchGroup(req, res) {
  const { id } = req.params;
  const { matchResponses } = req.body;

  if (!Array.isArray(matchResponses) || matchResponses.length === 0) {
    return res.status(400).json({ error: 'matchResponses array is required' });
  }

  // Validate each response entry
  for (const mr of matchResponses) {
    if (!mr.matchId || !['accepted', 'declined'].includes(mr.response)) {
      return res.status(400).json({ error: 'Each matchResponse must have matchId and response ("accepted" or "declined")' });
    }
  }

  // Fetch the match group
  const matchGroup = await prisma.matchGroup.findUnique({
    where: { id },
  });

  if (!matchGroup) {
    return res.status(404).json({ error: 'Match group not found' });
  }

  if (matchGroup.lenderId !== req.user.id) {
    return res.status(403).json({ error: 'Not authorized to respond to this match group' });
  }

  const matchIds = matchResponses.map(mr => mr.matchId);
  const responseMap = Object.fromEntries(matchResponses.map(mr => [mr.matchId, mr.response]));

  // Fetch all matches and validate they belong to this group
  const matches = await prisma.match.findMany({
    where: { id: { in: matchIds } },
    include: {
      item: {
        include: {
          owner: {
            select: { id: true, firstName: true, lastName: true, state: true },
          },
        },
      },
      request: {
        include: {
          requester: {
            select: { id: true, firstName: true, lastName: true },
          },
        },
      },
    },
  });

  if (matches.length !== matchIds.length) {
    return res.status(404).json({ error: 'One or more matches not found' });
  }

  // Validate all matches belong to this group's borrower-lender pair
  for (const match of matches) {
    if (match.item.ownerId !== matchGroup.lenderId) {
      return res.status(400).json({ error: `Match ${match.id} does not belong to this match group` });
    }
    if (match.request.requesterId !== matchGroup.borrowerId) {
      return res.status(400).json({ error: `Match ${match.id} does not belong to this match group` });
    }
    if (match.lenderResponse !== 'pending') {
      return res.status(400).json({ error: `Match ${match.id} has already been responded to` });
    }
  }

  // Process all responses
  const updatedMatches = await prisma.$transaction(async (tx) => {
    const updated = [];
    for (const match of matches) {
      const response = responseMap[match.id];
      const updatedMatch = await tx.match.update({
        where: { id: match.id },
        data: {
          lenderResponse: response,
          respondedAt: new Date(),
        },
        include: {
          item: true,
          request: {
            include: {
              requester: {
                select: { id: true, firstName: true, lastName: true },
              },
            },
          },
        },
      });
      updated.push(updatedMatch);
    }
    return updated;
  });

  // Determine new group status
  const acceptedCount = matchResponses.filter(mr => mr.response === 'accepted').length;
  const declinedCount = matchResponses.filter(mr => mr.response === 'declined').length;
  const totalCount = matchResponses.length;

  let newStatus;
  if (declinedCount === totalCount) {
    newStatus = 'expired';
  } else if (acceptedCount === totalCount) {
    newStatus = 'accepted';
  } else {
    newStatus = 'partial';
  }

  await prisma.matchGroup.update({
    where: { id },
    data: { status: newStatus },
  });

  // Refresh match groups (in case declining drops a group below 2)
  refreshMatchGroups(matchGroup.borrowerId).catch(err =>
    console.error('[MatchGrouping] Failed to refresh after respondToMatchGroup:', err.message)
  );

  res.json({
    matches: updatedMatches,
    groupStatus: newStatus,
    message: `Match group response processed: ${acceptedCount} accepted, ${declinedCount} declined`,
  });
}

module.exports = { getBorrowerMatchGroups, getLenderMatchGroups, respondToMatchGroup };
