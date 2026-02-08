const express = require('express');
const { body, query } = require('express-validator');
const {
  createRequest,
  getRequest,
  getMyRequests,
  cancelRequest,
  getRequestMatches,
  browseRequests,
} = require('../controllers/requestController');
const { respondToMatch, getIncomingMatches } = require('../controllers/matchController');
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

// GET /api/requests/browse (public, must be before /:id route)
router.get(
  '/browse',
  optionalAuth,
  [
    query('search').optional().trim(),
    query('listingType').optional().isIn(['item', 'service']),
    query('categoryTier1').optional().trim(),
    query('categoryTier2').optional().trim(),
    query('categoryTier3').optional().trim(),
    query('latitude').optional().isFloat({ min: -90, max: 90 }),
    query('longitude').optional().isFloat({ min: -180, max: 180 }),
    query('radiusMiles').optional().isFloat({ min: 0.1, max: 100 }),
    query('neededFrom').optional().isISO8601(),
    query('neededUntil').optional().isISO8601(),
    query('limit').optional().isInt({ min: 1, max: 100 }),
    query('offset').optional().isInt({ min: 0 }),
  ],
  handleValidationErrors,
  asyncHandler(browseRequests)
);

// GET /api/requests/my-requests (must be before /:id route)
router.get('/my-requests', authenticate, asyncHandler(getMyRequests));

// POST /api/requests
router.post(
  '/',
  authenticate,
  [
    body('category').isIn(CATEGORIES).withMessage('Invalid category'),
    body('title').trim().notEmpty().withMessage('Title is required'),
    body('neededFrom').isISO8601().withMessage('Valid start date is required'),
    body('neededUntil').isISO8601().withMessage('Valid end date is required'),
    body('maxBudget')
      .optional()
      .isFloat({ min: 0 })
      .withMessage('Max budget must be a positive number'),
    body('maxDistanceMiles')
      .optional()
      .isFloat({ min: 0.1, max: 100 })
      .withMessage('Max distance must be between 0.1 and 100 miles'),
    body('latitude').optional().isFloat({ min: -90, max: 90 }).withMessage('Invalid latitude'),
    body('longitude').optional().isFloat({ min: -180, max: 180 }).withMessage('Invalid longitude'),
  ],
  handleValidationErrors,
  asyncHandler(createRequest)
);

// GET /api/requests/:id
router.get('/:id', authenticate, asyncHandler(getRequest));

// PUT /api/requests/:id/cancel
router.put('/:id/cancel', authenticate, asyncHandler(cancelRequest));

// GET /api/requests/:id/matches
router.get('/:id/matches', authenticate, asyncHandler(getRequestMatches));

module.exports = router;
