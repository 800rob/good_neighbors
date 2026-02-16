/**
 * Repair requests incorrectly set to 'expired' when their start date hasn't passed yet.
 * These should be restored to 'open' or 'matched' based on whether they have matches.
 */
const prisma = require('../src/config/database');

async function run() {
  const todayUTC = new Date();
  todayUTC.setUTCHours(0, 0, 0, 0);

  // Find expired requests whose start date is today or in the future
  const wronglyExpired = await prisma.request.findMany({
    where: {
      status: 'expired',
      neededFrom: { gte: todayUTC },
    },
    include: {
      _count: { select: { matches: true } },
    },
  });

  console.log(`Found ${wronglyExpired.length} incorrectly expired requests to repair.\n`);

  for (const req of wronglyExpired) {
    const newStatus = req._count.matches > 0 ? 'matched' : 'open';
    await prisma.request.update({
      where: { id: req.id },
      data: { status: newStatus },
    });
    console.log(`  Repaired: "${req.title}" (${req.id.slice(0,8)}) expired → ${newStatus} (neededFrom: ${req.neededFrom.toISOString().slice(0,10)}, matches: ${req._count.matches})`);
  }

  console.log('\nDone!');
  await prisma.$disconnect();
}

run().catch(e => { console.error(e); process.exit(1); });
