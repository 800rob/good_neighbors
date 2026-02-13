const express = require('express');
const { param, query, body } = require('express-validator');
const router = express.Router();
const { authenticate } = require('../middleware/authMiddleware');
const { handleValidationErrors } = require('../middleware/validation');
const { asyncHandler } = require('../middleware/errorHandler');
const {
  getNotifications,
  getUnreadCount,
  markAsRead,
  markAllAsRead,
  getPreferences,
  updatePreferences,
  deleteNotification,
  deleteReadNotifications,
} = require('../controllers/notificationController');

// All routes require authentication
router.use(authenticate);

// Get notifications
router.get(
  '/',
  [
    query('limit').optional().isInt({ min: 1, max: 100 }).withMessage('Limit must be 1-100'),
    query('offset').optional().isInt({ min: 0 }).withMessage('Offset must be >= 0'),
    query('unreadOnly').optional().isBoolean().withMessage('unreadOnly must be boolean'),
  ],
  handleValidationErrors,
  asyncHandler(getNotifications)
);

// Get unread count
router.get('/unread-count', asyncHandler(getUnreadCount));

// Get preferences
router.get('/preferences', asyncHandler(getPreferences));

// Update preferences
router.put(
  '/preferences',
  [
    body('notificationType').trim().notEmpty().withMessage('Notification type is required'),
    body('inAppEnabled').optional().isBoolean().withMessage('inAppEnabled must be boolean'),
    body('emailEnabled').optional().isBoolean().withMessage('emailEnabled must be boolean'),
    body('smsEnabled').optional().isBoolean().withMessage('smsEnabled must be boolean'),
  ],
  handleValidationErrors,
  asyncHandler(updatePreferences)
);

// Mark all as read
router.put('/read-all', asyncHandler(markAllAsRead));

// Delete all read notifications
router.delete('/read', asyncHandler(deleteReadNotifications));

// Mark single notification as read
router.put(
  '/:id/read',
  [param('id').isUUID().withMessage('Invalid notification ID')],
  handleValidationErrors,
  asyncHandler(markAsRead)
);

// Delete notification
router.delete(
  '/:id',
  [param('id').isUUID().withMessage('Invalid notification ID')],
  handleValidationErrors,
  asyncHandler(deleteNotification)
);

module.exports = router;
