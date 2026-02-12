const prisma = require('../config/database');
const { notifyUser } = require('../services/notificationService');
const { calculateFees } = require('../utils/feeCalculation');
const { getTaxRate } = require('../utils/taxRates');
const { hasDateConflict } = require('../utils/dateConflict');

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
                ratingsReceived: { select: { overallRating: true } },
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
