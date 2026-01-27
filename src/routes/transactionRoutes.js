const express = require('express');
const { body } = require('express-validator');
const {
  createTransaction,
  getTransaction,
  getMyTransactions,
  updateTransactionStatus,
  disputeTransaction,
} = require('../controllers/transactionController');
const { sendMessage, getMessages } = require('../controllers/messageController');
const { submitRating, getTransactionRatings } = require('../controllers/ratingController');
const { handleValidationErrors } = require('../middleware/validation');
const { authenticate } = require('../middleware/authMiddleware');
const { asyncHandler } = require('../middleware/errorHandler');

const router = express.Router();

const PROTECTION_TYPES = ['waiver', 'insurance', 'deposit'];
const TRANSACTION_STATUSES = [
  'requested',
  'accepted',
  'pickup_confirmed',
  'active',
  'return_initiated',
  'return_confirmed',
  'completed',
  'disputed',
  'cancelled',
];

// GET /api/transactions/my-transactions (must be before /:id route)
router.get('/my-transactions', authenticate, asyncHandler(getMyTransactions));

// POST /api/transactions
router.post(
  '/',
  authenticate,
  [
    body('matchId').optional().isUUID().withMessage('Invalid match ID'),
    body('itemId').optional().isUUID().withMessage('Invalid item ID'),
    body('pickupTime').isISO8601().withMessage('Valid pickup time is required'),
    body('returnTime').isISO8601().withMessage('Valid return time is required'),
    body('protectionType')
      .isIn(PROTECTION_TYPES)
      .withMessage('Invalid protection type'),
  ],
  handleValidationErrors,
  asyncHandler(createTransaction)
);

// GET /api/transactions/:id
router.get('/:id', authenticate, asyncHandler(getTransaction));

// PUT /api/transactions/:id/status
router.put(
  '/:id/status',
  authenticate,
  [
    body('status')
      .isIn(TRANSACTION_STATUSES)
      .withMessage('Invalid status'),
    body('disputeReason')
      .optional()
      .trim()
      .notEmpty()
      .withMessage('Dispute reason cannot be empty'),
  ],
  handleValidationErrors,
  asyncHandler(updateTransactionStatus)
);

// PUT /api/transactions/:id/dispute
router.put(
  '/:id/dispute',
  authenticate,
  [
    body('disputeReason')
      .trim()
      .notEmpty()
      .withMessage('Dispute reason is required'),
  ],
  handleValidationErrors,
  asyncHandler(disputeTransaction)
);

// Messages
// POST /api/transactions/:id/messages
router.post(
  '/:id/messages',
  authenticate,
  [
    body('messageText').trim().notEmpty().withMessage('Message text is required'),
    body('photoUrl').optional().isURL().withMessage('Invalid photo URL'),
  ],
  handleValidationErrors,
  asyncHandler(sendMessage)
);

// GET /api/transactions/:id/messages
router.get('/:id/messages', authenticate, asyncHandler(getMessages));

// Ratings
// POST /api/transactions/:id/rating
router.post(
  '/:id/rating',
  authenticate,
  [
    body('overallRating')
      .isInt({ min: 1, max: 5 })
      .withMessage('Overall rating must be 1-5'),
    body('onTimeRating')
      .optional()
      .isInt({ min: 1, max: 5 })
      .withMessage('On-time rating must be 1-5'),
    body('communicationRating')
      .optional()
      .isInt({ min: 1, max: 5 })
      .withMessage('Communication rating must be 1-5'),
    body('conditionRating')
      .optional()
      .isInt({ min: 1, max: 5 })
      .withMessage('Condition rating must be 1-5'),
    body('itemAsDescribedRating')
      .optional()
      .isInt({ min: 1, max: 5 })
      .withMessage('Item as described rating must be 1-5'),
    body('wouldTransactAgain')
      .optional()
      .isBoolean()
      .withMessage('Would transact again must be boolean'),
  ],
  handleValidationErrors,
  asyncHandler(submitRating)
);

// GET /api/transactions/:id/ratings
router.get('/:id/ratings', authenticate, asyncHandler(getTransactionRatings));

module.exports = router;
