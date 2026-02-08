const prisma = require('../src/config/database');

async function cleanupItems() {
  console.log('=== Cleaning up items ===\n');

  // 1. Delete obvious test items
  const testItems = await prisma.item.findMany({
    where: {
      OR: [
        { title: { contains: 'test test', mode: 'insensitive' } },
      ]
    },
    select: { id: true, title: true }
  });

  if (testItems.length > 0) {
    console.log('Soft-deleting test items (marking as unavailable):');
    for (const item of testItems) {
      console.log(`  - ${item.title}`);
      await prisma.item.update({
        where: { id: item.id },
        data: { isAvailable: false }
      });
    }
    console.log('');
  }

  // 2. Fix miscategorized items
  const fixes = [
    {
      title: 'JBL PartyBox 310 Speaker test',
      newTitle: 'JBL PartyBox 310 Speaker',
      listingType: 'item',
      categoryTier1: 'Party & Events',
      categoryTier2: 'Audio & Lighting',
      categoryTier3: 'PA Speaker',
    },
    {
      title: 'Basic Tool Set',
      listingType: 'item',
      categoryTier1: 'Tools',
      categoryTier2: 'Hand Tools',
      categoryTier3: 'Tool Set (Basic)',
    },
    {
      title: 'Garage Workshop Space',
      listingType: 'item',
      categoryTier1: 'Workspace',
      categoryTier2: 'Workshop & Garage',
      categoryTier3: 'Garage Bay',
    },
    {
      title: 'Handyman Help - 2 Hours',
      newTitle: 'Handyman Services',
      listingType: 'service',
      categoryTier1: 'Home & Repair',
      categoryTier2: 'General Repair',
      categoryTier3: 'Handyman (General)',
    },
  ];

  console.log('Fixing miscategorized items:');
  for (const fix of fixes) {
    const item = await prisma.item.findFirst({
      where: { title: fix.title }
    });

    if (item) {
      const updateData = {
        listingType: fix.listingType,
        categoryTier1: fix.categoryTier1,
        categoryTier2: fix.categoryTier2,
        categoryTier3: fix.categoryTier3,
        isOther: false,
      };

      if (fix.newTitle) {
        updateData.title = fix.newTitle;
      }

      await prisma.item.update({
        where: { id: item.id },
        data: updateData
      });
      console.log(`  ✓ ${fix.title} → ${fix.categoryTier1} > ${fix.categoryTier2} > ${fix.categoryTier3}`);
    } else {
      console.log(`  ✗ Not found: ${fix.title}`);
    }
  }

  console.log('\n=== Cleanup complete ===');
  await prisma.$disconnect();
}

cleanupItems().catch(console.error);
