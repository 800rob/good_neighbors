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
async function hasDateConflict(itemId, pickupTime, returnTime, excludeTransactionId) {
  const where = {
    itemId,
    status: { in: BLOCKING_STATUSES },
    pickupTime: { lt: new Date(returnTime) },
    returnTime: { gt: new Date(pickupTime) },
  };

  if (excludeTransactionId) {
    where.id = { not: excludeTransactionId };
  }

  const conflicting = await prisma.transaction.findFirst({
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

module.exports = {
  BLOCKING_STATUSES,
  hasDateConflict,
  getBookedPeriods,
  getItemIdsWithConflicts,
};
