const express = require('express');
const { body, param } = require('express-validator');
const {
  createTransaction,
  createBundleTransaction,
  createBundleRequestTransaction,
  getTransaction,
  getMyTransactions,
  updateTransactionStatus,
  disputeTransaction,
  respondToDispute,
  resolveDispute,
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

// POST /api/transactions/bundle-request (must be before /:id route)
router.post(
  '/bundle-request',
  authenticate,
  [
    body('bundleId').isUUID().withMessage('Invalid bundle ID'),
    body('matchIds').isArray({ min: 1 }).withMessage('matchIds must be a non-empty array'),
    body('matchIds.*').isUUID().withMessage('Each matchId must be a valid UUID'),
    body('pickupTime').isISO8601().withMessage('Valid pickup time is required'),
    body('returnTime')
      .isISO8601()
      .withMessage('Valid return time is required')
      .custom((value, { req }) => {
        if (new Date(value) <= new Date(req.body.pickupTime)) {
          throw new Error('Return time must be after pickup time');
        }
        return true;
      }),
    body('protectionType')
      .isIn(PROTECTION_TYPES)
      .withMessage('Invalid protection type'),
  ],
  handleValidationErrors,
  asyncHandler(createBundleRequestTransaction)
);

// POST /api/transactions/bundle (must be before /:id route)
router.post(
  '/bundle',
  authenticate,
  [
    body('bundleId').isUUID().withMessage('Invalid bundle ID'),
    body('pickupTime').isISO8601().withMessage('Valid pickup time is required'),
    body('returnTime')
      .isISO8601()
      .withMessage('Valid return time is required')
      .custom((value, { req }) => {
        if (new Date(value) <= new Date(req.body.pickupTime)) {
          throw new Error('Return time must be after pickup time');
        }
        return true;
      }),
    body('protectionType')
      .isIn(PROTECTION_TYPES)
      .withMessage('Invalid protection type'),
  ],
  handleValidationErrors,
  asyncHandler(createBundleTransaction)
);

// POST /api/transactions
router.post(
  '/',
  authenticate,
  [
    body('matchId').optional().isUUID().withMessage('Invalid match ID'),
    body('itemId').optional().isUUID().withMessage('Invalid item ID'),
    body('pickupTime').isISO8601().withMessage('Valid pickup time is required'),
    body('returnTime')
      .isISO8601()
      .withMessage('Valid return time is required')
      .custom((value, { req }) => {
        if (new Date(value) <= new Date(req.body.pickupTime)) {
          throw new Error('Return time must be after pickup time');
        }
        return true;
      }),
    body('protectionType')
      .isIn(PROTECTION_TYPES)
      .withMessage('Invalid protection type'),
  ],
  handleValidationErrors,
  asyncHandler(createTransaction)
);

// GET /api/transactions/:id
router.get(
  '/:id',
  authenticate,
  [param('id').isUUID().withMessage('Invalid transaction ID')],
  handleValidationErrors,
  asyncHandler(getTransaction)
);

// PUT /api/transactions/:id/status
router.put(
  '/:id/status',
  authenticate,
  [
    param('id').isUUID().withMessage('Invalid transaction ID'),
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
    param('id').isUUID().withMessage('Invalid transaction ID'),
    body('disputeReason')
      .trim()
      .notEmpty()
      .withMessage('Dispute reason is required'),
    body('disputeCategory')
      .optional()
      .isIn(['item_damaged', 'item_not_returned', 'wrong_item', 'late_return', 'fee_dispute', 'other'])
      .withMessage('Invalid dispute category'),
  ],
  handleValidationErrors,
  asyncHandler(disputeTransaction)
);

// PUT /api/transactions/:id/dispute/respond
router.put(
  '/:id/dispute/respond',
  authenticate,
  [
    param('id').isUUID().withMessage('Invalid transaction ID'),
    body('disputeResponse')
      .trim()
      .notEmpty()
      .withMessage('Response text is required'),
  ],
  handleValidationErrors,
  asyncHandler(respondToDispute)
);

// PUT /api/transactions/:id/dispute/resolve
router.put(
  '/:id/dispute/resolve',
  authenticate,
  [
    param('id').isUUID().withMessage('Invalid transaction ID'),
    body('disputeResolution')
      .isIn(['resolved_for_borrower', 'resolved_for_lender', 'mutual_agreement'])
      .withMessage('Invalid resolution type'),
    body('disputeResolutionNotes')
      .optional()
      .trim(),
  ],
  handleValidationErrors,
  asyncHandler(resolveDispute)
);

// Messages
// POST /api/transactions/:id/messages
router.post(
  '/:id/messages',
  authenticate,
  [
    param('id').isUUID().withMessage('Invalid transaction ID'),
    body('messageText').trim().notEmpty().withMessage('Message text is required'),
    body('photoUrl').optional().isURL().withMessage('Invalid photo URL'),
  ],
  handleValidationErrors,
  asyncHandler(sendMessage)
);

// GET /api/transactions/:id/messages
router.get(
  '/:id/messages',
  authenticate,
  [param('id').isUUID().withMessage('Invalid transaction ID')],
  handleValidationErrors,
  asyncHandler(getMessages)
);

// Ratings
// POST /api/transactions/:id/rating
router.post(
  '/:id/rating',
  authenticate,
  [
    param('id').isUUID().withMessage('Invalid transaction ID'),
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
router.get(
  '/:id/ratings',
  authenticate,
  [param('id').isUUID().withMessage('Invalid transaction ID')],
  handleValidationErrors,
  asyncHandler(getTransactionRatings)
);

module.exports = router;
