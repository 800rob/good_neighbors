const p = require('../src/config/database');

async function run() {
  const items = await p.item.findMany({ select: { title: true, categoryTier3: true }, orderBy: { title: 'asc' } });
  const mismatched = items.filter(i => i.title !== i.categoryTier3);
  console.log('Items with mismatched titles:', mismatched.length);
  if (mismatched.length > 0) mismatched.forEach(i => console.log('  ', i.title, '!==', i.categoryTier3));
  console.log('Total items:', items.length);
  console.log('Item titles:', items.map(i => i.title));

  const reqs = await p.request.findMany({
    where: { status: 'expired' },
    include: { transactions: { where: { status: { notIn: ['cancelled'] } }, select: { status: true } } }
  });
  const bad = reqs.filter(r => r.transactions.length > 0);
  console.log('\nExpired requests with active transactions:', bad.length);

  const snowboard = await p.request.findFirst({
    where: { title: 'Snowboard', status: 'accepted' },
    select: { id: true, title: true, status: true }
  });
  console.log('Snowboard request repaired?', snowboard ? 'Yes - ' + snowboard.status : 'Not found');

  await p.$disconnect();
}
run().catch(e => { console.error(e); process.exit(1); });
