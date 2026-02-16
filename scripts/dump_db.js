const prisma = require('../src/config/database');

async function run() {
  const items = await prisma.item.findMany({
    select: { id: true, title: true, category: true, categoryTier1: true, categoryTier2: true, categoryTier3: true, description: true, ownerId: true, details: true },
    orderBy: { title: 'asc' }
  });
  console.log('=== ITEMS (' + items.length + ') ===');
  items.forEach(i => console.log(JSON.stringify({ id: i.id.slice(0,8), title: i.title, tier1: i.categoryTier1, tier2: i.categoryTier2, tier3: i.categoryTier3, owner: i.ownerId.slice(0,8), desc: (i.description || '').slice(0,80) })));

  const requests = await prisma.request.findMany({
    select: { id: true, title: true, category: true, categoryTier1: true, categoryTier2: true, categoryTier3: true, status: true, neededFrom: true, neededUntil: true, requesterId: true, description: true },
    orderBy: { title: 'asc' }
  });
  console.log('\n=== REQUESTS (' + requests.length + ') ===');
  requests.forEach(r => console.log(JSON.stringify({
    id: r.id.slice(0,8), title: r.title, tier1: r.categoryTier1, tier2: r.categoryTier2, tier3: r.categoryTier3,
    status: r.status, from: r.neededFrom ? r.neededFrom.toISOString().slice(0,10) : null,
    until: r.neededUntil ? r.neededUntil.toISOString().slice(0,10) : null,
    requester: r.requesterId.slice(0,8), desc: (r.description || '').slice(0,80)
  })));

  const transactions = await prisma.transaction.findMany({
    select: { id: true, status: true, itemId: true, borrowerId: true, lenderId: true, requestId: true, pickupTime: true, returnTime: true },
    orderBy: { createdAt: 'desc' }
  });
  console.log('\n=== TRANSACTIONS (' + transactions.length + ') ===');
  transactions.forEach(t => console.log(JSON.stringify({
    id: t.id.slice(0,8), status: t.status, item: t.itemId.slice(0,8),
    borrower: t.borrowerId.slice(0,8), lender: t.lenderId.slice(0,8),
    request: t.requestId ? t.requestId.slice(0,8) : null,
    pickup: t.pickupTime ? t.pickupTime.toISOString().slice(0,10) : null,
    return: t.returnTime ? t.returnTime.toISOString().slice(0,10) : null
  })));

  const users = await prisma.user.findMany({ select: { id: true, firstName: true, lastName: true, email: true } });
  console.log('\n=== USERS (' + users.length + ') ===');
  users.forEach(u => console.log(JSON.stringify({ id: u.id.slice(0,8), name: u.firstName + ' ' + u.lastName, email: u.email })));

  const matches = await prisma.match.findMany({
    select: { id: true, requestId: true, itemId: true, lenderResponse: true, matchScore: true },
    orderBy: { createdAt: 'desc' }
  });
  console.log('\n=== MATCHES (' + matches.length + ') ===');
  matches.forEach(m => console.log(JSON.stringify({ id: m.id.slice(0,8), request: m.requestId.slice(0,8), item: m.itemId.slice(0,8), response: m.lenderResponse, score: m.matchScore })));

  await prisma.$disconnect();
}
run().catch(e => { console.error(e); process.exit(1); });
