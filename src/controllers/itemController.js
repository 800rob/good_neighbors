const prisma = require('../config/database');
const { calculateDistance } = require('../utils/distance');

/**
 * Create a new item listing
 * POST /api/items
 */
async function createItem(req, res) {
  const {
    category,
    subcategory,
    title,
    description,
    condition,
    replacementValue,
    pricingType,
    priceAmount,
    lateFeeAmount,
    protectionPreference,
    depositPercentage,
    photoUrls,
    specialInstructions,
  } = req.body;

  const item = await prisma.item.create({
    data: {
      ownerId: req.user.id,
      category,
      subcategory,
      title,
      description,
      condition,
      replacementValue: parseFloat(replacementValue),
      pricingType,
      priceAmount: priceAmount ? parseFloat(priceAmount) : null,
      lateFeeAmount: lateFeeAmount ? parseFloat(lateFeeAmount) : null,
      protectionPreference,
      depositPercentage: depositPercentage || 0,
      photoUrls: photoUrls || [],
      specialInstructions,
    },
    include: {
      owner: {
        select: { id: true, fullName: true, neighborhood: true },
      },
    },
  });

  res.status(201).json(item);
}

/**
 * Get all items with filters
 * GET /api/items
 */
async function getItems(req, res) {
  const {
    category,
    subcategory,
    pricingType,
    minPrice,
    maxPrice,
    condition,
    latitude,
    longitude,
    radiusMiles = 25,
    limit = 20,
    offset = 0,
    sortBy = 'createdAt',
    sortOrder = 'desc',
  } = req.query;

  // Build where clause
  const where = { isAvailable: true };

  if (category) where.category = category;
  if (subcategory) where.subcategory = subcategory;
  if (pricingType) where.pricingType = pricingType;
  if (condition) where.condition = condition;

  if (minPrice || maxPrice) {
    where.priceAmount = {};
    if (minPrice) where.priceAmount.gte = parseFloat(minPrice);
    if (maxPrice) where.priceAmount.lte = parseFloat(maxPrice);
  }

  // Get items
  let items = await prisma.item.findMany({
    where,
    include: {
      owner: {
        select: {
          id: true,
          fullName: true,
          neighborhood: true,
          latitude: true,
          longitude: true,
          profilePhotoUrl: true,
        },
      },
    },
    orderBy: { [sortBy]: sortOrder },
    take: parseInt(limit),
    skip: parseInt(offset),
  });

  // Filter by distance if coordinates provided
  if (latitude && longitude) {
    const userLat = parseFloat(latitude);
    const userLon = parseFloat(longitude);
    const maxRadius = parseFloat(radiusMiles);

    items = items
      .map((item) => {
        if (item.owner.latitude && item.owner.longitude) {
          const distance = calculateDistance(
            userLat,
            userLon,
            parseFloat(item.owner.latitude),
            parseFloat(item.owner.longitude)
          );
          return { ...item, distance: parseFloat(distance.toFixed(2)) };
        }
        return { ...item, distance: null };
      })
      .filter((item) => item.distance === null || item.distance <= maxRadius)
      .sort((a, b) => {
        if (a.distance === null) return 1;
        if (b.distance === null) return -1;
        return a.distance - b.distance;
      });
  }

  const total = await prisma.item.count({ where });

  res.json({
    items,
    pagination: {
      total,
      limit: parseInt(limit),
      offset: parseInt(offset),
    },
  });
}

/**
 * Get single item details
 * GET /api/items/:id
 */
async function getItem(req, res) {
  const { id } = req.params;

  const item = await prisma.item.findUnique({
    where: { id },
    include: {
      owner: {
        select: {
          id: true,
          fullName: true,
          neighborhood: true,
          latitude: true,
          longitude: true,
          profilePhotoUrl: true,
          isVerified: true,
          createdAt: true,
        },
      },
    },
  });

  if (!item) {
    return res.status(404).json({ error: 'Item not found' });
  }

  // Get owner's average rating
  const ownerRatings = await prisma.rating.aggregate({
    where: { ratedUserId: item.ownerId },
    _avg: { overallRating: true },
    _count: { overallRating: true },
  });

  res.json({
    ...item,
    owner: {
      ...item.owner,
      averageRating: ownerRatings._avg.overallRating
        ? parseFloat(ownerRatings._avg.overallRating.toFixed(2))
        : null,
      totalRatings: ownerRatings._count.overallRating,
    },
  });
}

/**
 * Update item listing
 * PUT /api/items/:id
 */
async function updateItem(req, res) {
  const { id } = req.params;

  // Check ownership
  const existingItem = await prisma.item.findUnique({
    where: { id },
  });

  if (!existingItem) {
    return res.status(404).json({ error: 'Item not found' });
  }

  if (existingItem.ownerId !== req.user.id) {
    return res.status(403).json({ error: 'Not authorized to update this item' });
  }

  const {
    category,
    subcategory,
    title,
    description,
    condition,
    replacementValue,
    pricingType,
    priceAmount,
    lateFeeAmount,
    protectionPreference,
    depositPercentage,
    isAvailable,
    photoUrls,
    specialInstructions,
  } = req.body;

  const item = await prisma.item.update({
    where: { id },
    data: {
      category,
      subcategory,
      title,
      description,
      condition,
      replacementValue: replacementValue ? parseFloat(replacementValue) : undefined,
      pricingType,
      priceAmount: priceAmount !== undefined ? (priceAmount ? parseFloat(priceAmount) : null) : undefined,
      lateFeeAmount: lateFeeAmount !== undefined ? (lateFeeAmount ? parseFloat(lateFeeAmount) : null) : undefined,
      protectionPreference,
      depositPercentage,
      isAvailable,
      photoUrls,
      specialInstructions,
    },
    include: {
      owner: {
        select: { id: true, fullName: true, neighborhood: true },
      },
    },
  });

  res.json(item);
}

/**
 * Delete (soft delete) item listing
 * DELETE /api/items/:id
 */
async function deleteItem(req, res) {
  const { id } = req.params;

  // Check ownership
  const existingItem = await prisma.item.findUnique({
    where: { id },
  });

  if (!existingItem) {
    return res.status(404).json({ error: 'Item not found' });
  }

  if (existingItem.ownerId !== req.user.id) {
    return res.status(403).json({ error: 'Not authorized to delete this item' });
  }

  // Soft delete by setting isAvailable to false
  await prisma.item.update({
    where: { id },
    data: { isAvailable: false },
  });

  res.json({ message: 'Item deleted successfully' });
}

/**
 * Get current user's items
 * GET /api/items/my-listings
 */
async function getMyItems(req, res) {
  const { includeUnavailable = 'false' } = req.query;

  const where = { ownerId: req.user.id };
  if (includeUnavailable !== 'true') {
    where.isAvailable = true;
  }

  const items = await prisma.item.findMany({
    where,
    orderBy: { createdAt: 'desc' },
  });

  res.json(items);
}

module.exports = { createItem, getItems, getItem, updateItem, deleteItem, getMyItems };
