const prisma = require('../config/database');
const { notifyUser } = require('../services/notificationService');
const { calculateFees } = require('../utils/feeCalculation');
const { getTaxRate } = require('../utils/taxRates');
const { hasDateConflict, isAvailableForDates } = require('../utils/dateConflict');
const { refreshMatchGroups } = require('../utils/matchGrouping');

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

    if (match.lenderResponse === 'declined') {
      return res.status(400).json({ error: 'This match has been declined by the lender' });
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

  // Validate dates
  if (!pickupTime || !returnTime) {
    return res.status(400).json({ error: 'Both pickup time and return time are required' });
  }
  const pickup = new Date(pickupTime);
  const returnDate = new Date(returnTime);
  if (isNaN(pickup.getTime()) || isNaN(returnDate.getTime())) {
    return res.status(400).json({ error: 'Invalid date format' });
  }
  if (pickup >= returnDate) {
    return res.status(400).json({ error: 'Pickup time must be before return time' });
  }

  // Wrap date conflict check + fee calc + create in a transaction for atomicity
  const transaction = await prisma.$transaction(async (tx) => {
    // If the lender hasn't responded yet, mark the match as accepted
    // (borrower is confirming intent; the transaction starts as "requested"
    //  so the lender still needs to accept the transaction itself)
    if (match?.lenderResponse === 'pending') {
      await tx.match.update({
        where: { id: matchId },
        data: { lenderResponse: 'accepted', respondedAt: new Date() },
      });
    }

    // Check for date conflicts with existing bookings
    const conflict = await hasDateConflict(item.id, pickupTime, returnTime, null, tx);
    if (conflict.hasConflict) {
      const err = new Error('This item is already booked during the requested dates');
      err.statusCode = 409;
      err.conflictingPeriod = {
        pickupTime: conflict.conflictingTransaction.pickupTime,
        returnTime: conflict.conflictingTransaction.returnTime,
      };
      throw err;
    }

    // Check item availability rules
    if (!isAvailableForDates(item, pickupTime, returnTime)) {
      const err = new Error('This item is not available during the requested dates');
      err.statusCode = 409;
      throw err;
    }

    // Calculate fees with tax
    const taxRate = getTaxRate(item.owner.state);
    const fees = calculateFees(item, pickupTime, returnTime, protectionType, taxRate);

    // Update request status so it no longer shows as open/matched
    // (inside the atomic transaction so it rolls back if creation fails)
    if (match?.requestId && match.request && ['open', 'matched'].includes(match.request.status)) {
      await tx.request.update({
        where: { id: match.requestId },
        data: { status: 'accepted' },
      });
    }

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

  // Audit log: transaction created
  prisma.transactionAuditLog.create({
    data: {
      transactionId: transaction.id,
      userId: req.user.id,
      fromStatus: null,
      toStatus: 'requested',
      action: 'created',
    },
  }).catch(err => console.error('[AuditLog] Failed to log transaction creation:', err.message));

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
      transactionItems: {
        include: {
          item: {
            select: { id: true, title: true, photoUrls: true, listingType: true, pricingType: true, priceAmount: true, lateFeeAmount: true, categoryTier1: true, categoryTier2: true },
          },
        },
        orderBy: { createdAt: 'asc' },
      },
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
          select: { id: true, title: true, photoUrls: true, category: true, categoryTier2: true },
        },
        borrower: {
          select: { id: true, firstName: true, lastName: true, profilePhotoUrl: true },
        },
        lender: {
          select: { id: true, firstName: true, lastName: true, profilePhotoUrl: true },
        },
        transactionItems: {
          include: {
            item: {
              select: { id: true, title: true, photoUrls: true, listingType: true, pricingType: true, priceAmount: true, lateFeeAmount: true, categoryTier1: true, categoryTier2: true },
            },
          },
          orderBy: { createdAt: 'asc' },
        },
      },
      orderBy: { createdAt: 'desc' },
      take: Math.min(Math.max(parseInt(limit) || 20, 1), 100),
      skip: Math.max(parseInt(offset) || 0, 0),
    }),
    prisma.transaction.count({ where }),
  ]);

  res.json({
    transactions,
    pagination: {
      total,
      limit: Math.min(Math.max(parseInt(limit) || 20, 1), 100),
      offset: Math.max(parseInt(offset) || 0, 0),
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

  // Validate status against known values
  const validStatuses = Object.keys(VALID_TRANSITIONS);
  if (!validStatuses.includes(status)) {
    return res.status(400).json({ error: `Invalid status: ${status}. Valid statuses: ${validStatuses.join(', ')}` });
  }

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

  if (status === 'pickup_confirmed' && transaction.lenderId !== req.user.id) {
    return res.status(403).json({ error: 'Only the lender can confirm pickup' });
  }

  if (status === 'return_initiated' && transaction.borrowerId !== req.user.id) {
    return res.status(403).json({ error: 'Only the borrower can initiate return' });
  }

  if (status === 'return_confirmed' && transaction.lenderId !== req.user.id) {
    return res.status(403).json({ error: 'Only the lender can confirm return' });
  }

  if (status === 'disputed' && !disputeReason) {
    return res.status(400).json({ error: 'Dispute reason is required' });
  }

  // Build update data
  const updateData = { status };

  if (status === 'pickup_confirmed') {
    updateData.actualPickupTime = new Date();
  }

  if (status === 'return_confirmed') {
    updateData.actualReturnTime = new Date();
  }

  if (status === 'disputed') {
    updateData.disputeReason = disputeReason;
  }

  // Calculate late fee if returning late
  if (status === 'return_confirmed') {
    const actualReturn = updateData.actualReturnTime || new Date();
    if (actualReturn > transaction.returnTime && transaction.item.lateFeeAmount) {
      const daysLate = Math.ceil((actualReturn - transaction.returnTime) / (1000 * 60 * 60 * 24));
      updateData.lateFeeCharged = parseFloat(transaction.item.lateFeeAmount) * daysLate;
    }
  }

  // If cancelling a transaction that came from a request, revert request status
  // so the borrower can review other matches
  if (status === 'cancelled' && transaction.requestId) {
    const otherActiveTransactions = await prisma.transaction.count({
      where: {
        requestId: transaction.requestId,
        id: { not: id },
        status: { notIn: ['cancelled', 'declined'] },
      },
    });
    if (otherActiveTransactions === 0) {
      // Check if request has other matches to review
      const matchCount = await prisma.match.count({
        where: { requestId: transaction.requestId, lenderResponse: { not: 'declined' } },
      });
      await prisma.request.update({
        where: { id: transaction.requestId },
        data: { status: matchCount > 0 ? 'matched' : 'open' },
      });
    }
  }

  // If cancelling a bundle transaction, revert all associated requests
  if (status === 'cancelled' && transaction.bundleId) {
    const bundleRequests = await prisma.request.findMany({
      where: { bundleId: transaction.bundleId, status: 'accepted' },
    });
    for (const req of bundleRequests) {
      const otherActive = await prisma.transaction.count({
        where: {
          OR: [
            { requestId: req.id },
            { bundleId: req.bundleId, id: { not: id } },
          ],
          status: { notIn: ['cancelled', 'declined'] },
        },
      });
      if (otherActive === 0) {
        const matchCount = await prisma.match.count({
          where: { requestId: req.id, lenderResponse: { not: 'declined' } },
        });
        await prisma.request.update({
          where: { id: req.id },
          data: { status: matchCount > 0 ? 'matched' : 'open' },
        });
      }
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

  // Audit log: status change
  const auditMetadata = {};
  if (status === 'disputed' && disputeReason) auditMetadata.disputeReason = disputeReason;
  if (updateData.lateFeeCharged) auditMetadata.lateFeeCharged = updateData.lateFeeCharged;

  prisma.transactionAuditLog.create({
    data: {
      transactionId: id,
      userId: req.user.id,
      fromStatus: transaction.status,
      toStatus: status,
      action: status === 'disputed' ? 'disputed' : status === 'cancelled' ? 'cancelled' : 'status_change',
      metadata: Object.keys(auditMetadata).length > 0 ? auditMetadata : undefined,
    },
  }).catch(err => console.error('[AuditLog] Failed to log status change:', err.message));

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

const DISPUTE_CATEGORIES = [
  'item_damaged',
  'item_not_returned',
  'wrong_item',
  'late_return',
  'fee_dispute',
  'other',
];

/**
 * File a dispute
 * PUT /api/transactions/:id/dispute
 */
async function disputeTransaction(req, res) {
  const { id } = req.params;
  const { disputeReason, disputeCategory } = req.body;

  const transaction = await prisma.transaction.findUnique({
    where: { id },
    include: {
      item: true,
      borrower: { select: { id: true, firstName: true, lastName: true } },
      lender: { select: { id: true, firstName: true, lastName: true } },
    },
  });

  if (!transaction) {
    return res.status(404).json({ error: 'Transaction not found' });
  }

  if (transaction.borrowerId !== req.user.id && transaction.lenderId !== req.user.id) {
    return res.status(403).json({ error: 'Not authorized' });
  }

  // Can only dispute from certain statuses
  const disputableStatuses = ['accepted', 'pickup_confirmed', 'active', 'return_initiated', 'return_confirmed', 'completed'];
  if (!disputableStatuses.includes(transaction.status)) {
    return res.status(400).json({ error: `Cannot dispute a transaction with status "${transaction.status}"` });
  }

  if (!disputeReason) {
    return res.status(400).json({ error: 'Dispute reason is required' });
  }

  if (disputeReason.length > 2000) {
    return res.status(400).json({ error: 'Dispute reason must be under 2000 characters' });
  }

  if (disputeCategory && !DISPUTE_CATEGORIES.includes(disputeCategory)) {
    return res.status(400).json({ error: 'Invalid dispute category' });
  }

  const previousStatus = transaction.status;
  const updatedTransaction = await prisma.transaction.update({
    where: { id },
    data: {
      status: 'disputed',
      disputeReason,
      disputeCategory: disputeCategory || 'other',
      disputeFiledBy: req.user.id,
      disputeFiledAt: new Date(),
    },
    include: {
      item: true,
      borrower: { select: { id: true, firstName: true, lastName: true } },
      lender: { select: { id: true, firstName: true, lastName: true } },
    },
  });

  // Audit log
  prisma.transactionAuditLog.create({
    data: {
      transactionId: id,
      userId: req.user.id,
      fromStatus: previousStatus,
      toStatus: 'disputed',
      action: 'disputed',
      metadata: { disputeReason, disputeCategory: disputeCategory || 'other' },
    },
  }).catch(err => console.error('[AuditLog] Failed to log dispute:', err.message));

  // Notify counter-party
  const counterPartyId = req.user.id === transaction.borrowerId
    ? transaction.lenderId
    : transaction.borrowerId;

  const borrowerName = [transaction.borrower.firstName, transaction.borrower.lastName].filter(Boolean).join(' ');
  const lenderName = [transaction.lender.firstName, transaction.lender.lastName].filter(Boolean).join(' ');

  await notifyUser(counterPartyId, 'transaction_disputed', {
    transactionId: id,
    itemId: transaction.item.id,
    itemTitle: transaction.item.title,
    borrowerId: transaction.borrowerId,
    borrowerName,
    lenderId: transaction.lenderId,
    lenderName,
  });

  res.json(updatedTransaction);
}

/**
 * Respond to a dispute (counter-party)
 * PUT /api/transactions/:id/dispute/respond
 */
async function respondToDispute(req, res) {
  const { id } = req.params;
  const { disputeResponse } = req.body;

  const transaction = await prisma.transaction.findUnique({
    where: { id },
    include: {
      item: true,
      borrower: { select: { id: true, firstName: true, lastName: true } },
      lender: { select: { id: true, firstName: true, lastName: true } },
    },
  });

  if (!transaction) {
    return res.status(404).json({ error: 'Transaction not found' });
  }

  if (transaction.status !== 'disputed') {
    return res.status(400).json({ error: 'Transaction is not in disputed status' });
  }

  if (transaction.borrowerId !== req.user.id && transaction.lenderId !== req.user.id) {
    return res.status(403).json({ error: 'Not authorized' });
  }

  // Only counter-party can respond
  if (req.user.id === transaction.disputeFiledBy) {
    return res.status(400).json({ error: 'The dispute filer cannot respond to their own dispute' });
  }

  if (!disputeResponse || !disputeResponse.trim()) {
    return res.status(400).json({ error: 'Response text is required' });
  }

  if (disputeResponse.length > 2000) {
    return res.status(400).json({ error: 'Dispute response must be under 2000 characters' });
  }

  const updatedTransaction = await prisma.transaction.update({
    where: { id },
    data: {
      disputeResponse: disputeResponse.trim(),
      disputeRespondedAt: new Date(),
    },
    include: {
      item: true,
      borrower: { select: { id: true, firstName: true, lastName: true } },
      lender: { select: { id: true, firstName: true, lastName: true } },
    },
  });

  // Notify the filer that counter-party responded
  await notifyUser(transaction.disputeFiledBy, 'dispute_response', {
    transactionId: id,
    itemId: transaction.item.id,
    itemTitle: transaction.item.title,
  });

  res.json(updatedTransaction);
}

/**
 * Resolve a dispute
 * PUT /api/transactions/:id/dispute/resolve
 */
async function resolveDispute(req, res) {
  const { id } = req.params;
  const { disputeResolution, disputeResolutionNotes } = req.body;

  const validResolutions = ['resolved_for_borrower', 'resolved_for_lender', 'mutual_agreement'];
  if (!validResolutions.includes(disputeResolution)) {
    return res.status(400).json({ error: 'Invalid resolution type' });
  }

  const transaction = await prisma.transaction.findUnique({
    where: { id },
    include: {
      item: true,
      borrower: { select: { id: true, firstName: true, lastName: true } },
      lender: { select: { id: true, firstName: true, lastName: true } },
    },
  });

  if (!transaction) {
    return res.status(404).json({ error: 'Transaction not found' });
  }

  if (transaction.status !== 'disputed') {
    return res.status(400).json({ error: 'Transaction is not in disputed status' });
  }

  if (transaction.borrowerId !== req.user.id && transaction.lenderId !== req.user.id) {
    return res.status(403).json({ error: 'Not authorized' });
  }

  // Prevent the dispute filer from resolving their own dispute
  if (transaction.disputeFiledBy === req.user.id) {
    return res.status(400).json({ error: 'The dispute filer cannot resolve their own dispute' });
  }

  const updatedTransaction = await prisma.transaction.update({
    where: { id },
    data: {
      status: 'completed',
      disputeResolution,
      disputeResolvedAt: new Date(),
      disputeResolutionNotes: disputeResolutionNotes?.trim() || null,
    },
    include: {
      item: true,
      borrower: { select: { id: true, firstName: true, lastName: true } },
      lender: { select: { id: true, firstName: true, lastName: true } },
    },
  });

  // Audit log
  prisma.transactionAuditLog.create({
    data: {
      transactionId: id,
      userId: req.user.id,
      fromStatus: 'disputed',
      toStatus: 'completed',
      action: 'dispute_resolved',
      metadata: { disputeResolution, disputeResolutionNotes: disputeResolutionNotes?.trim() || null },
    },
  }).catch(err => console.error('[AuditLog] Failed to log dispute resolution:', err.message));

  // Notify both parties
  const notificationContext = {
    transactionId: id,
    itemId: transaction.item.id,
    itemTitle: transaction.item.title,
  };

  await notifyUser(transaction.borrowerId, 'dispute_resolved', notificationContext);
  await notifyUser(transaction.lenderId, 'dispute_resolved', notificationContext);

  res.json(updatedTransaction);
}

/**
 * Create a bundle transaction (borrow all items in a bundle at once)
 * POST /api/transactions/bundle
 */
async function createBundleTransaction(req, res) {
  const { bundleId, pickupTime, returnTime, protectionType } = req.body;

  if (!bundleId) {
    return res.status(400).json({ error: 'bundleId is required' });
  }
  if (!pickupTime || !returnTime) {
    return res.status(400).json({ error: 'Both pickupTime and returnTime are required' });
  }
  const pickup = new Date(pickupTime);
  const returnDate = new Date(returnTime);
  if (isNaN(pickup.getTime()) || isNaN(returnDate.getTime())) {
    return res.status(400).json({ error: 'Invalid date format' });
  }
  if (pickup >= returnDate) {
    return res.status(400).json({ error: 'Pickup time must be before return time' });
  }

  // Fetch bundle with its items via bundleItems relation
  const bundle = await prisma.bundle.findUnique({
    where: { id: bundleId },
    include: {
      bundleItems: {
        where: { itemId: { not: null } },
        include: { item: { include: { owner: true } } },
      },
    },
  });

  if (!bundle) {
    return res.status(404).json({ error: 'Bundle not found' });
  }

  const items = bundle.bundleItems.map(bi => bi.item).filter(Boolean);
  if (items.length === 0) {
    return res.status(400).json({ error: 'Bundle has no items' });
  }

  // Verify all items share one owner
  const ownerIds = [...new Set(items.map(i => i.ownerId))];
  if (ownerIds.length > 1) {
    return res.status(400).json({ error: 'Bundle items must all belong to the same owner' });
  }

  const ownerId = ownerIds[0];
  if (ownerId === req.user.id) {
    return res.status(400).json({ error: 'Cannot borrow your own items' });
  }

  // Check all items are available
  const unavailable = items.filter(i => !i.isAvailable);
  if (unavailable.length > 0) {
    return res.status(400).json({
      error: 'Some items in the bundle are unavailable',
      unavailableItems: unavailable.map(i => ({ id: i.id, title: i.title })),
    });
  }

  const transaction = await prisma.$transaction(async (tx) => {
    // Date conflict check for each item
    for (const item of items) {
      const conflict = await hasDateConflict(item.id, pickupTime, returnTime, null, tx);
      if (conflict.hasConflict) {
        const err = new Error(`"${item.title}" is already booked during the requested dates`);
        err.statusCode = 409;
        err.itemId = item.id;
        err.itemTitle = item.title;
        throw err;
      }
      if (!isAvailableForDates(item, pickupTime, returnTime)) {
        const err = new Error(`"${item.title}" is not available during the requested dates`);
        err.statusCode = 409;
        throw err;
      }
    }

    // Calculate fees for each item
    const ownerState = items[0].owner.state;
    const taxRate = getTaxRate(ownerState);
    const itemFees = items.map(item => ({
      item,
      fees: calculateFees(item, pickupTime, returnTime, protectionType, taxRate),
    }));

    // Sum all fees
    const totalRentalFee = itemFees.reduce((sum, f) => sum + f.fees.rentalFee, 0);
    const totalPlatformFee = itemFees.reduce((sum, f) => sum + f.fees.platformFee, 0);
    const totalTaxAmount = itemFees.reduce((sum, f) => sum + f.fees.taxAmount, 0);
    const totalDepositAmount = itemFees.reduce((sum, f) => sum + (f.fees.depositAmount || 0), 0);
    const totalInsuranceFee = itemFees.reduce((sum, f) => sum + (f.fees.insuranceFee || 0), 0);
    const totalCharged = itemFees.reduce((sum, f) => sum + f.fees.totalCharged, 0);

    const primaryItemId = items[0].id;

    // Create the transaction
    const txn = await tx.transaction.create({
      data: {
        itemId: primaryItemId,
        bundleId: bundle.id,
        borrowerId: req.user.id,
        lenderId: ownerId,
        pickupTime: new Date(pickupTime),
        returnTime: new Date(returnTime),
        rentalFee: parseFloat(totalRentalFee.toFixed(2)),
        platformFee: parseFloat(totalPlatformFee.toFixed(2)),
        taxRate: taxRate,
        taxAmount: parseFloat(totalTaxAmount.toFixed(2)),
        protectionType,
        depositAmount: totalDepositAmount > 0 ? parseFloat(totalDepositAmount.toFixed(2)) : null,
        insuranceFee: totalInsuranceFee > 0 ? parseFloat(totalInsuranceFee.toFixed(2)) : null,
        totalCharged: parseFloat(totalCharged.toFixed(2)),
      },
    });

    // Create TransactionItem rows for per-item breakdown
    await tx.transactionItem.createMany({
      data: itemFees.map(({ item, fees }) => ({
        transactionId: txn.id,
        itemId: item.id,
        rentalFee: fees.rentalFee,
        platformFee: fees.platformFee,
        depositAmount: fees.depositAmount,
        insuranceFee: fees.insuranceFee,
        taxAmount: fees.taxAmount,
      })),
    });

    // Re-fetch with includes
    return tx.transaction.findUnique({
      where: { id: txn.id },
      include: {
        item: true,
        borrower: {
          select: { id: true, firstName: true, lastName: true, phoneNumber: true },
        },
        lender: {
          select: { id: true, firstName: true, lastName: true, phoneNumber: true },
        },
        transactionItems: {
          include: {
            item: {
              select: { id: true, title: true, photoUrls: true, listingType: true, pricingType: true, priceAmount: true, lateFeeAmount: true, categoryTier1: true, categoryTier2: true },
            },
          },
          orderBy: { createdAt: 'asc' },
        },
      },
    });
  }).catch((err) => {
    if (err.statusCode === 409) {
      return res.status(409).json({
        error: err.message,
        itemId: err.itemId,
        itemTitle: err.itemTitle,
      });
    }
    throw err;
  });

  if (res.headersSent) return;

  // Audit log
  prisma.transactionAuditLog.create({
    data: {
      transactionId: transaction.id,
      userId: req.user.id,
      fromStatus: null,
      toStatus: 'requested',
      action: 'created',
      metadata: { bundleId: bundle.id, itemCount: items.length },
    },
  }).catch(err => console.error('[AuditLog] Failed to log bundle transaction creation:', err.message));

  // Notify lender
  const borrowerFullName = [transaction.borrower.firstName, transaction.borrower.lastName].filter(Boolean).join(' ');
  await notifyUser(ownerId, 'transaction_requested', {
    transactionId: transaction.id,
    itemId: items[0].id,
    itemTitle: `${bundle.title} (${items.length} items)`,
    borrowerId: req.user.id,
    borrowerName: borrowerFullName,
  });

  res.status(201).json(transaction);
}

/**
 * Create a bundle transaction from request-bundle matches
 * POST /api/transactions/bundle-request
 */
async function createBundleRequestTransaction(req, res) {
  const { bundleId, matchIds, pickupTime, returnTime, protectionType } = req.body;

  if (!bundleId || !matchIds?.length) {
    return res.status(400).json({ error: 'bundleId and matchIds are required' });
  }
  if (!pickupTime || !returnTime) {
    return res.status(400).json({ error: 'Both pickupTime and returnTime are required' });
  }
  const pickup = new Date(pickupTime);
  const returnDate = new Date(returnTime);
  if (isNaN(pickup.getTime()) || isNaN(returnDate.getTime())) {
    return res.status(400).json({ error: 'Invalid date format' });
  }
  if (pickup >= returnDate) {
    return res.status(400).json({ error: 'Pickup time must be before return time' });
  }

  // Fetch all matches with item + owner + request
  const matches = await prisma.match.findMany({
    where: { id: { in: matchIds } },
    include: {
      item: { include: { owner: true } },
      request: true,
    },
  });

  if (matches.length !== matchIds.length) {
    return res.status(404).json({ error: 'One or more matches not found' });
  }

  // Validate all matches belong to requests in this bundle
  const bundle = await prisma.bundle.findUnique({
    where: { id: bundleId },
    include: { requests: { select: { id: true } } },
  });
  if (!bundle) {
    return res.status(404).json({ error: 'Bundle not found' });
  }
  const bundleRequestIds = new Set(bundle.requests.map(r => r.id));
  for (const match of matches) {
    if (!bundleRequestIds.has(match.requestId)) {
      return res.status(400).json({ error: `Match ${match.id} does not belong to a request in this bundle` });
    }
  }

  // Validate all items share same owner
  const ownerIds = [...new Set(matches.map(m => m.item.ownerId))];
  if (ownerIds.length > 1) {
    return res.status(400).json({ error: 'All matches must be from the same lender' });
  }
  const ownerId = ownerIds[0];
  if (ownerId === req.user.id) {
    return res.status(400).json({ error: 'Cannot borrow your own items' });
  }

  // Validate no matches are declined
  const declined = matches.filter(m => m.lenderResponse === 'declined');
  if (declined.length > 0) {
    return res.status(400).json({ error: 'One or more matches have been declined by the lender' });
  }

  // Validate requester owns these requests
  for (const match of matches) {
    if (match.request.requesterId !== req.user.id) {
      return res.status(403).json({ error: 'Not authorized to create transaction for these matches' });
    }
  }

  // Check all items are available
  const unavailable = matches.filter(m => !m.item.isAvailable);
  if (unavailable.length > 0) {
    return res.status(400).json({
      error: 'Some items are unavailable',
      unavailableItems: unavailable.map(m => ({ id: m.item.id, title: m.item.title })),
    });
  }

  const items = matches.map(m => m.item);

  const transaction = await prisma.$transaction(async (tx) => {
    // Auto-accept any pending matches (borrower is confirming intent;
    // the transaction starts as 'requested' so the lender still approves)
    const pendingMatchIds = matches.filter(m => m.lenderResponse === 'pending').map(m => m.id);
    if (pendingMatchIds.length > 0) {
      await tx.match.updateMany({
        where: { id: { in: pendingMatchIds } },
        data: { lenderResponse: 'accepted', respondedAt: new Date() },
      });
    }

    // Date conflict check for each item
    for (const item of items) {
      const conflict = await hasDateConflict(item.id, pickupTime, returnTime, null, tx);
      if (conflict.hasConflict) {
        const err = new Error(`"${item.title}" is already booked during the requested dates`);
        err.statusCode = 409;
        err.itemId = item.id;
        err.itemTitle = item.title;
        throw err;
      }
      if (!isAvailableForDates(item, pickupTime, returnTime)) {
        const err = new Error(`"${item.title}" is not available during the requested dates`);
        err.statusCode = 409;
        throw err;
      }
    }

    // Calculate fees for each item
    const ownerState = items[0].owner.state;
    const taxRate = getTaxRate(ownerState);
    const itemFees = items.map(item => ({
      item,
      fees: calculateFees(item, pickupTime, returnTime, protectionType, taxRate),
    }));

    // Sum all fees
    const totalRentalFee = itemFees.reduce((sum, f) => sum + f.fees.rentalFee, 0);
    const totalPlatformFee = itemFees.reduce((sum, f) => sum + f.fees.platformFee, 0);
    const totalTaxAmount = itemFees.reduce((sum, f) => sum + f.fees.taxAmount, 0);
    const totalDepositAmount = itemFees.reduce((sum, f) => sum + (f.fees.depositAmount || 0), 0);
    const totalInsuranceFee = itemFees.reduce((sum, f) => sum + (f.fees.insuranceFee || 0), 0);
    const totalCharged = itemFees.reduce((sum, f) => sum + f.fees.totalCharged, 0);

    const primaryItemId = items[0].id;

    // Create the transaction
    const txn = await tx.transaction.create({
      data: {
        itemId: primaryItemId,
        bundleId: bundle.id,
        borrowerId: req.user.id,
        lenderId: ownerId,
        pickupTime: new Date(pickupTime),
        returnTime: new Date(returnTime),
        rentalFee: parseFloat(totalRentalFee.toFixed(2)),
        platformFee: parseFloat(totalPlatformFee.toFixed(2)),
        taxRate: taxRate,
        taxAmount: parseFloat(totalTaxAmount.toFixed(2)),
        protectionType,
        depositAmount: totalDepositAmount > 0 ? parseFloat(totalDepositAmount.toFixed(2)) : null,
        insuranceFee: totalInsuranceFee > 0 ? parseFloat(totalInsuranceFee.toFixed(2)) : null,
        totalCharged: parseFloat(totalCharged.toFixed(2)),
      },
    });

    // Create TransactionItem rows for per-item breakdown
    await tx.transactionItem.createMany({
      data: itemFees.map(({ item, fees }) => ({
        transactionId: txn.id,
        itemId: item.id,
        rentalFee: fees.rentalFee,
        platformFee: fees.platformFee,
        depositAmount: fees.depositAmount,
        insuranceFee: fees.insuranceFee,
        taxAmount: fees.taxAmount,
      })),
    });

    // Update all related requests to accepted status
    const requestIds = [...new Set(matches.map(m => m.requestId))];
    await tx.request.updateMany({
      where: { id: { in: requestIds }, status: { in: ['open', 'matched'] } },
      data: { status: 'accepted' },
    });

    // Re-fetch with includes
    return tx.transaction.findUnique({
      where: { id: txn.id },
      include: {
        item: true,
        borrower: {
          select: { id: true, firstName: true, lastName: true, phoneNumber: true },
        },
        lender: {
          select: { id: true, firstName: true, lastName: true, phoneNumber: true },
        },
        transactionItems: {
          include: {
            item: {
              select: { id: true, title: true, photoUrls: true, listingType: true, pricingType: true, priceAmount: true, lateFeeAmount: true, categoryTier1: true, categoryTier2: true },
            },
          },
          orderBy: { createdAt: 'asc' },
        },
      },
    });
  }).catch((err) => {
    if (err.statusCode === 409) {
      return res.status(409).json({
        error: err.message,
        itemId: err.itemId,
        itemTitle: err.itemTitle,
      });
    }
    throw err;
  });

  if (res.headersSent) return;

  // Audit log
  prisma.transactionAuditLog.create({
    data: {
      transactionId: transaction.id,
      userId: req.user.id,
      fromStatus: null,
      toStatus: 'requested',
      action: 'created',
      metadata: { bundleId: bundle.id, itemCount: items.length, type: 'bundle_request' },
    },
  }).catch(err => console.error('[AuditLog] Failed to log bundle request transaction creation:', err.message));

  // Notify lender
  const borrowerFullName = [transaction.borrower.firstName, transaction.borrower.lastName].filter(Boolean).join(' ');
  await notifyUser(ownerId, 'transaction_requested', {
    transactionId: transaction.id,
    itemId: items[0].id,
    itemTitle: `Bundle: ${bundle.title} (${items.length} items)`,
    borrowerId: req.user.id,
    borrowerName: borrowerFullName,
  });

  res.status(201).json(transaction);
}

/**
 * Create a multi-item transaction from a match group
 * POST /api/transactions/match-group
 */
async function createMatchGroupTransaction(req, res) {
  const { matchGroupId, matchIds, pickupTime, returnTime, protectionType } = req.body;

  if (!matchGroupId || !matchIds?.length) {
    return res.status(400).json({ error: 'matchGroupId and matchIds are required' });
  }
  if (!pickupTime || !returnTime) {
    return res.status(400).json({ error: 'Both pickupTime and returnTime are required' });
  }
  const pickup = new Date(pickupTime);
  const returnDate = new Date(returnTime);
  if (isNaN(pickup.getTime()) || isNaN(returnDate.getTime())) {
    return res.status(400).json({ error: 'Invalid date format' });
  }
  if (pickup >= returnDate) {
    return res.status(400).json({ error: 'Pickup time must be before return time' });
  }

  // Fetch the match group
  const matchGroup = await prisma.matchGroup.findUnique({
    where: { id: matchGroupId },
  });
  if (!matchGroup) {
    return res.status(404).json({ error: 'Match group not found' });
  }
  if (matchGroup.borrowerId !== req.user.id) {
    return res.status(403).json({ error: 'Not authorized to create transaction for this match group' });
  }

  // Fetch all matches with item + owner + request
  const matches = await prisma.match.findMany({
    where: { id: { in: matchIds } },
    include: {
      item: { include: { owner: true } },
      request: true,
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
  }

  // Validate no matches are declined
  const declined = matches.filter(m => m.lenderResponse === 'declined');
  if (declined.length > 0) {
    return res.status(400).json({ error: 'One or more matches have been declined by the lender' });
  }

  // Check all items are available
  const unavailable = matches.filter(m => !m.item.isAvailable);
  if (unavailable.length > 0) {
    return res.status(400).json({
      error: 'Some items are unavailable',
      unavailableItems: unavailable.map(m => ({ id: m.item.id, title: m.item.title })),
    });
  }

  // Deduplicate items — the same item can appear in multiple matches (matched to different requests)
  const itemMap = new Map();
  for (const m of matches) {
    if (!itemMap.has(m.item.id)) itemMap.set(m.item.id, m.item);
  }
  const uniqueItems = [...itemMap.values()];
  const ownerId = matchGroup.lenderId;

  const transaction = await prisma.$transaction(async (tx) => {
    // Re-validate matches inside transaction to prevent TOCTOU race
    const freshMatches = await tx.match.findMany({
      where: { id: { in: matchIds }, lenderResponse: { not: 'declined' } },
      select: { id: true, lenderResponse: true },
    });
    if (freshMatches.length !== matchIds.length) {
      const err = new Error('One or more matches were declined since the request was initiated');
      err.statusCode = 409;
      throw err;
    }

    // Auto-accept any pending matches (with lenderResponse guard)
    const pendingMatchIds = freshMatches.filter(m => m.lenderResponse === 'pending').map(m => m.id);
    if (pendingMatchIds.length > 0) {
      await tx.match.updateMany({
        where: { id: { in: pendingMatchIds }, lenderResponse: 'pending' },
        data: { lenderResponse: 'accepted', respondedAt: new Date() },
      });
    }

    // Date conflict check for each unique item
    for (const item of uniqueItems) {
      const conflict = await hasDateConflict(item.id, pickupTime, returnTime, null, tx);
      if (conflict.hasConflict) {
        const err = new Error(`"${item.title}" is already booked during the requested dates`);
        err.statusCode = 409;
        err.itemId = item.id;
        err.itemTitle = item.title;
        throw err;
      }
      if (!isAvailableForDates(item, pickupTime, returnTime)) {
        const err = new Error(`"${item.title}" is not available during the requested dates`);
        err.statusCode = 409;
        throw err;
      }
    }

    // Calculate fees for each unique item (not per-match, to avoid double-counting)
    const ownerState = uniqueItems[0].owner.state;
    const taxRate = getTaxRate(ownerState);
    const itemFees = uniqueItems.map(item => ({
      item,
      fees: calculateFees(item, pickupTime, returnTime, protectionType, taxRate),
    }));

    // Sum all fees
    const totalRentalFee = itemFees.reduce((sum, f) => sum + f.fees.rentalFee, 0);
    const totalPlatformFee = itemFees.reduce((sum, f) => sum + f.fees.platformFee, 0);
    const totalTaxAmount = itemFees.reduce((sum, f) => sum + f.fees.taxAmount, 0);
    const totalDepositAmount = itemFees.reduce((sum, f) => sum + (f.fees.depositAmount || 0), 0);
    const totalInsuranceFee = itemFees.reduce((sum, f) => sum + (f.fees.insuranceFee || 0), 0);
    const totalCharged = itemFees.reduce((sum, f) => sum + f.fees.totalCharged, 0);

    const primaryItemId = uniqueItems[0].id;

    // Create the transaction
    const txn = await tx.transaction.create({
      data: {
        itemId: primaryItemId,
        borrowerId: req.user.id,
        lenderId: ownerId,
        pickupTime: new Date(pickupTime),
        returnTime: new Date(returnTime),
        rentalFee: parseFloat(totalRentalFee.toFixed(2)),
        platformFee: parseFloat(totalPlatformFee.toFixed(2)),
        taxRate: taxRate,
        taxAmount: parseFloat(totalTaxAmount.toFixed(2)),
        protectionType,
        depositAmount: totalDepositAmount > 0 ? parseFloat(totalDepositAmount.toFixed(2)) : null,
        insuranceFee: totalInsuranceFee > 0 ? parseFloat(totalInsuranceFee.toFixed(2)) : null,
        totalCharged: parseFloat(totalCharged.toFixed(2)),
      },
    });

    // Create TransactionItem rows for per-item breakdown
    await tx.transactionItem.createMany({
      data: itemFees.map(({ item, fees }) => ({
        transactionId: txn.id,
        itemId: item.id,
        rentalFee: fees.rentalFee,
        platformFee: fees.platformFee,
        depositAmount: fees.depositAmount,
        insuranceFee: fees.insuranceFee,
        taxAmount: fees.taxAmount,
      })),
    });

    // Update all related requests to accepted status
    const requestIds = [...new Set(matches.map(m => m.requestId))];
    await tx.request.updateMany({
      where: { id: { in: requestIds }, status: { in: ['open', 'matched'] } },
      data: { status: 'accepted' },
    });

    // Update the match group status to transacted
    await tx.matchGroup.update({
      where: { id: matchGroupId },
      data: { status: 'transacted' },
    });

    // Re-fetch with includes
    return tx.transaction.findUnique({
      where: { id: txn.id },
      include: {
        item: true,
        borrower: {
          select: { id: true, firstName: true, lastName: true, phoneNumber: true },
        },
        lender: {
          select: { id: true, firstName: true, lastName: true, phoneNumber: true },
        },
        transactionItems: {
          include: {
            item: {
              select: { id: true, title: true, photoUrls: true, listingType: true, pricingType: true, priceAmount: true, lateFeeAmount: true, categoryTier1: true, categoryTier2: true },
            },
          },
          orderBy: { createdAt: 'asc' },
        },
      },
    });
  }).catch((err) => {
    if (err.statusCode === 409) {
      return res.status(409).json({
        error: err.message,
        itemId: err.itemId,
        itemTitle: err.itemTitle,
      });
    }
    throw err;
  });

  if (res.headersSent) return;

  // Audit log
  prisma.transactionAuditLog.create({
    data: {
      transactionId: transaction.id,
      userId: req.user.id,
      fromStatus: null,
      toStatus: 'requested',
      action: 'created',
      metadata: { matchGroupId, itemCount: uniqueItems.length, type: 'match_group' },
    },
  }).catch(err => console.error('[AuditLog] Failed to log match group transaction creation:', err.message));

  // Notify lender
  const borrowerFullName = [transaction.borrower.firstName, transaction.borrower.lastName].filter(Boolean).join(' ');
  await notifyUser(ownerId, 'transaction_requested', {
    transactionId: transaction.id,
    itemId: uniqueItems[0].id,
    itemTitle: `Multi-item (${uniqueItems.length} items)`,
    borrowerId: req.user.id,
    borrowerName: borrowerFullName,
  });

  res.status(201).json(transaction);
}

/**
 * Get audit log for a transaction
 * GET /api/transactions/:id/audit-log
 */
async function getTransactionAuditLog(req, res) {
  const { id } = req.params;

  const transaction = await prisma.transaction.findUnique({
    where: { id },
    select: { borrowerId: true, lenderId: true },
  });

  if (!transaction) {
    return res.status(404).json({ error: 'Transaction not found' });
  }

  if (transaction.borrowerId !== req.user.id && transaction.lenderId !== req.user.id) {
    return res.status(403).json({ error: 'Not authorized to view this audit log' });
  }

  const auditLog = await prisma.transactionAuditLog.findMany({
    where: { transactionId: id },
    orderBy: { createdAt: 'asc' },
    include: {
      user: {
        select: { id: true, firstName: true, lastName: true },
      },
    },
  });

  res.json({ auditLog });
}

/**
 * Lender updates protection type on a requested transaction
 * PATCH /api/transactions/:id/protection
 */
async function updateProtectionType(req, res) {
  const { id } = req.params;
  const { protectionType } = req.body;

  const transaction = await prisma.transaction.findUnique({
    where: { id },
    include: {
      item: { include: { owner: true } },
      transactionItems: { include: { item: true } },
      borrower: { select: { id: true, firstName: true, lastName: true } },
    },
  });

  if (!transaction) {
    return res.status(404).json({ error: 'Transaction not found' });
  }
  if (transaction.lenderId !== req.user.id) {
    return res.status(403).json({ error: 'Only the lender can update protection type' });
  }
  if (transaction.status !== 'requested') {
    return res.status(400).json({ error: 'Protection type can only be changed on requested transactions' });
  }
  if (transaction.protectionType === protectionType) {
    return res.status(400).json({ error: 'Protection type is already set to this value' });
  }

  // Recalculate fees with new protection type
  const ownerState = transaction.item.owner.state;
  const taxRate = getTaxRate(ownerState);

  if (transaction.transactionItems && transaction.transactionItems.length > 0) {
    // Multi-item transaction: recalculate per-item and totals
    const itemFees = transaction.transactionItems.map(ti => ({
      ti,
      fees: calculateFees(ti.item, transaction.pickupTime, transaction.returnTime, protectionType, taxRate),
    }));

    const totalRentalFee = itemFees.reduce((sum, f) => sum + f.fees.rentalFee, 0);
    const totalPlatformFee = itemFees.reduce((sum, f) => sum + f.fees.platformFee, 0);
    const totalTaxAmount = itemFees.reduce((sum, f) => sum + f.fees.taxAmount, 0);
    const totalDepositAmount = itemFees.reduce((sum, f) => sum + (f.fees.depositAmount || 0), 0);
    const totalInsuranceFee = itemFees.reduce((sum, f) => sum + (f.fees.insuranceFee || 0), 0);
    const totalCharged = itemFees.reduce((sum, f) => sum + f.fees.totalCharged, 0);

    await prisma.$transaction(async (tx) => {
      // Update each TransactionItem's fees
      for (const { ti, fees } of itemFees) {
        await tx.transactionItem.update({
          where: { id: ti.id },
          data: {
            depositAmount: fees.depositAmount,
            insuranceFee: fees.insuranceFee,
          },
        });
      }
      // Update the transaction totals
      await tx.transaction.update({
        where: { id },
        data: {
          protectionType,
          depositAmount: totalDepositAmount > 0 ? parseFloat(totalDepositAmount.toFixed(2)) : null,
          insuranceFee: totalInsuranceFee > 0 ? parseFloat(totalInsuranceFee.toFixed(2)) : null,
          totalCharged: parseFloat(totalCharged.toFixed(2)),
        },
      });
    });
  } else {
    // Single-item transaction
    const fees = calculateFees(transaction.item, transaction.pickupTime, transaction.returnTime, protectionType, taxRate);
    await prisma.transaction.update({
      where: { id },
      data: {
        protectionType,
        depositAmount: fees.depositAmount,
        insuranceFee: fees.insuranceFee,
        totalCharged: parseFloat(fees.totalCharged.toFixed(2)),
      },
    });
  }

  // Notify borrower about the change
  const lenderName = [req.user.firstName, req.user.lastName].filter(Boolean).join(' ');
  await notifyUser(transaction.borrowerId, 'protection_updated', {
    transactionId: id,
    itemId: transaction.itemId,
    itemTitle: transaction.transactionItems?.length > 0
      ? `Bundle (${transaction.transactionItems.length} items)`
      : transaction.item.title,
    lenderId: req.user.id,
    lenderName,
    oldProtection: transaction.protectionType,
    newProtection: protectionType,
  });

  console.log(`[Transaction] Lender ${req.user.id} changed protection on ${id}: ${transaction.protectionType} → ${protectionType}`);

  // Re-fetch full transaction
  const updated = await prisma.transaction.findUnique({
    where: { id },
    include: {
      item: true,
      borrower: { select: { id: true, firstName: true, lastName: true, phoneNumber: true, profilePhotoUrl: true } },
      lender: { select: { id: true, firstName: true, lastName: true, phoneNumber: true, profilePhotoUrl: true } },
      photos: true,
      ratings: true,
      request: true,
      transactionItems: {
        include: {
          item: {
            select: { id: true, title: true, photoUrls: true, listingType: true, pricingType: true, priceAmount: true, lateFeeAmount: true, categoryTier1: true, categoryTier2: true },
          },
        },
        orderBy: { createdAt: 'asc' },
      },
    },
  });

  res.json(updated);
}

module.exports = {
  createTransaction,
  createBundleTransaction,
  createBundleRequestTransaction,
  createMatchGroupTransaction,
  getTransaction,
  getMyTransactions,
  updateTransactionStatus,
  updateProtectionType,
  disputeTransaction,
  respondToDispute,
  resolveDispute,
  getTransactionAuditLog,
};
