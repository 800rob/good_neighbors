const prisma = require('../src/config/database');

async function softDeleteOldItems() {
  console.log('=== Soft-deleting items with non-standard naming ===\n');

  const items = await prisma.item.findMany({
    where: { isAvailable: true },
    include: { owner: { select: { email: true } } }
  });

  let deletedCount = 0;
  let keptCount = 0;

  for (const item of items) {
    const expectedTitle = item.isOther ? item.customItemName : item.categoryTier3;
    const matches = item.title === expectedTitle;

    if (!matches) {
      await prisma.item.update({
        where: { id: item.id },
        data: { isAvailable: false }
      });
      console.log(`[DELETED] ${item.owner.email}: "${item.title}"`);
      deletedCount++;
    } else {
      console.log(`[KEPT] ${item.owner.email}: "${item.title}"`);
      keptCount++;
    }
  }

  console.log(`\n=== Summary ===`);
  console.log(`Soft-deleted: ${deletedCount} items`);
  console.log(`Kept: ${keptCount} items`);

  await prisma.$disconnect();
}

softDeleteOldItems().catch(console.error);
