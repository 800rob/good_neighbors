const prisma = require('../config/database');

/**
 * Toggle favorite on an item
 * POST /api/favorites/:itemId
 */
async function toggleFavorite(req, res) {
  const { itemId } = req.params;
  const userId = req.user.id;

  // Verify item exists
  const item = await prisma.item.findUnique({ where: { id: itemId } });
  if (!item) {
    return res.status(404).json({ error: 'Item not found' });
  }

  // Check if already favorited
  const existing = await prisma.favorite.findUnique({
    where: { uq_favorite_user_item: { userId, itemId } },
  });

  if (existing) {
    await prisma.favorite.delete({ where: { id: existing.id } });
    return res.json({ isFavorited: false });
  }

  await prisma.favorite.create({
    data: { userId, itemId },
  });

  res.json({ isFavorited: true });
}

/**
 * Get current user's favorited items
 * GET /api/favorites
 */
async function getMyFavorites(req, res) {
  const userId = req.user.id;

  const favorites = await prisma.favorite.findMany({
    where: { userId },
    include: {
      item: {
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
      },
    },
    orderBy: { createdAt: 'desc' },
  });

  // Return items with isFavorited: true
  const items = favorites
    .filter(f => f.item.isAvailable)
    .map(f => ({ ...f.item, isFavorited: true }));

  res.json({ items });
}

module.exports = { toggleFavorite, getMyFavorites };
