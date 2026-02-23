const prisma = require('../config/database');

// In-process debounce: prevents concurrent refreshes for the same borrower
const pendingRefreshes = new Map();

/**
 * Refresh MatchGroup records for a given borrower.
 * Deduplicates concurrent calls for the same borrowerId.
 *
 * Algorithm:
 * 1. Query all active (non-declined) matches for the borrower's open/matched/accepted requests
 * 2. Group by item.ownerId (lenderId)
 * 3. For groups with 2+ matches → upsert MatchGroup (update score + matchCount)
 * 4. For groups that drop below 2 → set status to 'expired'
 * 5. Don't reset status if already progressed past 'suggested' (unless currently expired)
 *
 * Idempotent — safe to call multiple times.
 *
 * @param {string} borrowerId - UUID of the borrower (requester)
 */
function refreshMatchGroups(borrowerId) {
  // If a refresh is already in progress for this borrower, return the existing promise
  if (pendingRefreshes.has(borrowerId)) {
    return pendingRefreshes.get(borrowerId);
  }

  const promise = _refreshMatchGroupsImpl(borrowerId).finally(() => {
    pendingRefreshes.delete(borrowerId);
  });

  pendingRefreshes.set(borrowerId, promise);
  return promise;
}

async function _refreshMatchGroupsImpl(borrowerId) {
  // 1. Fetch all active matches for this borrower's open/matched/accepted requests
  const matches = await prisma.match.findMany({
    where: {
      request: {
        requesterId: borrowerId,
        status: { in: ['open', 'matched', 'accepted'] },
      },
      lenderResponse: { not: 'declined' },
    },
    include: {
      item: { select: { ownerId: true } },
    },
  });

  // 2. Group by lenderId (item.ownerId)
  const groupsByLender = new Map();
  for (const match of matches) {
    const lenderId = match.item.ownerId;
    if (!groupsByLender.has(lenderId)) {
      groupsByLender.set(lenderId, []);
    }
    groupsByLender.get(lenderId).push(match);
  }

  // 3. Fetch existing MatchGroups for this borrower
  const existingGroups = await prisma.matchGroup.findMany({
    where: { borrowerId },
  });
  const existingByLender = new Map(existingGroups.map(g => [g.lenderId, g]));

  // 4. Process each lender group
  const lenderIdsWithGroups = new Set();

  for (const [lenderId, lenderMatches] of groupsByLender) {
    if (lenderMatches.length < 2) continue; // Need 2+ matches to form a group

    lenderIdsWithGroups.add(lenderId);
    const avgScore = lenderMatches.reduce((sum, m) => sum + parseFloat(m.matchScore), 0) / lenderMatches.length;
    const roundedScore = Math.round(avgScore * 10) / 10;

    const existing = existingByLender.get(lenderId);

    if (existing) {
      // Update existing group
      const updateData = {
        score: roundedScore,
        matchCount: lenderMatches.length,
      };

      // If the group was expired and now has 2+ matches again, re-suggest it
      if (existing.status === 'expired') {
        updateData.status = 'suggested';
      }
      // Don't reset status if it has progressed past 'suggested'

      await prisma.matchGroup.update({
        where: { id: existing.id },
        data: updateData,
      });
    } else {
      // Create new group
      await prisma.matchGroup.create({
        data: {
          borrowerId,
          lenderId,
          score: roundedScore,
          matchCount: lenderMatches.length,
          status: 'suggested',
        },
      });
    }
  }

  // 5. Expire groups that no longer have 2+ matches
  for (const existing of existingGroups) {
    if (!lenderIdsWithGroups.has(existing.lenderId) && existing.status !== 'expired') {
      await prisma.matchGroup.update({
        where: { id: existing.id },
        data: { status: 'expired' },
      });
    }
  }
}

module.exports = { refreshMatchGroups };
