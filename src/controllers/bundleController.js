const prisma = require('../config/database');

/**
 * Create a new bundle (curated from user's own items)
 * POST /api/bundles
 */
async function createBundle(req, res) {
  const { title, description, photoUrl, keywords, items } = req.body;

  const bundle = await prisma.bundle.create({
    data: {
      creatorId: req.user.id,
      type: 'curated',
      status: 'draft',
      title,
      description: description || null,
      photoUrl: photoUrl || null,
      keywords: keywords || [],
      bundleItems: items?.length ? {
        create: items.map((item, index) => ({
          itemId: item.itemId,
          sortOrder: item.sortOrder ?? index,
          isRequired: item.isRequired ?? true,
          quantity: item.quantity ?? 1,
          notes: item.notes || null,
        })),
      } : undefined,
    },
    include: {
      creator: {
        select: { id: true, firstName: true, lastName: true, profilePhotoUrl: true },
      },
      bundleItems: {
        include: {
          item: {
            select: {
              id: true, title: true, photoUrls: true, pricingType: true,
              priceAmount: true, condition: true, isAvailable: true,
            },
          },
        },
        orderBy: { sortOrder: 'asc' },
      },
    },
  });

  // Recalculate estimated total
  await recalculateEstimatedTotal(bundle.id);

  const updated = await getBundleWithIncludes(bundle.id);
  res.status(201).json(updated);
}

/**
 * Browse/search bundles
 * GET /api/bundles
 */
async function getBundles(req, res) {
  const { type, status, keyword, search, limit = '20', offset = '0' } = req.query;

  const where = {};

  if (type) where.type = type;
  if (status) {
    where.status = status;
  } else {
    where.status = 'active'; // Default to active bundles
  }

  if (keyword) {
    where.keywords = { has: keyword };
  }

  if (search) {
    where.OR = [
      { title: { contains: search, mode: 'insensitive' } },
      { description: { contains: search, mode: 'insensitive' } },
      { keywords: { has: search.toLowerCase() } },
    ];
  }

  const [bundles, total] = await Promise.all([
    prisma.bundle.findMany({
      where,
      include: {
        creator: {
          select: { id: true, firstName: true, lastName: true, profilePhotoUrl: true },
        },
        bundleItems: {
          include: {
            item: {
              select: {
                id: true, title: true, photoUrls: true, pricingType: true,
                priceAmount: true, isAvailable: true,
              },
            },
          },
          orderBy: { sortOrder: 'asc' },
        },
        _count: { select: { bundleItems: true } },
      },
      orderBy: { createdAt: 'desc' },
      take: parseInt(limit),
      skip: parseInt(offset),
    }),
    prisma.bundle.count({ where }),
  ]);

  res.json({ bundles, pagination: { total, limit: parseInt(limit), offset: parseInt(offset) } });
}

/**
 * Get user's own bundles
 * GET /api/bundles/my-bundles
 */
async function getMyBundles(req, res) {
  const { status } = req.query;

  const where = { creatorId: req.user.id };
  if (status) where.status = status;

  const bundles = await prisma.bundle.findMany({
    where,
    include: {
      bundleItems: {
        include: {
          item: {
            select: {
              id: true, title: true, photoUrls: true, pricingType: true,
              priceAmount: true, isAvailable: true,
            },
          },
        },
        orderBy: { sortOrder: 'asc' },
      },
      _count: { select: { bundleItems: true } },
    },
    orderBy: { updatedAt: 'desc' },
  });

  res.json(bundles);
}

/**
 * List all active templates
 * GET /api/bundles/templates
 */
async function getTemplates(req, res) {
  const templates = await prisma.bundle.findMany({
    where: { type: 'template', status: 'active' },
    include: {
      bundleItems: {
        orderBy: { sortOrder: 'asc' },
      },
      _count: { select: { bundleItems: true } },
    },
    orderBy: { title: 'asc' },
  });

  res.json(templates);
}

/**
 * Get template by slug
 * GET /api/bundles/templates/:slug
 */
async function getTemplateBySlug(req, res) {
  const { slug } = req.params;

  const template = await prisma.bundle.findUnique({
    where: { templateSlug: slug },
    include: {
      bundleItems: {
        orderBy: { sortOrder: 'asc' },
      },
      _count: { select: { bundleItems: true } },
    },
  });

  if (!template) {
    return res.status(404).json({ error: 'Template not found' });
  }

  res.json(template);
}

/**
 * Get bundle detail
 * GET /api/bundles/:id
 */
async function getBundle(req, res) {
  const { id } = req.params;

  const bundle = await getBundleWithIncludes(id);

  if (!bundle) {
    return res.status(404).json({ error: 'Bundle not found' });
  }

  res.json(bundle);
}

/**
 * Update bundle metadata
 * PUT /api/bundles/:id
 */
async function updateBundle(req, res) {
  const { id } = req.params;
  const { title, description, photoUrl, keywords } = req.body;

  const bundle = await prisma.bundle.findUnique({ where: { id } });

  if (!bundle) {
    return res.status(404).json({ error: 'Bundle not found' });
  }
  if (bundle.creatorId !== req.user.id) {
    return res.status(403).json({ error: 'Not authorized to edit this bundle' });
  }

  const updated = await prisma.bundle.update({
    where: { id },
    data: {
      ...(title !== undefined && { title }),
      ...(description !== undefined && { description }),
      ...(photoUrl !== undefined && { photoUrl }),
      ...(keywords !== undefined && { keywords }),
    },
    include: {
      creator: {
        select: { id: true, firstName: true, lastName: true, profilePhotoUrl: true },
      },
      bundleItems: {
        include: {
          item: {
            select: {
              id: true, title: true, photoUrls: true, pricingType: true,
              priceAmount: true, condition: true, isAvailable: true,
              owner: { select: { id: true, firstName: true, lastName: true, profilePhotoUrl: true } },
            },
          },
        },
        orderBy: { sortOrder: 'asc' },
      },
    },
  });

  res.json(updated);
}

/**
 * Delete/archive bundle
 * DELETE /api/bundles/:id
 */
async function deleteBundle(req, res) {
  const { id } = req.params;

  const bundle = await prisma.bundle.findUnique({ where: { id } });

  if (!bundle) {
    return res.status(404).json({ error: 'Bundle not found' });
  }
  if (bundle.creatorId !== req.user.id) {
    return res.status(403).json({ error: 'Not authorized to delete this bundle' });
  }

  // If active, archive instead of hard delete
  if (bundle.status === 'active') {
    await prisma.bundle.update({
      where: { id },
      data: { status: 'archived' },
    });
    return res.json({ message: 'Bundle archived' });
  }

  // Draft bundles can be hard deleted
  await prisma.bundle.delete({ where: { id } });
  res.json({ message: 'Bundle deleted' });
}

/**
 * Add item to bundle
 * POST /api/bundles/:id/items
 */
async function addBundleItem(req, res) {
  const { id } = req.params;
  const { itemId, sortOrder, isRequired, quantity, notes, slotLabel, slotTier1, slotTier2, slotTier3, slotKeywords } = req.body;

  const bundle = await prisma.bundle.findUnique({ where: { id } });

  if (!bundle) {
    return res.status(404).json({ error: 'Bundle not found' });
  }
  if (bundle.creatorId !== req.user.id) {
    return res.status(403).json({ error: 'Not authorized to edit this bundle' });
  }

  // Get max sort order if not provided
  let order = sortOrder;
  if (order === undefined) {
    const maxItem = await prisma.bundleItem.findFirst({
      where: { bundleId: id },
      orderBy: { sortOrder: 'desc' },
    });
    order = (maxItem?.sortOrder ?? -1) + 1;
  }

  const bundleItem = await prisma.bundleItem.create({
    data: {
      bundleId: id,
      itemId: itemId || null,
      sortOrder: order,
      isRequired: isRequired ?? true,
      quantity: quantity ?? 1,
      notes: notes || null,
      slotLabel: slotLabel || null,
      slotTier1: slotTier1 || null,
      slotTier2: slotTier2 || null,
      slotTier3: slotTier3 || null,
      slotKeywords: slotKeywords || [],
    },
    include: {
      item: {
        select: {
          id: true, title: true, photoUrls: true, pricingType: true,
          priceAmount: true, condition: true, isAvailable: true,
        },
      },
    },
  });

  await recalculateEstimatedTotal(id);

  res.status(201).json(bundleItem);
}

/**
 * Update bundle item
 * PUT /api/bundles/:id/items/:bundleItemId
 */
async function updateBundleItem(req, res) {
  const { id, bundleItemId } = req.params;
  const { sortOrder, isRequired, quantity, notes } = req.body;

  const bundle = await prisma.bundle.findUnique({ where: { id } });

  if (!bundle) {
    return res.status(404).json({ error: 'Bundle not found' });
  }
  if (bundle.creatorId !== req.user.id) {
    return res.status(403).json({ error: 'Not authorized to edit this bundle' });
  }

  const bundleItem = await prisma.bundleItem.update({
    where: { id: bundleItemId },
    data: {
      ...(sortOrder !== undefined && { sortOrder }),
      ...(isRequired !== undefined && { isRequired }),
      ...(quantity !== undefined && { quantity }),
      ...(notes !== undefined && { notes }),
    },
    include: {
      item: {
        select: {
          id: true, title: true, photoUrls: true, pricingType: true,
          priceAmount: true, condition: true, isAvailable: true,
        },
      },
    },
  });

  res.json(bundleItem);
}

/**
 * Remove item from bundle
 * DELETE /api/bundles/:id/items/:bundleItemId
 */
async function removeBundleItem(req, res) {
  const { id, bundleItemId } = req.params;

  const bundle = await prisma.bundle.findUnique({ where: { id } });

  if (!bundle) {
    return res.status(404).json({ error: 'Bundle not found' });
  }
  if (bundle.creatorId !== req.user.id) {
    return res.status(403).json({ error: 'Not authorized to edit this bundle' });
  }

  await prisma.bundleItem.delete({ where: { id: bundleItemId } });
  await recalculateEstimatedTotal(id);

  res.json({ message: 'Item removed from bundle' });
}

/**
 * Publish bundle (set status to active)
 * POST /api/bundles/:id/publish
 */
async function publishBundle(req, res) {
  const { id } = req.params;

  const bundle = await prisma.bundle.findUnique({
    where: { id },
    include: { _count: { select: { bundleItems: true } } },
  });

  if (!bundle) {
    return res.status(404).json({ error: 'Bundle not found' });
  }
  if (bundle.creatorId !== req.user.id) {
    return res.status(403).json({ error: 'Not authorized to publish this bundle' });
  }
  if (bundle._count.bundleItems === 0) {
    return res.status(400).json({ error: 'Cannot publish a bundle with no items' });
  }

  await recalculateEstimatedTotal(id);

  const updated = await prisma.bundle.update({
    where: { id },
    data: { status: 'active' },
    include: {
      creator: {
        select: { id: true, firstName: true, lastName: true, profilePhotoUrl: true },
      },
      bundleItems: {
        include: {
          item: {
            select: {
              id: true, title: true, photoUrls: true, pricingType: true,
              priceAmount: true, condition: true, isAvailable: true,
            },
          },
        },
        orderBy: { sortOrder: 'asc' },
      },
    },
  });

  res.json(updated);
}

// === Helpers ===

async function getBundleWithIncludes(id) {
  return prisma.bundle.findUnique({
    where: { id },
    include: {
      creator: {
        select: { id: true, firstName: true, lastName: true, profilePhotoUrl: true, neighborhood: true },
      },
      bundleItems: {
        include: {
          item: {
            include: {
              owner: {
                select: { id: true, firstName: true, lastName: true, profilePhotoUrl: true, neighborhood: true },
              },
            },
          },
        },
        orderBy: { sortOrder: 'asc' },
      },
      _count: { select: { bundleItems: true, bundleRequests: true } },
    },
  });
}

async function recalculateEstimatedTotal(bundleId) {
  const items = await prisma.bundleItem.findMany({
    where: { bundleId, itemId: { not: null } },
    include: {
      item: { select: { priceAmount: true, pricingType: true } },
    },
  });

  let total = 0;
  let basis = null;
  for (const bi of items) {
    if (bi.item?.priceAmount) {
      total += parseFloat(bi.item.priceAmount) * bi.quantity;
      if (!basis) basis = bi.item.pricingType;
    }
  }

  await prisma.bundle.update({
    where: { id: bundleId },
    data: {
      estimatedTotal: total > 0 ? total : null,
      pricingBasis: basis,
    },
  });
}

/**
 * Get aggregated bundle matches grouped by item owner (borrower view)
 * GET /api/bundles/:bundleId/matches
 */
async function getBundleMatches(req, res) {
  const { bundleId } = req.params;

  // Fetch bundle with its requests
  const bundle = await prisma.bundle.findUnique({
    where: { id: bundleId },
    include: {
      requests: {
        select: { id: true, title: true, requesterId: true },
      },
    },
  });

  if (!bundle) {
    return res.status(404).json({ error: 'Bundle not found' });
  }

  const requestIds = bundle.requests.map(r => r.id);
  if (requestIds.length === 0) {
    return res.json({
      bundle: { id: bundle.id, title: bundle.title, requestCount: 0 },
      bundleMatches: [],
    });
  }

  // Verify requester owns these requests
  const requesterIds = [...new Set(bundle.requests.map(r => r.requesterId))];
  if (!requesterIds.includes(req.user.id)) {
    return res.status(403).json({ error: 'Not authorized to view bundle matches' });
  }

  // Fetch all non-declined matches for bundle requests
  const matches = await prisma.match.findMany({
    where: {
      requestId: { in: requestIds },
      lenderResponse: { not: 'declined' },
    },
    include: {
      item: {
        include: {
          owner: {
            select: {
              id: true, firstName: true, lastName: true,
              neighborhood: true, profilePhotoUrl: true,
              averageRating: true, totalRatings: true, state: true,
            },
          },
        },
      },
    },
  });

  // Group matches by item owner
  const ownerMap = new Map();
  for (const match of matches) {
    const ownerId = match.item.ownerId;
    if (!ownerMap.has(ownerId)) {
      ownerMap.set(ownerId, {
        owner: match.item.owner,
        matches: [],
      });
    }
    ownerMap.get(ownerId).matches.push(match);
  }

  // Build bundle match results per owner
  const bundleMatches = [];
  for (const [ownerId, { owner, matches: ownerMatches }] of ownerMap) {
    const matchedRequestIds = new Set(ownerMatches.map(m => m.requestId));

    const matchedRequests = ownerMatches.map(m => {
      const req = bundle.requests.find(r => r.id === m.requestId);
      return {
        requestId: m.requestId,
        requestTitle: req?.title || '',
        matchId: m.id,
        itemId: m.itemId,
        itemTitle: m.item.title,
        itemPhotoUrl: m.item.photoUrls?.[0] || null,
        itemPricingType: m.item.pricingType,
        itemPriceAmount: m.item.priceAmount ? parseFloat(m.item.priceAmount) : null,
        matchScore: parseFloat(m.matchScore),
        lenderResponse: m.lenderResponse,
      };
    });

    const unmatchedRequests = bundle.requests
      .filter(r => !matchedRequestIds.has(r.id))
      .map(r => ({ requestId: r.id, requestTitle: r.title }));

    const isComplete = unmatchedRequests.length === 0;
    const allAccepted = isComplete && ownerMatches.every(m => m.lenderResponse === 'accepted');
    const averageScore = ownerMatches.reduce((sum, m) => sum + parseFloat(m.matchScore), 0) / ownerMatches.length;

    const ownerName = [owner.firstName, owner.lastName].filter(Boolean).join(' ') || 'Unknown';

    bundleMatches.push({
      ownerId,
      ownerName,
      ownerNeighborhood: owner.neighborhood,
      ownerProfilePhotoUrl: owner.profilePhotoUrl,
      ownerRating: owner.averageRating ? parseFloat(owner.averageRating) : null,
      ownerState: owner.state,
      isComplete,
      allAccepted,
      averageScore: parseFloat(averageScore.toFixed(1)),
      matchedRequests,
      unmatchedRequests,
    });
  }

  // Sort: complete first, then by averageScore desc
  bundleMatches.sort((a, b) => {
    if (a.isComplete !== b.isComplete) return a.isComplete ? -1 : 1;
    return b.averageScore - a.averageScore;
  });

  res.json({
    bundle: { id: bundle.id, title: bundle.title, requestCount: requestIds.length },
    bundleMatches,
  });
}

module.exports = {
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
};
