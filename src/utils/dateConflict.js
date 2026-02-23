const prisma = require('../config/database');

/**
 * Transaction statuses that block (reserve) dates on an item.
 * Cancelled, completed, and disputed do NOT block.
 */
const BLOCKING_STATUSES = ['requested', 'accepted', 'pickup_confirmed', 'active', 'return_initiated'];

/**
 * Check if an item has a date conflict with the given time range.
 * Uses the overlap formula: existingPickup < requestedReturn AND existingReturn > requestedPickup
 *
 * @param {string} itemId - Item UUID
 * @param {string|Date} pickupTime - Requested start
 * @param {string|Date} returnTime - Requested end
 * @param {string} [excludeTransactionId] - Optional transaction ID to exclude (for edits)
 * @returns {Promise<{hasConflict: boolean, conflictingTransaction: object|null}>}
 */
async function hasDateConflict(itemId, pickupTime, returnTime, excludeTransactionId, client) {
  const db = client || prisma;
  const where = {
    itemId,
    status: { in: BLOCKING_STATUSES },
    pickupTime: { lt: new Date(returnTime) },
    returnTime: { gt: new Date(pickupTime) },
  };

  if (excludeTransactionId) {
    where.id = { not: excludeTransactionId };
  }

  const conflicting = await db.transaction.findFirst({
    where,
    select: {
      id: true,
      status: true,
      pickupTime: true,
      returnTime: true,
    },
  });

  return {
    hasConflict: !!conflicting,
    conflictingTransaction: conflicting,
  };
}

/**
 * Get all future booked periods for an item (for calendar display).
 *
 * @param {string} itemId - Item UUID
 * @returns {Promise<Array<{pickupTime: Date, returnTime: Date, status: string}>>}
 */
async function getBookedPeriods(itemId) {
  const now = new Date();
  const periods = await prisma.transaction.findMany({
    where: {
      itemId,
      status: { in: BLOCKING_STATUSES },
      returnTime: { gt: now },
    },
    select: {
      pickupTime: true,
      returnTime: true,
      status: true,
    },
    orderBy: { pickupTime: 'asc' },
  });

  return periods;
}

/**
 * Batch version: given a list of item IDs and a date range,
 * return a Set of item IDs that have conflicting bookings.
 *
 * @param {string[]} itemIds - Array of item UUIDs
 * @param {string|Date} pickupTime - Requested start
 * @param {string|Date} returnTime - Requested end
 * @returns {Promise<Set<string>>}
 */
async function getItemIdsWithConflicts(itemIds, pickupTime, returnTime) {
  if (!itemIds.length) return new Set();

  const conflicts = await prisma.transaction.findMany({
    where: {
      itemId: { in: itemIds },
      status: { in: BLOCKING_STATUSES },
      pickupTime: { lt: new Date(returnTime) },
      returnTime: { gt: new Date(pickupTime) },
    },
    select: { itemId: true },
    distinct: ['itemId'],
  });

  return new Set(conflicts.map(c => c.itemId));
}

/**
 * Check if an item's availability rules allow a given date range.
 * @param {object} item - Item with details JSON and availableFrom/availableUntil
 * @param {string|Date} pickupTime
 * @param {string|Date} returnTime
 * @returns {boolean} true if the item's availability rules allow this range
 */
function isAvailableForDates(item, pickupTime, returnTime) {
  const availability = item.details?.availability;

  if (!availability || availability.mode !== 'custom') {
    return true;
  }

  const pickup = new Date(pickupTime);
  const ret = new Date(returnTime);

  // Check date ranges: entire [pickup, return] must fall within at least one range
  if (availability.dateRanges && availability.dateRanges.length > 0) {
    const pickupDate = pickup.toISOString().split('T')[0];
    const returnDate = ret.toISOString().split('T')[0];

    const withinAnyRange = availability.dateRanges.some(range => {
      return pickupDate >= range.from && returnDate <= range.until;
    });

    if (!withinAnyRange) {
      return false;
    }
  }

  // Check recurring days: every calendar day in [pickup, return] must be on an allowed weekday
  // Use UTC methods throughout — dates are stored as UTC midnight from YYYY-MM-DD inputs
  if (availability.recurringDays && availability.recurringDays.length > 0 && availability.recurringDays.length < 7) {
    const allowedDays = new Set(availability.recurringDays);

    const current = new Date(pickup);
    current.setUTCHours(0, 0, 0, 0);
    const end = new Date(ret);
    end.setUTCHours(0, 0, 0, 0);

    while (current <= end) {
      if (!allowedDays.has(current.getUTCDay())) {
        return false;
      }
      current.setUTCDate(current.getUTCDate() + 1);
    }
  }

  return true;
}

module.exports = {
  BLOCKING_STATUSES,
  hasDateConflict,
  getBookedPeriods,
  getItemIdsWithConflicts,
  isAvailableForDates,
};
