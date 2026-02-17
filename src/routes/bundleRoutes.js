const express = require('express');
const { body, param, query } = require('express-validator');
const {
  createBundle,
  getBundles,
  getMyBundles,
  getTemplates,
  getTemplateBySlug,
  getBundle,
  updateBundle,
  deleteBundle,
  addBundleItem,
  updateBundleItem,
  removeBundleItem,
  publishBundle,
  getBundleMatches,
} = require('../controllers/bundleController');
const { handleValidationErrors } = require('../middleware/validation');
const { authenticate, optionalAuth } = require('../middleware/authMiddleware');
const { asyncHandler } = require('../middleware/errorHandler');

const router = express.Router();

// --- Named routes (must come before /:id) ---

// GET /api/bundles/my-bundles
router.get('/my-bundles', authenticate, asyncHandler(getMyBundles));

// GET /api/bundles/templates
router.get('/templates', asyncHandler(getTemplates));

// GET /api/bundles/templates/:slug
router.get('/templates/:slug', asyncHandler(getTemplateBySlug));

// POST /api/bundles
router.post(
  '/',
  authenticate,
  [
    body('title').trim().notEmpty().withMessage('Title is required'),
  ],
  handleValidationErrors,
  asyncHandler(createBundle)
);

// GET /api/bundles
router.get(
  '/',
  optionalAuth,
  [
    query('limit').optional().isInt({ min: 1, max: 100 }).withMessage('Limit must be 1-100'),
    query('offset').optional().isInt({ min: 0 }).withMessage('Offset must be >= 0'),
  ],
  handleValidationErrors,
  asyncHandler(getBundles)
);

// GET /api/bundles/:bundleId/matches (bundle match aggregation for borrower)
router.get(
  '/:bundleId/matches',
  authenticate,
  [param('bundleId').isUUID().withMessage('Invalid bundle ID')],
  handleValidationErrors,
  asyncHandler(getBundleMatches)
);

// --- Parameterized routes ---

// GET /api/bundles/:id
router.get(
  '/:id',
  optionalAuth,
  [param('id').isUUID().withMessage('Invalid bundle ID')],
  handleValidationErrors,
  asyncHandler(getBundle)
);

// PUT /api/bundles/:id
router.put(
  '/:id',
  authenticate,
  [param('id').isUUID().withMessage('Invalid bundle ID')],
  handleValidationErrors,
  asyncHandler(updateBundle)
);

// DELETE /api/bundles/:id
router.delete(
  '/:id',
  authenticate,
  [param('id').isUUID().withMessage('Invalid bundle ID')],
  handleValidationErrors,
  asyncHandler(deleteBundle)
);

// POST /api/bundles/:id/items
router.post(
  '/:id/items',
  authenticate,
  [param('id').isUUID().withMessage('Invalid bundle ID')],
  handleValidationErrors,
  asyncHandler(addBundleItem)
);

// PUT /api/bundles/:id/items/:bundleItemId
router.put(
  '/:id/items/:bundleItemId',
  authenticate,
  [
    param('id').isUUID().withMessage('Invalid bundle ID'),
    param('bundleItemId').isUUID().withMessage('Invalid bundle item ID'),
  ],
  handleValidationErrors,
  asyncHandler(updateBundleItem)
);

// DELETE /api/bundles/:id/items/:bundleItemId
router.delete(
  '/:id/items/:bundleItemId',
  authenticate,
  [
    param('id').isUUID().withMessage('Invalid bundle ID'),
    param('bundleItemId').isUUID().withMessage('Invalid bundle item ID'),
  ],
  handleValidationErrors,
  asyncHandler(removeBundleItem)
);

// POST /api/bundles/:id/publish
router.post(
  '/:id/publish',
  authenticate,
  [param('id').isUUID().withMessage('Invalid bundle ID')],
  handleValidationErrors,
  asyncHandler(publishBundle)
);

module.exports = router;
