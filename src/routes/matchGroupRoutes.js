const express = require('express');
const { param, body } = require('express-validator');
const {
  getBorrowerMatchGroups,
  getLenderMatchGroups,
  respondToMatchGroup,
  refreshUserMatchGroups,
  getMatchGroup,
} = require('../controllers/matchGroupController');
const { handleValidationErrors } = require('../middleware/validation');
const { authenticate } = require('../middleware/authMiddleware');
const { asyncHandler } = require('../middleware/errorHandler');

const router = express.Router();

// GET /api/match-groups/borrower
router.get('/borrower', authenticate, asyncHandler(getBorrowerMatchGroups));

// GET /api/match-groups/lender
router.get('/lender', authenticate, asyncHandler(getLenderMatchGroups));

// POST /api/match-groups/refresh
router.post('/refresh', authenticate, asyncHandler(refreshUserMatchGroups));

// GET /api/match-groups/:id
router.get(
  '/:id',
  authenticate,
  [param('id').isUUID().withMessage('Invalid match group ID')],
  handleValidationErrors,
  asyncHandler(getMatchGroup)
);

// POST /api/match-groups/:id/respond
router.post(
  '/:id/respond',
  authenticate,
  [
    param('id').isUUID().withMessage('Invalid match group ID'),
    body('matchResponses').isArray({ min: 1 }).withMessage('matchResponses must be a non-empty array'),
    body('matchResponses.*.matchId').isUUID().withMessage('Each matchId must be a valid UUID'),
    body('matchResponses.*.response').isIn(['accepted', 'declined']).withMessage('Each response must be "accepted" or "declined"'),
  ],
  handleValidationErrors,
  asyncHandler(respondToMatchGroup)
);

module.exports = router;
