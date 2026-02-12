const prisma = require('../config/database');
const { geocodeAddress } = require('../utils/geocoding');

/**
 * Get current user profile
 * GET /api/users/me
 */
async function getCurrentUser(req, res) {
  const user = await prisma.user.findUnique({
    where: { id: req.user.id },
    include: {
      ratingsReceived: {
        select: {
          overallRating: true,
          role: true,
        },
      },
      _count: {
        select: {
          items: true,
          borrowerTransactions: true,
          lenderTransactions: true,
        },
      },
    },
  });

  // Calculate average ratings
  const ratings = user.ratingsReceived;
  const avgRating = ratings.length > 0
    ? ratings.reduce((sum, r) => sum + r.overallRating, 0) / ratings.length
    : null;

  const lenderRatings = ratings.filter(r => r.role === 'lender');
  const borrowerRatings = ratings.filter(r => r.role === 'borrower');

  const avgLenderRating = lenderRatings.length > 0
    ? lenderRatings.reduce((sum, r) => sum + r.overallRating, 0) / lenderRatings.length
    : null;

  const avgBorrowerRating = borrowerRatings.length > 0
    ? borrowerRatings.reduce((sum, r) => sum + r.overallRating, 0) / borrowerRatings.length
    : null;

  // Build full name for display
  const fullName = [user.firstName, user.middleName, user.lastName].filter(Boolean).join(' ');

  res.json({
    id: user.id,
    email: user.email,
    firstName: user.firstName,
    middleName: user.middleName,
    lastName: user.lastName,
    fullName,
    phoneNumber: user.phoneNumber,
    profilePhotoUrl: user.profilePhotoUrl,
    address: user.address,
    address2: user.address2,
    city: user.city,
    state: user.state,
    zipCode: user.zipCode,
    latitude: user.latitude,
    longitude: user.longitude,
    neighborhood: user.neighborhood,
    isVerified: user.isVerified,
    createdAt: user.createdAt,
    stats: {
      itemsListed: user._count.items,
      transactionsAsBorrower: user._count.borrowerTransactions,
      transactionsAsLender: user._count.lenderTransactions,
      totalRatings: ratings.length,
      averageRating: avgRating ? parseFloat(avgRating.toFixed(2)) : null,
      averageLenderRating: avgLenderRating ? parseFloat(avgLenderRating.toFixed(2)) : null,
      averageBorrowerRating: avgBorrowerRating ? parseFloat(avgBorrowerRating.toFixed(2)) : null,
    },
  });
}

/**
 * Update current user profile
 * PUT /api/users/me
 */
async function updateCurrentUser(req, res) {
  const {
    firstName,
    middleName,
    lastName,
    phoneNumber,
    profilePhotoUrl,
    address,
    address2,
    city,
    state,
    zipCode,
    latitude,
    longitude,
    neighborhood
  } = req.body;

  // Check if phone number is taken by another user
  if (phoneNumber) {
    const existingPhone = await prisma.user.findFirst({
      where: {
        phoneNumber,
        id: { not: req.user.id },
      },
    });

    if (existingPhone) {
      return res.status(409).json({ error: 'Phone number already in use' });
    }
  }

  // Determine latitude/longitude
  let finalLatitude = latitude ? parseFloat(latitude) : undefined;
  let finalLongitude = longitude ? parseFloat(longitude) : undefined;

  // If no GPS coordinates provided but address info is available, geocode the address
  if (!latitude && !longitude && (address || city || zipCode)) {
    console.log('[Profile Update] Geocoding address...');
    const coords = await geocodeAddress({ address, city, state, zipCode });
    if (coords) {
      finalLatitude = coords.latitude;
      finalLongitude = coords.longitude;
      console.log(`[Profile Update] Geocoded to: ${finalLatitude}, ${finalLongitude}`);
    }
  }

  const user = await prisma.user.update({
    where: { id: req.user.id },
    data: {
      firstName,
      middleName,
      lastName,
      phoneNumber,
      profilePhotoUrl,
      address,
      address2,
      city,
      state,
      zipCode,
      latitude: finalLatitude,
      longitude: finalLongitude,
      neighborhood,
    },
  });

  // Build full name for display
  const fullName = [user.firstName, user.middleName, user.lastName].filter(Boolean).join(' ');

  res.json({
    id: user.id,
    email: user.email,
    firstName: user.firstName,
    middleName: user.middleName,
    lastName: user.lastName,
    fullName,
    phoneNumber: user.phoneNumber,
    profilePhotoUrl: user.profilePhotoUrl,
    address: user.address,
    address2: user.address2,
    city: user.city,
    state: user.state,
    zipCode: user.zipCode,
    latitude: user.latitude,
    longitude: user.longitude,
    neighborhood: user.neighborhood,
    isVerified: user.isVerified,
    updatedAt: user.updatedAt,
  });
}

/**
 * Get public user profile
 * GET /api/users/:id
 */
async function getUserProfile(req, res) {
  const { id } = req.params;

  const user = await prisma.user.findUnique({
    where: { id },
    include: {
      ratingsReceived: {
        include: {
          rater: {
            select: { id: true, firstName: true, lastName: true, profilePhotoUrl: true },
          },
          transaction: {
            select: { id: true },
          },
        },
        orderBy: { createdAt: 'desc' },
        take: 10,
      },
      items: {
        where: { isAvailable: true },
        take: 10,
        orderBy: { createdAt: 'desc' },
      },
      _count: {
        select: {
          borrowerTransactions: true,
          lenderTransactions: true,
        },
      },
    },
  });

  if (!user) {
    return res.status(404).json({ error: 'User not found' });
  }

  // Calculate average ratings
  const ratings = user.ratingsReceived;
  const avgRating = ratings.length > 0
    ? ratings.reduce((sum, r) => sum + r.overallRating, 0) / ratings.length
    : null;

  // Build full name for display
  const fullName = [user.firstName, user.middleName, user.lastName].filter(Boolean).join(' ');

  res.json({
    id: user.id,
    firstName: user.firstName,
    lastName: user.lastName,
    fullName,
    profilePhotoUrl: user.profilePhotoUrl,
    neighborhood: user.neighborhood,
    city: user.city,
    state: user.state,
    isVerified: user.isVerified,
    createdAt: user.createdAt,
    stats: {
      totalTransactions: user._count.borrowerTransactions + user._count.lenderTransactions,
      totalRatings: ratings.length,
      averageRating: avgRating ? parseFloat(avgRating.toFixed(2)) : null,
    },
    recentRatings: ratings.map(r => ({
      id: r.id,
      overallRating: r.overallRating,
      reviewText: r.reviewText,
      role: r.role,
      createdAt: r.createdAt,
      rater: r.rater,
    })),
    availableItems: user.items.map(item => ({
      id: item.id,
      title: item.title,
      category: item.category,
      pricingType: item.pricingType,
      priceAmount: item.priceAmount,
      photoUrls: item.photoUrls,
    })),
  });
}

/**
 * Get user's ratings
 * GET /api/users/:id/ratings
 */
async function getUserRatings(req, res) {
  const { id } = req.params;
  const { role, limit = 20, offset = 0 } = req.query;

  const where = { ratedUserId: id };
  if (role) {
    where.role = role;
  }

  const [ratings, total] = await Promise.all([
    prisma.rating.findMany({
      where,
      include: {
        rater: {
          select: { id: true, firstName: true, lastName: true, profilePhotoUrl: true },
        },
        transaction: {
          select: { id: true, item: { select: { id: true, title: true } } },
        },
      },
      orderBy: { createdAt: 'desc' },
      take: Math.min(Math.max(parseInt(limit) || 20, 1), 100),
      skip: Math.max(parseInt(offset) || 0, 0),
    }),
    prisma.rating.count({ where }),
  ]);

  res.json({
    ratings,
    pagination: {
      total,
      limit: Math.min(Math.max(parseInt(limit) || 20, 1), 100),
      offset: Math.max(parseInt(offset) || 0, 0),
    },
  });
}

module.exports = { getCurrentUser, updateCurrentUser, getUserProfile, getUserRatings };
