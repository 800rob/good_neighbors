const express = require('express');
const router = express.Router();
const { authenticate } = require('../middleware/authMiddleware');
const {
  getNotifications,
  getUnreadCount,
  markAsRead,
  markAllAsRead,
  getPreferences,
  updatePreferences,
  deleteNotification,
} = require('../controllers/notificationController');

// All routes require authentication
router.use(authenticate);

// Get notifications
router.get('/', getNotifications);

// Get unread count
router.get('/unread-count', getUnreadCount);

// Get preferences
router.get('/preferences', getPreferences);

// Update preferences
router.put('/preferences', updatePreferences);

// Mark all as read
router.put('/read-all', markAllAsRead);

// Mark single notification as read
router.put('/:id/read', markAsRead);

// Delete notification
router.delete('/:id', deleteNotification);

module.exports = router;
