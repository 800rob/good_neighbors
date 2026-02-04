const express = require('express');
const { query } = require('express-validator');
const { getNearbyDemand, getNearbySupply } = require('../controllers/insightsController');
const { handleValidationErrors } = require('../middleware/validation');
const { authenticate } = require('../middleware/authMiddleware');
const { asyncHandler } = require('../middleware/errorHandler');

const router = express.Router();

// GET /api/insights/nearby-demand
router.get(
  '/nearby-demand',
  authenticate,
  [
    query('radiusMiles').optional().isFloat({ min: 1, max: 100 }).withMessage('Radius must be 1-100 miles'),
    query('expandedRadiusMiles').optional().isFloat({ min: 1, max: 100 }).withMessage('Expanded radius must be 1-100 miles'),
  ],
  handleValidationErrors,
  asyncHandler(getNearbyDemand)
);

// GET /api/insights/nearby-supply
router.get(
  '/nearby-supply',
  authenticate,
  [
    query('radiusMiles').optional().isFloat({ min: 1, max: 100 }).withMessage('Radius must be 1-100 miles'),
    query('expandedRadiusMiles').optional().isFloat({ min: 1, max: 100 }).withMessage('Expanded radius must be 1-100 miles'),
  ],
  handleValidationErrors,
  asyncHandler(getNearbySupply)
);

module.exports = router;
