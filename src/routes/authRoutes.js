const express = require('express');
const { body } = require('express-validator');
const { register, login, logout } = require('../controllers/authController');
const { handleValidationErrors } = require('../middleware/validation');
const { authenticate } = require('../middleware/authMiddleware');
const { asyncHandler } = require('../middleware/errorHandler');

const router = express.Router();

// POST /api/auth/register
router.post(
  '/register',
  [
    body('email').isEmail().normalizeEmail().withMessage('Valid email is required'),
    body('password')
      .isLength({ min: 8 })
      .withMessage('Password must be at least 8 characters'),
    body('fullName').trim().notEmpty().withMessage('Full name is required'),
    body('phoneNumber').optional().isMobilePhone().withMessage('Invalid phone number'),
    body('latitude').optional().isFloat({ min: -90, max: 90 }).withMessage('Invalid latitude'),
    body('longitude').optional().isFloat({ min: -180, max: 180 }).withMessage('Invalid longitude'),
  ],
  handleValidationErrors,
  asyncHandler(register)
);

// POST /api/auth/login
router.post(
  '/login',
  [
    body('email').isEmail().normalizeEmail().withMessage('Valid email is required'),
    body('password').notEmpty().withMessage('Password is required'),
  ],
  handleValidationErrors,
  asyncHandler(login)
);

// POST /api/auth/logout
router.post('/logout', authenticate, asyncHandler(logout));

module.exports = router;
