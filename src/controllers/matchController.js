const prisma = require('../config/database');
const { notifyUser } = require('../services/notificationService');
const { calculateFees } = require('../utils/feeCalculation');
const { getTaxRate } = require('../utils/taxRates');
const { hasDateConflict } = require('../utils/dateConflict');
const { refreshMatchGroups } = require('../utils/matchGrouping');

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

  // Check if request is still open
  if (match.request.status === 'cancelled' || match.request.status === 'expired') {
    return res.status(400).json({ error: 'Request is no longer active' });
  }

  // Atomically claim the match — only succeeds if still pending (prevents race condition)
  const { count } = await prisma.match.updateMany({
    where: { id, lenderResponse: 'pending' },
    data: {
      lenderResponse: response,
      respondedAt: new Date(),
    },
  });

  if (count === 0) {
    return res.status(400).json({ error: 'Already responded to this match' });
  }

  // Fetch the full updated match for the rest of the logic
  const updatedMatch = await prisma.match.findUnique({
    where: { id },
    include: {
      item: {
        include: {
          owner: {
            select: { id: true, firstName: true, lastName: true, neighborhood: true, state: true },
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

  // If accepted, wrap date conflict re-check + request update + transaction creation in a transaction
  let transaction = null;
  if (response === 'accepted') {
    // Determine protection type from item's protectionPreference
    const pref = updatedMatch.item.protectionPreference;
    let protectionType = 'waiver';
    if (pref === 'insurance_required') {
      protectionType = 'insurance';
    } else if (pref === 'deposit_required') {
      protectionType = 'deposit';
    }

    // Use request's neededFrom/neededUntil as pickup/return times
    const pickupTime = updatedMatch.request.neededFrom;
    const returnTime = updatedMatch.request.neededUntil;

    try {
      transaction = await prisma.$transaction(async (tx) => {
        // Re-check date conflicts inside the transaction
        const conflict = await hasDateConflict(updatedMatch.item.id, pickupTime, returnTime);
        if (conflict.hasConflict) {
          // Revert match response back to pending
          await tx.match.update({
            where: { id },
            data: { lenderResponse: 'pending', respondedAt: null },
          });
          const err = new Error('This item is already booked during the requested dates');
          err.statusCode = 409;
          err.conflictingPeriod = {
            pickupTime: conflict.conflictingTransaction.pickupTime,
            returnTime: conflict.conflictingTransaction.returnTime,
          };
          throw err;
        }

        // Update request status
        await tx.request.update({
          where: { id: match.requestId },
          data: { status: 'accepted' },
        });

        // Calculate fees with tax
        const taxRate = getTaxRate(updatedMatch.item.owner.state);
        const fees = calculateFees(updatedMatch.item, pickupTime, returnTime, protectionType, taxRate);

        // Create transaction in 'accepted' status
        return tx.transaction.create({
          data: {
            requestId: updatedMatch.requestId,
            itemId: updatedMatch.item.id,
            borrowerId: updatedMatch.request.requesterId,
            lenderId: updatedMatch.item.ownerId,
            pickupTime: new Date(pickupTime),
            returnTime: new Date(returnTime),
            status: 'accepted',
            rentalFee: fees.rentalFee,
            platformFee: fees.platformFee,
            taxRate: fees.taxRate,
            taxAmount: fees.taxAmount,
            protectionType,
            depositAmount: fees.depositAmount,
            insuranceFee: fees.insuranceFee,
            totalCharged: fees.totalCharged,
          },
          include: {
            item: true,
            borrower: {
              select: { id: true, firstName: true, lastName: true },
            },
            lender: {
              select: { id: true, firstName: true, lastName: true },
            },
          },
        });
      });
    } catch (err) {
      if (err.statusCode === 409) {
        return res.status(409).json({
          error: err.message,
          conflictingPeriod: err.conflictingPeriod,
        });
      }
      throw err;
    }
  }

  // Notify the requester (borrower) of the response
  const lenderFullName = [updatedMatch.item.owner.firstName, updatedMatch.item.owner.lastName].filter(Boolean).join(' ');

  if (response === 'accepted' && transaction) {
    // Send transaction_accepted notification so borrower goes directly to the transaction
    await notifyUser(updatedMatch.request.requesterId, 'transaction_accepted', {
      transactionId: transaction.id,
      matchId: updatedMatch.id,
      itemId: updatedMatch.item.id,
      itemTitle: updatedMatch.item.title,
      lenderId: updatedMatch.item.owner.id,
      lenderName: lenderFullName,
      requestId: updatedMatch.requestId,
    });
  } else {
    await notifyUser(updatedMatch.request.requesterId, 'match_declined', {
      matchId: updatedMatch.id,
      itemId: updatedMatch.item.id,
      itemTitle: updatedMatch.item.title,
      lenderId: updatedMatch.item.owner.id,
      lenderName: lenderFullName,
      requestId: updatedMatch.requestId,
    });
  }

  // Refresh match groups when a match is declined (group may drop below 2)
  if (response === 'declined') {
    refreshMatchGroups(updatedMatch.request.requesterId).catch(err =>
      console.error('[MatchGrouping] Failed to refresh after match decline:', err.message)
    );
  }

  res.json({
    match: updatedMatch,
    transaction,
    message: response === 'accepted'
      ? 'Match accepted! A transaction has been created.'
      : 'Match declined.',
  });
}

/**
 * Get matches for items owned by current user (lender view)
 * GET /api/matches/incoming
 */
async function getIncomingMatches(req, res) {
  const { status = 'pending' } = req.query;
  const parsedLimit = Math.min(Math.max(parseInt(req.query.limit) || 20, 1), 100);
  const parsedOffset = Math.max(parseInt(req.query.offset) || 0, 0);

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
      neededFrom: { gt: new Date() },
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
                _count: { select: { ratingsReceived: true } },
              },
            },
          },
        },
      },
      orderBy: { createdAt: 'desc' },
      take: parsedLimit,
      skip: parsedOffset,
    }),
    prisma.match.count({ where }),
  ]);

  // Batch compute average ratings for all unique requester IDs (avoids N+1)
  const requesterIds = [...new Set(matches.map(m => m.request?.requester?.id).filter(Boolean))];
  const ratingAverages = requesterIds.length > 0 ? await prisma.rating.groupBy({
    by: ['ratedUserId'],
    where: { ratedUserId: { in: requesterIds } },
    _avg: { overallRating: true },
  }) : [];
  const avgByUser = Object.fromEntries(ratingAverages.map(r => [r.ratedUserId, r._avg.overallRating]));

  // Batch-fetch bundle siblings for matches whose requests have a bundleId
  const bundleIds = [...new Set(matches.map(m => m.request?.bundleId).filter(Boolean))];
  const bundleSiblingsByBundleId = {};
  if (bundleIds.length > 0) {
    const siblingRequests = await prisma.request.findMany({
      where: { bundleId: { in: bundleIds } },
      select: { id: true, title: true, categoryTier3: true, status: true, bundleId: true },
    });
    for (const sr of siblingRequests) {
      if (!bundleSiblingsByBundleId[sr.bundleId]) {
        bundleSiblingsByBundleId[sr.bundleId] = [];
      }
      bundleSiblingsByBundleId[sr.bundleId].push(sr);
    }
  }

  const enrichedMatches = matches.map(match => {
    const requesterId = match.request?.requester?.id;
    const totalRatings = match.request?.requester?._count?.ratingsReceived || 0;
    const averageRating = requesterId && avgByUser[requesterId] != null
      ? parseFloat(avgByUser[requesterId].toFixed(2))
      : null;

    // Attach bundle siblings (excluding the current request itself)
    const bundleId = match.request?.bundleId;
    const allSiblings = bundleId ? bundleSiblingsByBundleId[bundleId] || [] : [];
    const bundleSiblings = allSiblings.filter(s => s.id !== match.requestId);

    return {
      ...match,
      request: {
        ...match.request,
        requester: {
          ...match.request.requester,
          _count: undefined,
          averageRating,
          totalRatings,
        },
        bundleSiblings: bundleSiblings.length > 0 ? bundleSiblings : undefined,
      },
    };
  });

  res.json({
    matches: enrichedMatches,
    pagination: {
      total,
      limit: parsedLimit,
      offset: parsedOffset,
    },
  });
}

/**
 * Respond to a bundle of matches at once (accept/decline per item)
 * POST /api/matches/respond-bundle
 */
async function respondToBundle(req, res) {
  const { bundleId, matchResponses } = req.body;

  if (!bundleId || !Array.isArray(matchResponses) || matchResponses.length === 0) {
    return res.status(400).json({ error: 'bundleId and matchResponses array are required' });
  }

  // Validate each response entry
  for (const mr of matchResponses) {
    if (!mr.matchId || !['accepted', 'declined'].includes(mr.response)) {
      return res.status(400).json({ error: 'Each matchResponse must have matchId and response ("accepted" or "declined")' });
    }
  }

  const matchIds = matchResponses.map(mr => mr.matchId);
  const responseMap = Object.fromEntries(matchResponses.map(mr => [mr.matchId, mr.response]));

  // Fetch all matches with their items and requests
  const matches = await prisma.match.findMany({
    where: { id: { in: matchIds } },
    include: {
      item: {
        include: {
          owner: {
            select: { id: true, firstName: true, lastName: true, neighborhood: true, state: true },
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

  if (matches.length !== matchIds.length) {
    return res.status(404).json({ error: 'One or more matches not found' });
  }

  // Verify all matches belong to the same bundleId and are owned by current user
  for (const match of matches) {
    if (match.item.ownerId !== req.user.id) {
      return res.status(403).json({ error: 'Not authorized to respond to one or more matches' });
    }
    if (match.request.bundleId !== bundleId) {
      return res.status(400).json({ error: 'All matches must belong to the specified bundle' });
    }
    if (match.lenderResponse !== 'pending') {
      return res.status(400).json({ error: `Match ${match.id} has already been responded to` });
    }
  }

  // Process all responses — only update match responses, no transactions
  // The borrower initiates the transaction later via "Borrow Entire Bundle"
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
                select: { id: true, firstName: true, lastName: true, neighborhood: true },
              },
            },
          },
        },
      });

      updated.push(updatedMatch);
    }

    return updated;
  });

  // Send a single consolidated notification instead of per-item notifications
  const acceptedItems = updatedMatches.filter(m => responseMap[m.id] === 'accepted');
  const declinedItems = updatedMatches.filter(m => responseMap[m.id] === 'declined');
  const requesterId = updatedMatches[0].request.requesterId;
  const firstOriginal = matches.find(m => m.id === updatedMatches[0].id);
  const lenderFullName = [
    firstOriginal?.item?.owner?.firstName,
    firstOriginal?.item?.owner?.lastName,
  ].filter(Boolean).join(' ');

  await notifyUser(requesterId, 'bundle_responded', {
    lenderName: lenderFullName,
    lenderId: firstOriginal?.item?.ownerId,
    bundleId,
    requestId: updatedMatches[0].requestId,
    acceptedCount: acceptedItems.length,
    declinedCount: declinedItems.length,
    totalCount: updatedMatches.length,
    acceptedItems: acceptedItems.map(m => m.item?.title).join(', '),
    declinedItems: declinedItems.map(m => m.item?.title).join(', '),
  });

  const acceptedCount = updatedMatches.filter(m => responseMap[m.id] === 'accepted').length;
  const declinedCount = updatedMatches.length - acceptedCount;

  // Refresh match groups after bundle response
  refreshMatchGroups(requesterId).catch(err =>
    console.error('[MatchGrouping] Failed to refresh after respondToBundle:', err.message)
  );

  res.json({
    matches: updatedMatches,
    transactions: [],
    message: `Bundle response processed: ${acceptedCount} accepted, ${declinedCount} declined`,
  });
}

module.exports = { respondToMatch, getIncomingMatches, respondToBundle };
