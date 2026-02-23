const prisma = require('../config/database');
const { notifyUser } = require('../services/notificationService');

/**
 * Submit a rating after transaction completion
 * POST /api/transactions/:id/rating
 */
async function submitRating(req, res) {
  const { id: transactionId } = req.params;
  const {
    overallRating,
    onTimeRating,
    communicationRating,
    conditionRating,
    itemAsDescribedRating,
    reviewText,
    wouldTransactAgain,
  } = req.body;

  // Validate overall rating
  if (!overallRating || overallRating < 1 || overallRating > 5) {
    return res.status(400).json({ error: 'Overall rating must be between 1 and 5' });
  }

  // Get transaction
  const transaction = await prisma.transaction.findUnique({
    where: { id: transactionId },
  });

  if (!transaction) {
    return res.status(404).json({ error: 'Transaction not found' });
  }

  // Only borrower or lender can rate
  const isBorrower = transaction.borrowerId === req.user.id;
  const isLender = transaction.lenderId === req.user.id;

  if (!isBorrower && !isLender) {
    return res.status(403).json({ error: 'Not authorized to rate this transaction' });
  }

  // Transaction must be completed or return_confirmed
  if (!['completed', 'return_confirmed'].includes(transaction.status)) {
    return res.status(400).json({ error: 'Can only rate after transaction is completed' });
  }

  // Determine who is being rated and their role
  const ratedUserId = isBorrower ? transaction.lenderId : transaction.borrowerId;
  const role = isBorrower ? 'lender' : 'borrower'; // Role of the person being rated

  // Wrap duplicate check + create + count + auto-complete in a transaction
  const rating = await prisma.$transaction(async (tx) => {
    // Check if user already rated this transaction (inside transaction to prevent race)
    const existingRating = await tx.rating.findUnique({
      where: {
        unique_rating_per_transaction_per_rater: {
          transactionId,
          raterId: req.user.id,
        },
      },
    });

    if (existingRating) {
      const err = new Error('You have already rated this transaction');
      err.statusCode = 400;
      throw err;
    }

    const created = await tx.rating.create({
      data: {
        transactionId,
        raterId: req.user.id,
        ratedUserId,
        role,
        overallRating,
        onTimeRating,
        communicationRating,
        conditionRating: isLender ? conditionRating : null,
        itemAsDescribedRating: isBorrower ? itemAsDescribedRating : null,
        reviewText,
        wouldTransactAgain: wouldTransactAgain ?? true,
      },
      include: {
        ratedUser: {
          select: { id: true, firstName: true, lastName: true },
        },
        rater: {
          select: { id: true, firstName: true, lastName: true },
        },
      },
    });

    // Check if both parties have rated, if so mark transaction as completed
    const ratingsCount = await tx.rating.count({
      where: { transactionId },
    });

    if (ratingsCount === 2 && transaction.status !== 'completed') {
      await tx.transaction.update({
        where: { id: transactionId },
        data: { status: 'completed' },
      });
    }

    return created;
  }).catch((err) => {
    if (err.statusCode === 400) {
      return res.status(400).json({ error: err.message });
    }
    throw err;
  });

  // If response already sent (duplicate rating), stop
  if (res.headersSent) return;

  // Notifications sent outside the transaction (idempotent)
  const raterFullName = [rating.rater.firstName, rating.rater.lastName].filter(Boolean).join(' ');
  await notifyUser(ratedUserId, 'rating_received', {
    transactionId,
    ratingId: rating.id,
    rating: overallRating,
    raterId: req.user.id,
    raterName: raterFullName,
  });

  res.status(201).json(rating);
}

/**
 * Get ratings for a transaction
 * GET /api/transactions/:id/ratings
 */
async function getTransactionRatings(req, res) {
  const { id: transactionId } = req.params;

  const transaction = await prisma.transaction.findUnique({
    where: { id: transactionId },
  });

  if (!transaction) {
    return res.status(404).json({ error: 'Transaction not found' });
  }

  // Only participants can view ratings
  if (transaction.borrowerId !== req.user.id && transaction.lenderId !== req.user.id) {
    return res.status(403).json({ error: 'Not authorized to view ratings for this transaction' });
  }

  const ratings = await prisma.rating.findMany({
    where: { transactionId },
    include: {
      rater: {
        select: { id: true, firstName: true, lastName: true, profilePhotoUrl: true },
      },
      ratedUser: {
        select: { id: true, firstName: true, lastName: true, profilePhotoUrl: true },
      },
    },
  });

  // Check visibility rules: ratings visible after both submit OR 7 days after return
  const visibilityAnchor = transaction.actualReturnTime || transaction.updatedAt;
  const transactionAge = Date.now() - new Date(visibilityAnchor).getTime();
  const sevenDays = 7 * 24 * 60 * 60 * 1000;
  const bothRated = ratings.length === 2;
  const isVisible = bothRated || transactionAge > sevenDays;

  if (!isVisible) {
    // Only show user's own rating
    const myRating = ratings.find(r => r.raterId === req.user.id);
    return res.json({
      ratings: myRating ? [myRating] : [],
      message: 'Other rating will be visible after both parties rate or after 7 days',
    });
  }

  res.json({ ratings });
}

/**
 * Update a rating within 24-hour grace period
 * PUT /api/transactions/:id/rating
 */
async function updateRating(req, res) {
  const { id: transactionId } = req.params;
  const { overallRating, onTimeRating, communicationRating, conditionRating, itemAsDescribedRating, reviewText, wouldTransactAgain } = req.body;

  const rating = await prisma.rating.findUnique({
    where: {
      unique_rating_per_transaction_per_rater: {
        transactionId,
        raterId: req.user.id,
      },
    },
  });

  if (!rating) {
    return res.status(404).json({ error: 'Rating not found' });
  }

  // 24-hour grace period
  const hoursSinceCreation = (Date.now() - new Date(rating.createdAt).getTime()) / (1000 * 60 * 60);
  if (hoursSinceCreation > 24) {
    return res.status(400).json({ error: 'Ratings can only be edited within 24 hours of submission' });
  }

  const data = {};
  if (overallRating !== undefined) data.overallRating = overallRating;
  if (onTimeRating !== undefined) data.onTimeRating = onTimeRating;
  if (communicationRating !== undefined) data.communicationRating = communicationRating;
  if (conditionRating !== undefined) data.conditionRating = conditionRating;
  if (itemAsDescribedRating !== undefined) data.itemAsDescribedRating = itemAsDescribedRating;
  if (reviewText !== undefined) data.reviewText = reviewText;
  if (wouldTransactAgain !== undefined) data.wouldTransactAgain = wouldTransactAgain;

  const updated = await prisma.rating.update({
    where: { id: rating.id },
    data,
    include: {
      rater: { select: { id: true, firstName: true, lastName: true } },
      ratedUser: { select: { id: true, firstName: true, lastName: true } },
    },
  });

  res.json(updated);
}

/**
 * Delete a rating within 24-hour grace period
 * DELETE /api/transactions/:id/rating
 */
async function deleteRating(req, res) {
  const { id: transactionId } = req.params;

  const rating = await prisma.rating.findUnique({
    where: {
      unique_rating_per_transaction_per_rater: {
        transactionId,
        raterId: req.user.id,
      },
    },
  });

  if (!rating) {
    return res.status(404).json({ error: 'Rating not found' });
  }

  // 24-hour grace period
  const hoursSinceCreation = (Date.now() - new Date(rating.createdAt).getTime()) / (1000 * 60 * 60);
  if (hoursSinceCreation > 24) {
    return res.status(400).json({ error: 'Ratings can only be deleted within 24 hours of submission' });
  }

  await prisma.rating.delete({ where: { id: rating.id } });

  res.json({ message: 'Rating deleted' });
}

module.exports = { submitRating, getTransactionRatings, updateRating, deleteRating };
