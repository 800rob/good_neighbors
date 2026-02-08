const prisma = require('../src/config/database');

async function cleanup() {
  console.log('=== Cleaning up requests with non-standard naming ===\n');

  // Get all non-cancelled requests
  const requests = await prisma.request.findMany({
    where: { status: { not: 'cancelled' } },
    include: { requester: { select: { email: true } } }
  });

  let cancelledCount = 0;
  let keptCount = 0;

  for (const r of requests) {
    const expectedTitle = r.isOther ? r.customNeed : r.categoryTier3;
    const matches = r.title === expectedTitle;

    if (!matches) {
      // Cancel the request
      await prisma.request.update({
        where: { id: r.id },
        data: { status: 'cancelled' }
      });
      console.log(`[CANCELLED] ${r.requester.email}: "${r.title}"`);
      cancelledCount++;
    } else {
      console.log(`[KEPT] ${r.requester.email}: "${r.title}"`);
      keptCount++;
    }
  }

  console.log(`\n=== Summary ===`);
  console.log(`Cancelled: ${cancelledCount} requests`);
  console.log(`Kept: ${keptCount} requests`);

  // Note: We don't delete transactions - they're historical records
  // The savings calculation will just use whatever data is there
  console.log(`\nNote: Transactions are historical records and won't be deleted.`);
  console.log(`The savings calculation will be updated in the frontend.`);

  await prisma.$disconnect();
}

cleanup().catch(console.error);
