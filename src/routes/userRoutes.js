const express = require('express');
const { body } = require('express-validator');
const {
  getCurrentUser,
  updateCurrentUser,
  getUserProfile,
  getUserRatings,
} = require('../controllers/userController');
const { handleValidationErrors } = require('../middleware/validation');
const { authenticate } = require('../middleware/authMiddleware');
const { asyncHandler } = require('../middleware/errorHandler');

const router = express.Router();

// GET /api/users/me
router.get('/me', authenticate, asyncHandler(getCurrentUser));

// PUT /api/users/me
router.put(
  '/me',
  authenticate,
  [
    body('firstName').optional().trim().notEmpty().withMessage('First name cannot be empty'),
    body('middleName').optional().trim(),
    body('lastName').optional().trim().notEmpty().withMessage('Last name cannot be empty'),
    body('phoneNumber').optional().isMobilePhone().withMessage('Invalid phone number'),
    body('latitude').optional().isFloat({ min: -90, max: 90 }).withMessage('Invalid latitude'),
    body('longitude').optional().isFloat({ min: -180, max: 180 }).withMessage('Invalid longitude'),
  ],
  handleValidationErrors,
  asyncHandler(updateCurrentUser)
);

// GET /api/users/:id
router.get('/:id', authenticate, asyncHandler(getUserProfile));

// GET /api/users/:id/ratings
router.get('/:id/ratings', authenticate, asyncHandler(getUserRatings));

module.exports = router;
