const prisma = require('../src/config/database');

async function checkItems() {
  const items = await prisma.item.findMany({
    select: {
      id: true,
      title: true,
      listingType: true,
      categoryTier1: true,
      categoryTier2: true,
      categoryTier3: true,
      isOther: true,
      customItemName: true
    }
  });

  console.log('Items in database:');
  console.log(JSON.stringify(items, null, 2));

  const withCategories = items.filter(i => i.categoryTier1);
  const withoutCategories = items.filter(i => !i.categoryTier1);

  console.log(`\nTotal items: ${items.length}`);
  console.log(`Items with hierarchical categories: ${withCategories.length}`);
  console.log(`Items WITHOUT hierarchical categories: ${withoutCategories.length}`);

  if (withoutCategories.length > 0) {
    console.log('\nItems needing migration:');
    withoutCategories.forEach(i => console.log(`  - ${i.title} (id: ${i.id})`));
  }

  await prisma.$disconnect();
}

checkItems().catch(console.error);
