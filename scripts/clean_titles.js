/**
 * Clean up item titles to use categorical names (tier3) instead of brand/model names.
 * Brand/model details are moved to the description.
 * Also repairs any requests incorrectly expired despite having active transactions.
 */
const prisma = require('../src/config/database');

async function run() {
  // === 1. Fix item titles to match tier3 ===
  const items = await prisma.item.findMany({
    select: { id: true, title: true, categoryTier3: true, description: true, details: true },
  });

  let itemsUpdated = 0;
  for (const item of items) {
    if (!item.categoryTier3) continue;
    if (item.title === item.categoryTier3) continue; // Already clean

    const oldTitle = item.title;
    const newTitle = item.categoryTier3;

    // Move the old title (brand/model info) into the description
    let newDescription = item.description || '';
    if (!newDescription) {
      // Empty description — use the old title
      newDescription = oldTitle;
    } else if (!newDescription.toLowerCase().includes(oldTitle.toLowerCase().split(' ')[0].toLowerCase())) {
      // Description doesn't mention the brand — prepend it
      newDescription = `${oldTitle}. ${newDescription}`;
    }
    // Otherwise the description already contains the brand info, leave it as-is

    await prisma.item.update({
      where: { id: item.id },
      data: { title: newTitle, description: newDescription },
    });

    console.log(`  Item: "${oldTitle}" → "${newTitle}"`);
    itemsUpdated++;
  }
  console.log(`\nUpdated ${itemsUpdated} item titles.\n`);

  // === 2. Fix request titles to match tier3 ===
  const requests = await prisma.request.findMany({
    select: { id: true, title: true, categoryTier3: true, description: true },
  });

  let requestsUpdated = 0;
  for (const req of requests) {
    if (!req.categoryTier3) continue;
    if (req.title === req.categoryTier3) continue; // Already clean

    const oldTitle = req.title;
    const newTitle = req.categoryTier3;

    let newDescription = req.description || '';
    if (!newDescription) {
      newDescription = oldTitle;
    }

    await prisma.request.update({
      where: { id: req.id },
      data: { title: newTitle, description: newDescription },
    });

    console.log(`  Request: "${oldTitle}" → "${newTitle}"`);
    requestsUpdated++;
  }
  console.log(`\nUpdated ${requestsUpdated} request titles.\n`);

  // === 3. Repair requests incorrectly expired despite having active transactions ===
  const expiredRequests = await prisma.request.findMany({
    where: { status: 'expired' },
    select: { id: true, title: true },
  });

  let repaired = 0;
  for (const req of expiredRequests) {
    const activeTransaction = await prisma.transaction.findFirst({
      where: {
        requestId: req.id,
        status: { notIn: ['cancelled', 'completed'] },
      },
    });

    if (activeTransaction) {
      await prisma.request.update({
        where: { id: req.id },
        data: { status: 'accepted' },
      });
      console.log(`  Repaired: "${req.title}" (${req.id.slice(0,8)}) expired→accepted (has ${activeTransaction.status} transaction)`);
      repaired++;
    }
  }
  console.log(`\nRepaired ${repaired} incorrectly expired requests.\n`);

  // === 4. Clean up expiresAt on all requests (set to null) ===
  const cleared = await prisma.request.updateMany({
    where: { expiresAt: { not: null } },
    data: { expiresAt: null },
  });
  console.log(`Cleared expiresAt on ${cleared.count} requests.\n`);

  await prisma.$disconnect();
  console.log('Done!');
}

run().catch(e => { console.error(e); process.exit(1); });
