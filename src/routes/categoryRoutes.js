const express = require('express');
const {
  getHierarchy,
  getTier1,
  getTier2,
  getTier3,
  searchCategories,
  validateCategories,
  getPricingSuggestions,
  getSpecs,
  getSuggestions
} = require('../controllers/categoryController');
const { asyncHandler } = require('../middleware/errorHandler');

const router = express.Router();

// GET /api/categories/hierarchy - Get complete category tree
router.get('/hierarchy', asyncHandler(getHierarchy));

// GET /api/categories/tier1?type=item|service - Get top-level categories
router.get('/tier1', asyncHandler(getTier1));

// GET /api/categories/tier2?type=item&tier1=Tools - Get subcategories
router.get('/tier2', asyncHandler(getTier2));

// GET /api/categories/tier3?type=item&tier1=Tools&tier2=Power%20Tools - Get items
router.get('/tier3', asyncHandler(getTier3));

// GET /api/categories/search?query=snow%20board&type=item - Fuzzy search
router.get('/search', asyncHandler(searchCategories));

// POST /api/categories/validate - Validate category selection
router.post('/validate', asyncHandler(validateCategories));

// GET /api/categories/pricing?type=item&tier1=Tools&tier2=Power%20Tools&tier3=Drill&condition=good - Get pricing suggestions
router.get('/pricing', asyncHandler(getPricingSuggestions));

// GET /api/categories/specs?type=item&tier1=Outdoor%20%26%20Recreation&tier2=Winter%20Sports&tier3=Alpine%20Skis - Get spec definitions
router.get('/specs', asyncHandler(getSpecs));

// GET /api/categories/suggestions?type=item&tier1=...&tier2=...&tier3=... - Get sibling tier3 items for bundling
router.get('/suggestions', asyncHandler(getSuggestions));

module.exports = router;
