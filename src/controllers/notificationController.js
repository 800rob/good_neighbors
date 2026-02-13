const prisma = require('../config/database');
const { getAllNotificationTypes, NOTIFICATION_TYPES } = require('../services/notificationService');

/**
 * Get user's notifications (paginated)
 * GET /api/notifications
 */
async function getNotifications(req, res) {
  const { limit = 20, offset = 0, unreadOnly = 'false' } = req.query;

  const where = {
    userId: req.user.id,
  };

  if (unreadOnly === 'true') {
    where.isRead = false;
  }

  const [notifications, total] = await Promise.all([
    prisma.notification.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      take: Math.min(Math.max(parseInt(limit) || 20, 1), 100),
      skip: Math.max(parseInt(offset) || 0, 0),
    }),
    prisma.notification.count({ where }),
  ]);

  res.json({
    notifications,
    pagination: {
      total,
      limit: Math.min(Math.max(parseInt(limit) || 20, 1), 100),
      offset: Math.max(parseInt(offset) || 0, 0),
    },
  });
}

/**
 * Get unread notification count
 * GET /api/notifications/unread-count
 */
async function getUnreadCount(req, res) {
  const count = await prisma.notification.count({
    where: {
      userId: req.user.id,
      isRead: false,
    },
  });

  res.json({ count });
}

/**
 * Mark a notification as read
 * PUT /api/notifications/:id/read
 */
async function markAsRead(req, res) {
  const { id } = req.params;

  const notification = await prisma.notification.findUnique({
    where: { id },
  });

  if (!notification) {
    return res.status(404).json({ error: 'Notification not found' });
  }

  if (notification.userId !== req.user.id) {
    return res.status(403).json({ error: 'Not authorized' });
  }

  const updated = await prisma.notification.update({
    where: { id },
    data: {
      isRead: true,
      readAt: new Date(),
    },
  });

  res.json(updated);
}

/**
 * Mark all notifications as read
 * PUT /api/notifications/read-all
 */
async function markAllAsRead(req, res) {
  await prisma.notification.updateMany({
    where: {
      userId: req.user.id,
      isRead: false,
    },
    data: {
      isRead: true,
      readAt: new Date(),
    },
  });

  res.json({ message: 'All notifications marked as read' });
}

/**
 * Get user's notification preferences
 * GET /api/notifications/preferences
 */
async function getPreferences(req, res) {
  // Get all notification types with defaults
  const allTypes = getAllNotificationTypes();

  // Get user's saved preferences
  const savedPreferences = await prisma.notificationPreference.findMany({
    where: { userId: req.user.id },
  });

  // Merge saved preferences with defaults
  const preferences = allTypes.map((type) => {
    const saved = savedPreferences.find((p) => p.notificationType === type.type);

    return {
      notificationType: type.type,
      description: type.description,
      inAppEnabled: saved?.inAppEnabled ?? type.defaultInApp,
      emailEnabled: saved?.emailEnabled ?? type.defaultEmail,
      smsEnabled: saved?.smsEnabled ?? type.defaultSms,
    };
  });

  res.json({ preferences });
}

/**
 * Update notification preferences
 * PUT /api/notifications/preferences
 */
async function updatePreferences(req, res) {
  const { notificationType, inAppEnabled, emailEnabled, smsEnabled } = req.body;

  // Validate notification type
  if (!NOTIFICATION_TYPES[notificationType]) {
    return res.status(400).json({ error: 'Invalid notification type' });
  }

  // Upsert the preference
  const preference = await prisma.notificationPreference.upsert({
    where: {
      unique_user_notification_type: {
        userId: req.user.id,
        notificationType,
      },
    },
    update: {
      inAppEnabled: inAppEnabled ?? true,
      emailEnabled: emailEnabled ?? false,
      smsEnabled: smsEnabled ?? false,
    },
    create: {
      userId: req.user.id,
      notificationType,
      inAppEnabled: inAppEnabled ?? true,
      emailEnabled: emailEnabled ?? false,
      smsEnabled: smsEnabled ?? false,
    },
  });

  res.json(preference);
}

/**
 * Delete a notification
 * DELETE /api/notifications/:id
 */
async function deleteNotification(req, res) {
  const { id } = req.params;

  const notification = await prisma.notification.findUnique({
    where: { id },
  });

  if (!notification) {
    return res.status(404).json({ error: 'Notification not found' });
  }

  if (notification.userId !== req.user.id) {
    return res.status(403).json({ error: 'Not authorized' });
  }

  await prisma.notification.delete({ where: { id } });

  res.json({ message: 'Notification deleted' });
}

/**
 * Delete all read notifications for the current user
 * DELETE /api/notifications/read
 */
async function deleteReadNotifications(req, res) {
  const result = await prisma.notification.deleteMany({
    where: {
      userId: req.user.id,
      isRead: true,
    },
  });

  res.json({ message: `Deleted ${result.count} read notifications`, count: result.count });
}

module.exports = {
  getNotifications,
  getUnreadCount,
  markAsRead,
  markAllAsRead,
  getPreferences,
  updatePreferences,
  deleteNotification,
  deleteReadNotifications,
};
