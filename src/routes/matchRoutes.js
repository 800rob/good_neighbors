const express = require('express');
const { body, param } = require('express-validator');
const { respondToMatch, getIncomingMatches } = require('../controllers/matchController');
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

module.exports = router;
