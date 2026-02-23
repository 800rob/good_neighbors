const { PrismaClient } = require('@prisma/client');
const p = new PrismaClient();

(async () => {
  const txns = await p.transaction.findMany({ select: { status: true } });
  const tg = {};
  txns.forEach(x => { tg[x.status] = (tg[x.status] || 0) + 1; });
  console.log('Transactions:', tg);

  const reqs = await p.request.findMany({ select: { status: true } });
  const rg = {};
  reqs.forEach(x => { rg[x.status] = (rg[x.status] || 0) + 1; });
  console.log('Requests:', rg);

  const matches = await p.match.findMany({ select: { lenderResponse: true } });
  const mg = {};
  matches.forEach(x => { mg[x.lenderResponse] = (mg[x.lenderResponse] || 0) + 1; });
  console.log('Matches:', mg);

  await p.$disconnect();
})();
