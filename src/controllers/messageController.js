const prisma = require('../config/database');

/**
 * Send a message in a transaction
 * POST /api/transactions/:id/messages
 */
async function sendMessage(req, res) {
  const { id: transactionId } = req.params;
  const { messageText, photoUrl } = req.body;

  // Get transaction and verify user is participant
  const transaction = await prisma.transaction.findUnique({
    where: { id: transactionId },
  });

  if (!transaction) {
    return res.status(404).json({ error: 'Transaction not found' });
  }

  const isBorrower = transaction.borrowerId === req.user.id;
  const isLender = transaction.lenderId === req.user.id;

  if (!isBorrower && !isLender) {
    return res.status(403).json({ error: 'Not authorized to message in this transaction' });
  }

  // Determine recipient
  const recipientId = isBorrower ? transaction.lenderId : transaction.borrowerId;

  const message = await prisma.message.create({
    data: {
      transactionId,
      senderId: req.user.id,
      recipientId,
      messageText,
      photoUrl,
    },
    include: {
      sender: {
        select: { id: true, fullName: true, profilePhotoUrl: true },
      },
    },
  });

  res.status(201).json(message);
}

/**
 * Get messages for a transaction
 * GET /api/transactions/:id/messages
 */
async function getMessages(req, res) {
  const { id: transactionId } = req.params;
  const { limit = 50, offset = 0 } = req.query;

  // Get transaction and verify user is participant
  const transaction = await prisma.transaction.findUnique({
    where: { id: transactionId },
  });

  if (!transaction) {
    return res.status(404).json({ error: 'Transaction not found' });
  }

  if (transaction.borrowerId !== req.user.id && transaction.lenderId !== req.user.id) {
    return res.status(403).json({ error: 'Not authorized to view messages in this transaction' });
  }

  // Get messages
  const [messages, total] = await Promise.all([
    prisma.message.findMany({
      where: { transactionId },
      include: {
        sender: {
          select: { id: true, fullName: true, profilePhotoUrl: true },
        },
      },
      orderBy: { createdAt: 'asc' },
      take: parseInt(limit),
      skip: parseInt(offset),
    }),
    prisma.message.count({ where: { transactionId } }),
  ]);

  // Mark messages as read for the current user
  await prisma.message.updateMany({
    where: {
      transactionId,
      recipientId: req.user.id,
      isRead: false,
    },
    data: { isRead: true },
  });

  res.json({
    messages,
    pagination: {
      total,
      limit: parseInt(limit),
      offset: parseInt(offset),
    },
  });
}

/**
 * Get unread message count
 * GET /api/messages/unread-count
 */
async function getUnreadCount(req, res) {
  const count = await prisma.message.count({
    where: {
      recipientId: req.user.id,
      isRead: false,
    },
  });

  res.json({ unreadCount: count });
}

module.exports = { sendMessage, getMessages, getUnreadCount };
