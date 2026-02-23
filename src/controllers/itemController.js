const prisma = require('../config/database');
const { calculateDistance } = require('../utils/distance');
const { getSpecsForItem, validateLenderSpecs } = require('../utils/specUtils');
const { findRequestsForItem } = require('../utils/matching');
const { BLOCKING_STATUSES, getBookedPeriods } = require('../utils/dateConflict');

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
    availableFrom,
    availableUntil,
    // New hierarchical category fields
    listingType,
    categoryTier1,
    categoryTier2,
    categoryTier3,
    isOther,
    customItemName,
    // Specs/details
    details,
    // Bundle support
    bundleWithItemIds,
  } = req.body;

  // Validate specs if provided
  if (details && details.specs && listingType && categoryTier1 && categoryTier2 && categoryTier3) {
    const specDefs = getSpecsForItem(listingType, categoryTier1, categoryTier2, categoryTier3);
    if (specDefs) {
      const validation = validateLenderSpecs(specDefs, details.specs);
      if (!validation.valid) {
        return res.status(400).json({ error: 'Invalid specs', details: validation.errors });
      }
    }
  }

  // If bundling, verify all specified items belong to this user
  if (bundleWithItemIds && bundleWithItemIds.length > 0) {
    const existingItems = await prisma.item.findMany({
      where: { id: { in: bundleWithItemIds }, ownerId: req.user.id },
      select: { id: true },
    });
    if (existingItems.length !== bundleWithItemIds.length) {
      return res.status(400).json({ error: 'Some items to bundle were not found or do not belong to you' });
    }
  }

  const item = await prisma.item.create({
    data: {
      ownerId: req.user.id,
      category,
      subcategory,
      title,
      description,
      condition,
      replacementValue: parseFloat(replacementValue) || 0,
      pricingType,
      priceAmount: priceAmount ? parseFloat(priceAmount) : null,
      lateFeeAmount: lateFeeAmount ? parseFloat(lateFeeAmount) : null,
      protectionPreference,
      depositPercentage: depositPercentage || 0,
      photoUrls: photoUrls || [],
      specialInstructions,
      availableFrom: availableFrom ? new Date(availableFrom) : null,
      availableUntil: availableUntil ? new Date(availableUntil) : null,
      // New hierarchical category fields
      listingType: listingType || null,
      categoryTier1: categoryTier1 || null,
      categoryTier2: categoryTier2 || null,
      categoryTier3: categoryTier3 || null,
      isOther: isOther || false,
      customItemName: customItemName || null,
      details: details || {},
    },
    include: {
      owner: {
        select: { id: true, firstName: true, lastName: true, neighborhood: true },
      },
    },
  });

  // If bundling, create a Bundle and link all items (new + existing)
  if (bundleWithItemIds && bundleWithItemIds.length > 0) {
    const bundle = await prisma.bundle.create({
      data: {
        creatorId: req.user.id,
        type: 'curated',
        status: 'active',
        title: `${title} bundle`,
      },
    });
    // Link all items to the bundle
    await prisma.item.updateMany({
      where: { id: { in: [item.id, ...bundleWithItemIds] } },
      data: { bundleId: bundle.id },
    });
    item.bundleId = bundle.id;
  }

  // Reverse-match: find open requests that match this new item (async, don't block response)
  findRequestsForItem(item.id).catch(err => {
    console.error('[Matching] Error in reverse matching for item', item.id, err.message);
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
    search,
    latitude,
    longitude,
    radiusMiles = 25,
    availableFrom,
    availableUntil,
    limit = 20,
    offset = 0,
    sortBy = 'createdAt',
    sortOrder = 'desc',
    // New hierarchical category filters
    listingType,
    categoryTier1,
    categoryTier2,
    categoryTier3,
  } = req.query;

  // Build where clause
  const where = { isAvailable: true };

  // Exclude user's own items if authenticated
  if (req.user?.id) {
    where.ownerId = { not: req.user.id };
  }

  // Exclude items with booking conflicts
  if (availableFrom && availableUntil) {
    // Date-aware: only exclude items with transactions overlapping the requested range
    where.NOT = {
      transactions: {
        some: {
          status: { in: BLOCKING_STATUSES },
          pickupTime: { lt: new Date(availableUntil) },
          returnTime: { gt: new Date(availableFrom) },
        }
      }
    };
  } else {
    // No dates specified: exclude items with ANY active transaction (original behavior)
    where.NOT = {
      transactions: {
        some: {
          status: { in: BLOCKING_STATUSES }
        }
      }
    };
  }

  // Legacy category filter (backward compatibility)
  if (category) where.category = category;
  if (subcategory) where.subcategory = subcategory;

  // New hierarchical category filters
  if (listingType) where.listingType = listingType;
  if (categoryTier1) where.categoryTier1 = categoryTier1;
  if (categoryTier2) where.categoryTier2 = categoryTier2;
  if (categoryTier3) where.categoryTier3 = categoryTier3;
  if (pricingType) where.pricingType = pricingType;
  if (condition) {
    const hierarchy = ['poor', 'fair', 'good', 'excellent', 'new'];
    const idx = hierarchy.indexOf(condition);
    if (idx >= 0) {
      where.condition = { in: hierarchy.slice(idx) };
    } else {
      where.condition = condition;
    }
  }

  // Use AND array for all optional filters to avoid OR/AND conflicts
  where.AND = where.AND || [];

  // Filter by availability dates
  if (availableFrom) {
    where.AND.push({
      OR: [
        { availableFrom: null },
        { availableFrom: { lte: new Date(availableFrom) } }
      ]
    });
  }
  if (availableUntil) {
    where.AND.push({
      OR: [
        { availableUntil: null },
        { availableUntil: { gte: new Date(availableUntil) } }
      ]
    });
  }

  // Keyword search in title and description
  if (search) {
    where.AND.push({
      OR: [
        { title: { contains: search, mode: 'insensitive' } },
        { description: { contains: search, mode: 'insensitive' } },
      ]
    });
  }

  // Clean up empty AND array
  if (where.AND.length === 0) {
    delete where.AND;
  }

  if (minPrice || maxPrice) {
    where.priceAmount = {};
    if (minPrice) where.priceAmount.gte = parseFloat(minPrice);
    if (maxPrice) where.priceAmount.lte = parseFloat(maxPrice);
  }

  const parsedLimit = Math.min(Math.max(parseInt(limit) || 20, 1), 100);
  const parsedOffset = Math.max(parseInt(offset) || 0, 0);
  const hasDistanceFilter = latitude && longitude;

  // Over-fetch when distance filtering to compensate for post-query filtering
  const fetchLimit = hasDistanceFilter ? parsedLimit * 3 : parsedLimit;

  // Get items
  let items = await prisma.item.findMany({
    where,
    include: {
      owner: {
        select: {
          id: true,
          firstName: true,
          lastName: true,
          neighborhood: true,
          latitude: true,
          longitude: true,
          profilePhotoUrl: true,
        },
      },
    },
    orderBy: { [sortBy]: sortOrder },
    take: fetchLimit,
    skip: parsedOffset,
  });

  // Filter by distance if coordinates provided
  if (hasDistanceFilter) {
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
      })
      .slice(0, parsedLimit);
  }

  const total = await prisma.item.count({ where });

  // Category counts: group by tier1, using a WHERE that strips category tier filters
  // so all categories are counted even when one is selected
  const countWhere = { ...where };
  delete countWhere.categoryTier1;
  delete countWhere.categoryTier2;
  delete countWhere.categoryTier3;
  const categoryCounts = await prisma.item.groupBy({
    by: ['categoryTier1'],
    where: countWhere,
    _count: { categoryTier1: true },
    orderBy: { _count: { categoryTier1: 'desc' } },
  });

  // Annotate with isFavorited for authenticated users
  if (req.user?.id) {
    const itemIds = items.map(i => i.id);
    const userFavorites = await prisma.favorite.findMany({
      where: { userId: req.user.id, itemId: { in: itemIds } },
      select: { itemId: true },
    });
    const favSet = new Set(userFavorites.map(f => f.itemId));
    items = items.map(item => ({ ...item, isFavorited: favSet.has(item.id) }));
  } else {
    items = items.map(item => ({ ...item, isFavorited: false }));
  }

  res.json({
    items,
    pagination: {
      total,
      limit: parsedLimit,
      offset: parsedOffset,
    },
    categoryCounts: categoryCounts
      .filter(c => c.categoryTier1)
      .map(c => ({ categoryTier1: c.categoryTier1, count: c._count.categoryTier1 })),
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
          firstName: true,
          lastName: true,
          neighborhood: true,
          state: true,
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

  // Check if item has an active transaction (currently being borrowed)
  const activeTransaction = await prisma.transaction.findFirst({
    where: {
      itemId: id,
      status: {
        in: ['accepted', 'pickup_confirmed', 'active', 'return_initiated']
      }
    },
    select: {
      id: true,
      status: true,
      returnTime: true,
      borrower: {
        select: { id: true, firstName: true }
      }
    }
  });

  // Get booked periods for calendar display
  const bookedPeriods = await getBookedPeriods(id);

  // Get owner's average rating
  const ownerRatings = await prisma.rating.aggregate({
    where: { ratedUserId: item.ownerId },
    _avg: { overallRating: true },
    _count: { overallRating: true },
  });

  // Check if user has favorited this item
  let isFavorited = false;
  if (req.user?.id) {
    const fav = await prisma.favorite.findUnique({
      where: { uq_favorite_user_item: { userId: req.user.id, itemId: id } },
    });
    isFavorited = !!fav;
  }

  // If item belongs to a bundle, fetch sibling items
  let bundleSiblings = [];
  if (item.bundleId) {
    bundleSiblings = await prisma.item.findMany({
      where: { bundleId: item.bundleId, id: { not: item.id } },
      select: { id: true, title: true, categoryTier3: true, photoUrls: true, isAvailable: true },
    });
  }

  // Tentative periods: accepted matches that don't yet have a transaction
  const now = new Date();
  const acceptedMatches = await prisma.match.findMany({
    where: {
      itemId: id,
      lenderResponse: 'accepted',
      request: {
        neededUntil: { gt: now },
      },
    },
    include: {
      request: {
        select: {
          id: true,
          title: true,
          neededFrom: true,
          neededUntil: true,
          requesterId: true,
          requester: {
            select: { firstName: true, lastName: true },
          },
          transactions: {
            where: { itemId: id },
            select: { id: true },
          },
        },
      },
    },
  });

  const tentativePeriods = acceptedMatches
    .filter(m => m.request.transactions.length === 0)
    .map(m => ({
      matchId: m.id,
      requestId: m.request.id,
      requestTitle: m.request.title,
      neededFrom: m.request.neededFrom,
      neededUntil: m.request.neededUntil,
      borrowerName: `${m.request.requester.firstName} ${m.request.requester.lastName}`.trim(),
      matchScore: parseFloat(m.matchScore),
    }));

  // Transaction history (owner-only): all transactions for this item
  let transactionHistory = undefined;
  if (req.user?.id === item.ownerId) {
    const allTransactions = await prisma.transaction.findMany({
      where: { itemId: id },
      include: {
        borrower: {
          select: { id: true, firstName: true, lastName: true },
        },
      },
      orderBy: { createdAt: 'desc' },
    });
    transactionHistory = allTransactions.map(t => ({
      id: t.id,
      status: t.status,
      pickupTime: t.pickupTime,
      returnTime: t.returnTime,
      rentalFee: t.rentalFee ? parseFloat(t.rentalFee) : 0,
      createdAt: t.createdAt,
      borrowerName: `${t.borrower.firstName} ${t.borrower.lastName}`.trim(),
      borrowerId: t.borrower.id,
    }));
  }

  res.json({
    ...item,
    isFavorited,
    isCurrentlyBorrowed: !!activeTransaction,
    activeTransaction: activeTransaction ? {
      id: activeTransaction.id,
      status: activeTransaction.status,
      returnTime: activeTransaction.returnTime,
    } : null,
    bookedPeriods,
    bundleSiblings,
    tentativePeriods,
    transactionHistory,
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
    availableFrom,
    availableUntil,
    // New hierarchical category fields
    listingType,
    categoryTier1,
    categoryTier2,
    categoryTier3,
    isOther,
    customItemName,
    // Specs/details
    details,
  } = req.body;

  // Validate specs if provided
  if (details && details.specs) {
    const lt = listingType || existingItem.listingType;
    const t1 = categoryTier1 || existingItem.categoryTier1;
    const t2 = categoryTier2 || existingItem.categoryTier2;
    const t3 = categoryTier3 || existingItem.categoryTier3;
    if (lt && t1 && t2 && t3) {
      const specDefs = getSpecsForItem(lt, t1, t2, t3);
      if (specDefs) {
        const validation = validateLenderSpecs(specDefs, details.specs);
        if (!validation.valid) {
          return res.status(400).json({ error: 'Invalid specs', details: validation.errors });
        }
      }
    }
  }

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
      availableFrom: availableFrom !== undefined ? (availableFrom ? new Date(availableFrom) : null) : undefined,
      availableUntil: availableUntil !== undefined ? (availableUntil ? new Date(availableUntil) : null) : undefined,
      // New hierarchical category fields
      listingType: listingType !== undefined ? listingType : undefined,
      categoryTier1: categoryTier1 !== undefined ? categoryTier1 : undefined,
      categoryTier2: categoryTier2 !== undefined ? categoryTier2 : undefined,
      categoryTier3: categoryTier3 !== undefined ? categoryTier3 : undefined,
      isOther: isOther !== undefined ? isOther : undefined,
      customItemName: customItemName !== undefined ? customItemName : undefined,
      details: details !== undefined ? details : undefined,
    },
    include: {
      owner: {
        select: { id: true, firstName: true, lastName: true, neighborhood: true },
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

  // Check for active transactions before soft-deleting
  const activeTransactionCount = await prisma.transaction.count({
    where: {
      itemId: id,
      status: { notIn: ['completed', 'cancelled'] },
    },
  });

  if (activeTransactionCount > 0) {
    return res.status(409).json({
      error: 'Cannot delete item with active transactions. Please complete or cancel them first.',
      activeTransactions: activeTransactionCount,
    });
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
  const { includeUnavailable = 'false', limit = 50, offset = 0 } = req.query;

  const where = { ownerId: req.user.id };
  if (includeUnavailable !== 'true') {
    where.isAvailable = true;
  }

  const parsedLimit = Math.min(Math.max(parseInt(limit) || 50, 1), 100);
  const parsedOffset = Math.max(parseInt(offset) || 0, 0);

  const [items, total] = await Promise.all([
    prisma.item.findMany({
      where,
      include: { bundle: { select: { id: true, title: true } } },
      orderBy: { createdAt: 'desc' },
      take: parsedLimit,
      skip: parsedOffset,
    }),
    prisma.item.count({ where }),
  ]);

  // Count accepted matches without transactions per item
  const itemIds = items.map(i => i.id);
  const now = new Date();
  let matchCountMap = {};
  if (itemIds.length > 0) {
    const acceptedMatches = await prisma.match.findMany({
      where: {
        itemId: { in: itemIds },
        lenderResponse: 'accepted',
        request: {
          neededUntil: { gt: now },
        },
      },
      include: {
        request: {
          select: {
            transactions: {
              where: { itemId: { in: itemIds } },
              select: { itemId: true },
            },
          },
        },
      },
    });

    for (const match of acceptedMatches) {
      // Only count if no transaction exists for this item+request combo
      const hasTransaction = match.request.transactions.some(t => t.itemId === match.itemId);
      if (!hasTransaction) {
        matchCountMap[match.itemId] = (matchCountMap[match.itemId] || 0) + 1;
      }
    }
  }

  const itemsWithMatchCount = items.map(item => ({
    ...item,
    acceptedMatchCount: matchCountMap[item.id] || 0,
  }));

  res.json({ items: itemsWithMatchCount, pagination: { total, limit: parsedLimit, offset: parsedOffset } });
}

module.exports = { createItem, getItems, getItem, updateItem, deleteItem, getMyItems };
