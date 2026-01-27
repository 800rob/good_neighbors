const express = require('express');
const { body, query } = require('express-validator');
const {
  createItem,
  getItems,
  getItem,
  updateItem,
  deleteItem,
  getMyItems,
} = require('../controllers/itemController');
const { handleValidationErrors } = require('../middleware/validation');
const { authenticate, optionalAuth } = require('../middleware/authMiddleware');
const { asyncHandler } = require('../middleware/errorHandler');

const router = express.Router();

const CATEGORIES = [
  'tools',
  'outdoor_recreation',
  'party_events',
  'lawn_garden',
  'vehicles_transport',
  'workspace',
  'specialized_equipment',
  'services',
  'other',
];

const CONDITIONS = ['new', 'excellent', 'good', 'fair', 'poor'];
const PRICING_TYPES = ['free', 'hourly', 'daily', 'weekly', 'monthly'];
const PROTECTION_PREFS = ['waiver_ok', 'insurance_required', 'deposit_required', 'let_me_decide'];

// GET /api/items/my-listings (must be before /:id route)
router.get('/my-listings', authenticate, asyncHandler(getMyItems));

// POST /api/items
router.post(
  '/',
  authenticate,
  [
    body('category').isIn(CATEGORIES).withMessage('Invalid category'),
    body('title').trim().notEmpty().withMessage('Title is required'),
    body('condition').isIn(CONDITIONS).withMessage('Invalid condition'),
    body('replacementValue')
      .isFloat({ min: 0 })
      .withMessage('Replacement value must be a positive number'),
    body('pricingType').isIn(PRICING_TYPES).withMessage('Invalid pricing type'),
    body('priceAmount')
      .optional()
      .isFloat({ min: 0 })
      .withMessage('Price must be a positive number'),
    body('lateFeeAmount')
      .optional()
      .isFloat({ min: 0 })
      .withMessage('Late fee must be a positive number'),
    body('protectionPreference')
      .isIn(PROTECTION_PREFS)
      .withMessage('Invalid protection preference'),
    body('depositPercentage')
      .optional()
      .isInt({ min: 0, max: 100 })
      .withMessage('Deposit percentage must be 0-100'),
    body('photoUrls').optional().isArray().withMessage('Photo URLs must be an array'),
  ],
  handleValidationErrors,
  asyncHandler(createItem)
);

// GET /api/items
router.get(
  '/',
  optionalAuth,
  [
    query('category').optional().isIn(CATEGORIES).withMessage('Invalid category'),
    query('condition').optional().isIn(CONDITIONS).withMessage('Invalid condition'),
    query('pricingType').optional().isIn(PRICING_TYPES).withMessage('Invalid pricing type'),
    query('latitude').optional().isFloat({ min: -90, max: 90 }).withMessage('Invalid latitude'),
    query('longitude').optional().isFloat({ min: -180, max: 180 }).withMessage('Invalid longitude'),
    query('radiusMiles').optional().isFloat({ min: 0 }).withMessage('Invalid radius'),
    query('limit').optional().isInt({ min: 1, max: 100 }).withMessage('Limit must be 1-100'),
    query('offset').optional().isInt({ min: 0 }).withMessage('Offset must be >= 0'),
  ],
  handleValidationErrors,
  asyncHandler(getItems)
);

// GET /api/items/:id
router.get('/:id', optionalAuth, asyncHandler(getItem));

// PUT /api/items/:id
router.put(
  '/:id',
  authenticate,
  [
    body('category').optional().isIn(CATEGORIES).withMessage('Invalid category'),
    body('condition').optional().isIn(CONDITIONS).withMessage('Invalid condition'),
    body('pricingType').optional().isIn(PRICING_TYPES).withMessage('Invalid pricing type'),
    body('protectionPreference')
      .optional()
      .isIn(PROTECTION_PREFS)
      .withMessage('Invalid protection preference'),
  ],
  handleValidationErrors,
  asyncHandler(updateItem)
);

// DELETE /api/items/:id
router.delete('/:id', authenticate, asyncHandler(deleteItem));

module.exports = router;
