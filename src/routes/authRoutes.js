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
    body('firstName').trim().notEmpty().withMessage('First name is required'),
    body('lastName').trim().notEmpty().withMessage('Last name is required'),
    body('middleName').optional().trim(),
    body('phoneNumber')
      .optional({ values: 'falsy' })
      .custom((value) => {
        const digits = value.replace(/\D/g, '');
        if (digits.length < 10 || digits.length > 15) {
          throw new Error('Phone number must be 10-15 digits');
        }
        return true;
      }),
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
