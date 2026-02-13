const express = require('express');
const { param } = require('express-validator');
const { toggleFavorite, getMyFavorites } = require('../controllers/favoriteController');
const { handleValidationErrors } = require('../middleware/validation');
const { authenticate } = require('../middleware/authMiddleware');
const { asyncHandler } = require('../middleware/errorHandler');

const router = express.Router();

// GET /api/favorites — list my favorites
router.get('/', authenticate, asyncHandler(getMyFavorites));

// POST /api/favorites/:itemId — toggle favorite
router.post(
  '/:itemId',
  authenticate,
  [param('itemId').isUUID().withMessage('Invalid item ID')],
  handleValidationErrors,
  asyncHandler(toggleFavorite)
);

module.exports = router;
