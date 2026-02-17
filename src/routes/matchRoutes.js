const express = require('express');
const { body, param } = require('express-validator');
const { respondToMatch, getIncomingMatches, respondToBundle } = require('../controllers/matchController');
const { handleValidationErrors } = require('../middleware/validation');
const { authenticate } = require('../middleware/authMiddleware');
const { asyncHandler } = require('../middleware/errorHandler');

const router = express.Router();

// GET /api/matches/incoming
router.get('/incoming', authenticate, asyncHandler(getIncomingMatches));

// PUT /api/matches/:id/respond
router.put(
  '/:id/respond',
  authenticate,
  [
    param('id').isUUID().withMessage('Invalid match ID'),
    body('response')
      .isIn(['accepted', 'declined'])
      .withMessage('Response must be "accepted" or "declined"'),
  ],
  handleValidationErrors,
  asyncHandler(respondToMatch)
);

// POST /api/matches/respond-bundle
router.post(
  '/respond-bundle',
  authenticate,
  [
    body('bundleId').isUUID().withMessage('Invalid bundle ID'),
    body('matchResponses').isArray({ min: 1 }).withMessage('matchResponses must be a non-empty array'),
    body('matchResponses.*.matchId').isUUID().withMessage('Invalid match ID in matchResponses'),
    body('matchResponses.*.response')
      .isIn(['accepted', 'declined'])
      .withMessage('Each response must be "accepted" or "declined"'),
  ],
  handleValidationErrors,
  asyncHandler(respondToBundle)
);

module.exports = router;
