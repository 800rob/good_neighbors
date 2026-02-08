const prisma = require('../src/config/database');

async function verify() {
  const items = await prisma.item.findMany({ include: { owner: { select: { email: true } } } });
  const requests = await prisma.request.findMany({ include: { requester: { select: { email: true } } } });
  const transactions = await prisma.transaction.findMany();

  console.log('=== REMAINING ITEMS ===');
  if (items.length === 0) {
    console.log('  (none)');
  } else {
    items.forEach(i => console.log(`  ${i.owner.email}: "${i.title}" (${i.categoryTier3})`));
  }

  console.log('\n=== REMAINING REQUESTS ===');
  if (requests.length === 0) {
    console.log('  (none)');
  } else {
    requests.forEach(r => console.log(`  ${r.requester.email}: "${r.title}" (${r.categoryTier3})`));
  }

  console.log('\n=== REMAINING TRANSACTIONS ===');
  console.log(`  Count: ${transactions.length}`);

  await prisma.$disconnect();
}

verify().catch(console.error);
