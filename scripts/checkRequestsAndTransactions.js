const prisma = require('../src/config/database');

async function check() {
  // Check requests
  const requests = await prisma.request.findMany({
    where: { status: { not: 'cancelled' } },
    include: { requester: { select: { email: true } } }
  });

  console.log('=== REQUESTS ===');
  requests.forEach(r => {
    const expectedTitle = r.isOther ? r.customNeed : r.categoryTier3;
    const matches = r.title === expectedTitle;
    console.log(`[${matches ? 'OK' : 'MISMATCH'}] ${r.requester.email}: "${r.title}"`);
    console.log(`  Expected: "${expectedTitle || 'N/A'}"`);
    console.log(`  Category: ${r.categoryTier1 || 'N/A'} > ${r.categoryTier2 || 'N/A'} > ${r.categoryTier3 || 'N/A'}`);
    console.log(`  Status: ${r.status}`);
    console.log('');
  });

  // Check transactions
  const transactions = await prisma.transaction.findMany({
    include: {
      item: { select: { title: true, categoryTier1: true, categoryTier2: true, categoryTier3: true, isOther: true, customItemName: true } },
      borrower: { select: { email: true } }
    }
  });

  console.log('\n=== TRANSACTIONS ===');
  transactions.forEach(t => {
    const item = t.item;
    if (item) {
      const expectedTitle = item.isOther ? item.customItemName : item.categoryTier3;
      const matches = item.title === expectedTitle;
      console.log(`[${matches ? 'OK' : 'MISMATCH'}] ${t.borrower.email}: "${item.title}"`);
      console.log(`  Status: ${t.status}`);
      console.log(`  Category: ${item.categoryTier1 || 'N/A'} > ${item.categoryTier2 || 'N/A'} > ${item.categoryTier3 || 'N/A'}`);
      console.log('');
    }
  });

  await prisma.$disconnect();
}

check().catch(console.error);
