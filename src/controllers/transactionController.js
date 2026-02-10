const prisma = require('../config/database');
const { notifyUser } = require('../services/notificationService');
const { calculateFees } = require('../utils/feeCalculation');
const { getTaxRate } = require('../utils/taxRates');
const { hasDateConflict } = require('../utils/dateConflict');

// Valid state transitions
const VALID_TRANSITIONS = {
  requested: ['accepted', 'cancelled'],
  accepted: ['pickup_confirmed', 'cancelled', 'disputed'],
  pickup_confirmed: ['active', 'cancelled', 'disputed'],
  active: ['return_initiated', 'disputed'],
  return_initiated: ['return_confirmed', 'disputed'],
  return_confirmed: ['completed', 'disputed'],
  completed: [],
  disputed: ['completed', 'cancelled'],
  cancelled: [],
};

/**
 * Create a transaction from an accepted match
 * POST /api/transactions
 */
async function createTransaction(req, res) {
  const {
    matchId,
    itemId,
    pickupTime,
    returnTime,
    protectionType,
  } = req.body;

  let match = null;
  let item = null;

  // If matchId provided, get match and verify it's accepted
  if (matchId) {
    match = await prisma.match.findUnique({
      where: { id: matchId },
      include: {
        item: { include: { owner: true } },
        request: true,
      },
    });

    if (!match) {
      return res.status(404).json({ error: 'Match not found' });
    }

    if (match.lenderResponse !== 'accepted') {
      return res.status(400).json({ error: 'Match has not been accepted by the lender' });
    }

    if (match.request.requesterId !== req.user.id) {
      return res.status(403).json({ error: 'Not authorized to create transaction for this match' });
    }

    item = match.item;
  } else if (itemId) {
    // Direct transaction without a match (browse-based)
    item = await prisma.item.findUnique({
      where: { id: itemId },
      include: { owner: true },
    });

    if (!item) {
      return res.status(404).json({ error: 'Item not found' });
    }

    if (!item.isAvailable) {
      return res.status(400).json({ error: 'Item is not available' });
    }

    if (item.ownerId === req.user.id) {
      return res.status(400).json({ error: 'Cannot rent your own item' });
    }
  } else {
    return res.status(400).json({ error: 'Either matchId or itemId is required' });
  }

  // Wrap date conflict check + fee calc + create in a transaction for atomicity
  const transaction = await prisma.$transaction(async (tx) => {
    // Check for date conflicts with existing bookings
    const conflict = await hasDateConflict(item.id, pickupTime, returnTime);
    if (conflict.hasConflict) {
      const err = new Error('This item is already booked during the requested dates');
      err.statusCode = 409;
      err.conflictingPeriod = {
        pickupTime: conflict.conflictingTransaction.pickupTime,
        returnTime: conflict.conflictingTransaction.returnTime,
      };
      throw err;
    }

    // Calculate fees with tax
    const taxRate = getTaxRate(item.owner.state);
    const fees = calculateFees(item, pickupTime, returnTime, protectionType, taxRate);

    return tx.transaction.create({
      data: {
        requestId: match?.requestId || null,
        itemId: item.id,
        borrowerId: req.user.id,
        lenderId: item.ownerId,
        pickupTime: new Date(pickupTime),
        returnTime: new Date(returnTime),
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
          select: { id: true, firstName: true, lastName: true, phoneNumber: true },
        },
        lender: {
          select: { id: true, firstName: true, lastName: true, phoneNumber: true },
        },
      },
    });
  }).catch((err) => {
    if (err.statusCode === 409) {
      return res.status(409).json({
        error: err.message,
        conflictingPeriod: err.conflictingPeriod,
      });
    }
    throw err;
  });

  // If response already sent (409 conflict), stop
  if (res.headersSent) return;

  // Notifications sent outside the transaction (idempotent)
  const borrowerFullName = [transaction.borrower.firstName, transaction.borrower.lastName].filter(Boolean).join(' ');
  await notifyUser(item.ownerId, 'transaction_requested', {
    transactionId: transaction.id,
    itemId: item.id,
    itemTitle: item.title,
    borrowerId: req.user.id,
    borrowerName: borrowerFullName,
  });

  res.status(201).json(transaction);
}

/**
 * Get transaction details
 * GET /api/transactions/:id
 */
async function getTransaction(req, res) {
  const { id } = req.params;

  const transaction = await prisma.transaction.findUnique({
    where: { id },
    include: {
      item: true,
      borrower: {
        select: { id: true, firstName: true, lastName: true, phoneNumber: true, profilePhotoUrl: true },
      },
      lender: {
        select: { id: true, firstName: true, lastName: true, phoneNumber: true, profilePhotoUrl: true },
      },
      photos: true,
      ratings: true,
      request: true,
    },
  });

  if (!transaction) {
    return res.status(404).json({ error: 'Transaction not found' });
  }

  // Only borrower or lender can view transaction details
  if (transaction.borrowerId !== req.user.id && transaction.lenderId !== req.user.id) {
    return res.status(403).json({ error: 'Not authorized to view this transaction' });
  }

  res.json(transaction);
}

/**
 * Get current user's transactions
 * GET /api/transactions/my-transactions
 */
async function getMyTransactions(req, res) {
  const { role, status, limit = 20, offset = 0 } = req.query;

  const where = {
    OR: [
      { borrowerId: req.user.id },
      { lenderId: req.user.id },
    ],
  };

  // Filter by role
  if (role === 'borrower') {
    delete where.OR;
    where.borrowerId = req.user.id;
  } else if (role === 'lender') {
    delete where.OR;
    where.lenderId = req.user.id;
  }

  if (status) {
    where.status = status;
  }

  const [transactions, total] = await Promise.all([
    prisma.transaction.findMany({
      where,
      include: {
        item: {
          select: { id: true, title: true, photoUrls: true },
        },
        borrower: {
          select: { id: true, firstName: true, lastName: true, profilePhotoUrl: true },
        },
        lender: {
          select: { id: true, firstName: true, lastName: true, profilePhotoUrl: true },
        },
      },
      orderBy: { createdAt: 'desc' },
      take: parseInt(limit),
      skip: parseInt(offset),
    }),
    prisma.transaction.count({ where }),
  ]);

  res.json({
    transactions,
    pagination: {
      total,
      limit: parseInt(limit),
      offset: parseInt(offset),
    },
  });
}

/**
 * Update transaction status
 * PUT /api/transactions/:id/status
 */
async function updateTransactionStatus(req, res) {
  const { id } = req.params;
  const { status, disputeReason } = req.body;

  const transaction = await prisma.transaction.findUnique({
    where: { id },
    include: { item: true },
  });

  if (!transaction) {
    return res.status(404).json({ error: 'Transaction not found' });
  }

  // Only borrower or lender can update
  if (transaction.borrowerId !== req.user.id && transaction.lenderId !== req.user.id) {
    return res.status(403).json({ error: 'Not authorized to update this transaction' });
  }

  // Validate state transition
  const validNextStates = VALID_TRANSITIONS[transaction.status];
  if (!validNextStates.includes(status)) {
    return res.status(400).json({
      error: `Cannot transition from "${transaction.status}" to "${status}"`,
      validTransitions: validNextStates,
    });
  }

  // Status-specific validations
  if (status === 'accepted' && transaction.lenderId !== req.user.id) {
    return res.status(403).json({ error: 'Only the lender can accept the transaction' });
  }

  if (status === 'disputed' && !disputeReason) {
    return res.status(400).json({ error: 'Dispute reason is required' });
  }

  // Build update data
  const updateData = { status };

  if (status === 'pickup_confirmed') {
    updateData.actualPickupTime = new Date();
  }

  if (status === 'return_confirmed' || status === 'completed') {
    updateData.actualReturnTime = new Date();
  }

  if (status === 'disputed') {
    updateData.disputeReason = disputeReason;
  }

  // Calculate late fee if returning late
  if (status === 'return_confirmed' || status === 'completed') {
    const actualReturn = updateData.actualReturnTime || new Date();
    if (actualReturn > transaction.returnTime && transaction.item.lateFeeAmount) {
      const daysLate = Math.ceil((actualReturn - transaction.returnTime) / (1000 * 60 * 60 * 24));
      updateData.lateFeeCharged = parseFloat(transaction.item.lateFeeAmount) * daysLate;
    }
  }

  const updatedTransaction = await prisma.transaction.update({
    where: { id },
    data: updateData,
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

  // Send notifications based on status change
  const borrowerName = [updatedTransaction.borrower.firstName, updatedTransaction.borrower.lastName].filter(Boolean).join(' ');
  const lenderName = [updatedTransaction.lender.firstName, updatedTransaction.lender.lastName].filter(Boolean).join(' ');
  const notificationContext = {
    transactionId: updatedTransaction.id,
    itemId: updatedTransaction.item.id,
    itemTitle: updatedTransaction.item.title,
    borrowerId: updatedTransaction.borrowerId,
    borrowerName,
    lenderId: updatedTransaction.lenderId,
    lenderName,
  };

  // Determine who to notify and what type
  switch (status) {
    case 'accepted':
      await notifyUser(updatedTransaction.borrowerId, 'transaction_accepted', notificationContext);
      break;
    case 'cancelled':
      // Notify the other party if cancelled
      const cancelledNotifyUser = req.user.id === updatedTransaction.borrowerId
        ? updatedTransaction.lenderId
        : updatedTransaction.borrowerId;
      await notifyUser(cancelledNotifyUser, 'transaction_declined', notificationContext);
      break;
    case 'pickup_confirmed':
      // Notify the other party
      const pickupNotifyUser = req.user.id === updatedTransaction.borrowerId
        ? updatedTransaction.lenderId
        : updatedTransaction.borrowerId;
      await notifyUser(pickupNotifyUser, 'pickup_confirmed', notificationContext);
      break;
    case 'return_initiated':
      await notifyUser(updatedTransaction.lenderId, 'return_initiated', notificationContext);
      break;
    case 'completed':
      // Notify both parties
      await notifyUser(updatedTransaction.borrowerId, 'transaction_completed', notificationContext);
      await notifyUser(updatedTransaction.lenderId, 'transaction_completed', notificationContext);
      break;
    case 'disputed':
      // Notify the other party
      const disputeNotifyUser = req.user.id === updatedTransaction.borrowerId
        ? updatedTransaction.lenderId
        : updatedTransaction.borrowerId;
      await notifyUser(disputeNotifyUser, 'transaction_disputed', notificationContext);
      break;
  }

  res.json(updatedTransaction);
}

/**
 * Flag a dispute
 * PUT /api/transactions/:id/dispute
 */
async function disputeTransaction(req, res) {
  req.body.status = 'disputed';
  return updateTransactionStatus(req, res);
}

module.exports = {
  createTransaction,
  getTransaction,
  getMyTransactions,
  updateTransactionStatus,
  disputeTransaction,
};
