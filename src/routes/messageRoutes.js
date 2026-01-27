const express = require('express');
const { getUnreadCount } = require('../controllers/messageController');
const { authenticate } = require('../middleware/authMiddleware');
const { asyncHandler } = require('../middleware/errorHandler');

const router = express.Router();

// GET /api/messages/unread-count
router.get('/unread-count', authenticate, asyncHandler(getUnreadCount));

module.exports = router;
