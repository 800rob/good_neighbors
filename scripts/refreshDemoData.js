/**
 * Refreshes demo data dates to be current and creates active transactions
 * in various states so the Action Center has real data to display.
 *
 * Run: node scripts/refreshDemoData.js
 */
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());

  // Helper: days from today
  const daysFromNow = (d) => {
    const date = new Date(today);
    date.setDate(date.getDate() + d);
    return date;
  };
  const hoursFromNow = (h) => {
    const date = new Date(now);
    date.setHours(date.getHours() + h);
    return date;
  };

  // 1. Re-open expired requests with future dates
  const expiredRequests = await prisma.request.findMany({
    where: { status: 'expired' },
    include: { requester: true },
  });

  console.log(`Found ${expiredRequests.length} expired requests to refresh\n`);

  for (let i = 0; i < expiredRequests.length; i++) {
    const r = expiredRequests[i];
    const startDay = 1 + (i % 10); // stagger: 1-10 days from now
    const duration = 1 + (i % 3);  // 1-3 day durations
    await prisma.request.update({
      where: { id: r.id },
      data: {
        status: 'open',
        neededFrom: daysFromNow(startDay),
        neededUntil: daysFromNow(startDay + duration),
        expiresAt: daysFromNow(30),
      },
    });
    console.log(`  Refreshed: "${r.title}" by ${r.requester.firstName} → open, needed ${startDay}-${startDay + duration} days from now`);
  }

  // 2. Re-run matching for refreshed requests
  const { findMatchesForRequest } = require('../src/utils/matching');
  const openRequests = await prisma.request.findMany({ where: { status: { in: ['open', 'matched'] } } });
  console.log(`\nRe-running matching for ${openRequests.length} requests...`);
  for (const r of openRequests) {
    try {
      const matches = await findMatchesForRequest(r.id);
      if (matches.length > 0) {
        console.log(`  "${r.title}": ${matches.length} match(es)`);
      }
    } catch (e) {
      // skip errors
    }
  }

  // 3. Load users and items for creating transactions
  const users = await prisma.user.findMany();
  const userMap = {};
  for (const u of users) userMap[u.email] = u;

  const items = await prisma.item.findMany({ include: { owner: true } });

  // 4. Clean up existing active transactions for idempotency, then create fresh ones
  const deleted = await prisma.transaction.deleteMany({
    where: { status: { in: ['requested','accepted','pickup_confirmed','active','return_initiated','return_confirmed'] } }
  });
  console.log(`\nCleaned up ${deleted.count} existing active transactions`);

  console.log('\nCreating active transactions...\n');

  const { calculateFees } = require('../src/utils/feeCalculation');
  const { getTaxRate } = require('../src/utils/taxRates');

  async function createTxn(itemTitle, borrowerEmail, status, pickupOffset, returnOffset, extras = {}) {
    const item = items.find(i => i.title.includes(itemTitle));
    const borrower = userMap[borrowerEmail];
    if (!item || !borrower) {
      console.log(`  SKIP: item="${itemTitle}" or borrower="${borrowerEmail}" not found`);
      return null;
    }
    if (item.ownerId === borrower.id) {
      console.log(`  SKIP: ${borrowerEmail} owns "${itemTitle}"`);
      return null;
    }

    const pickupTime = hoursFromNow(pickupOffset);
    const returnTime = hoursFromNow(returnOffset);

    // Calculate fees
    let rentalFee, platformFee, borrowerPlatformFee, taxRate, taxAmount, totalCharged;
    try {
      const fees = calculateFees(item, pickupTime, returnTime, 'waiver');
      rentalFee = fees.rentalFee;
      platformFee = fees.platformFee;
      borrowerPlatformFee = fees.borrowerPlatformFee;
      taxRate = fees.taxRate;
      taxAmount = fees.taxAmount;
      totalCharged = fees.totalCharged;
    } catch (e) {
      // Fallback simple calc
      const days = Math.max(1, Math.ceil((returnTime - pickupTime) / (1000 * 60 * 60 * 24)));
      rentalFee = (item.priceAmount || 25) * days;
      platformFee = 1 + rentalFee * 0.03;
      borrowerPlatformFee = Math.ceil(platformFee * 50) / 100;
      taxRate = getTaxRate(item.owner.state) || 0.029;
      taxAmount = Math.round(rentalFee * taxRate * 100) / 100;
      totalCharged = rentalFee + borrowerPlatformFee + taxAmount;
    }

    const txn = await prisma.transaction.create({
      data: {
        itemId: item.id,
        borrowerId: borrower.id,
        lenderId: item.ownerId,
        status,
        pickupTime,
        returnTime,
        rentalFee,
        platformFee,
        protectionType: 'waiver',
        taxRate: taxRate || 0,
        taxAmount: taxAmount || 0,
        totalCharged,
        paymentStatus: 'authorized',
        ...extras,
      },
    });

    const lender = item.owner;
    console.log(`  ${status.toUpperCase()}: "${item.title}" — ${borrower.firstName} borrows from ${lender.firstName} (pickup ${pickupOffset}h, return ${returnOffset}h)`);
    return txn;
  }

  // Requested: Bob wants Alice's Circular Saw (lender needs to respond)
  await createTxn('DeWalt 20V MAX Circular Saw', 'bob@example.com', 'requested', 24, 72);

  // Accepted: Emma borrowing Alice's Pressure Washer (pickup coming up)
  await createTxn('Sun Joe SPX3000', 'emma@example.com', 'accepted', 12, 60);

  // Pickup confirmed: Carol borrowing Irene's Bounce House
  await createTxn('Kids Bounce House', 'carol@example.com', 'pickup_confirmed', -2, 24);

  // Active: Jake borrowing Bob's Powder Skis (due back soon)
  await createTxn('K2 Mindbender 108', 'jake@example.com', 'active', -48, 36, {
    actualPickupTime: hoursFromNow(-48),
  });

  // Active: Frank borrowing Leo's Pickup Truck (due back in 5 days)
  await createTxn('Ford F-250', 'frank@example.com', 'active', -24, 120, {
    actualPickupTime: hoursFromNow(-24),
  });

  // Return initiated: Kate returning Grace's Snowshoes
  await createTxn('MSR Evo Trail Snowshoes', 'kate@example.com', 'return_initiated', -72, -4, {
    actualPickupTime: hoursFromNow(-72),
  });

  // Return confirmed: David returning Frank's Snowboard
  await createTxn('Burton Custom 155', 'david@example.com', 'return_confirmed', -96, -12, {
    actualPickupTime: hoursFromNow(-96),
    actualReturnTime: hoursFromNow(-12),
  });

  // Accepted: Hank's handyman service for Kate (pickup in 3 days)
  await createTxn('Experienced Handyman', 'kate@example.com', 'accepted', 72, 78);

  // Active: Irene's House Cleaning for David (happening now)
  await createTxn('Professional House Cleaning', 'david@example.com', 'active', -3, 3, {
    actualPickupTime: hoursFromNow(-3),
  });

  // Verify final counts
  const txnCounts = {};
  const allTxns = await prisma.transaction.findMany({ select: { status: true } });
  allTxns.forEach(t => { txnCounts[t.status] = (txnCounts[t.status] || 0) + 1; });

  const reqCounts = {};
  const allReqs = await prisma.request.findMany({ select: { status: true } });
  allReqs.forEach(r => { reqCounts[r.status] = (reqCounts[r.status] || 0) + 1; });

  const matchCounts = {};
  const allMatches = await prisma.match.findMany({ select: { lenderResponse: true } });
  allMatches.forEach(m => { matchCounts[m.lenderResponse] = (matchCounts[m.lenderResponse] || 0) + 1; });

  console.log('\n--- Final Data Summary ---');
  console.log('Transactions:', txnCounts);
  console.log('Requests:', reqCounts);
  console.log('Matches:', matchCounts);
  console.log('\nDone! Action Center should now have active items.');
}

main()
  .catch(e => { console.error('Error:', e); process.exit(1); })
  .finally(() => prisma.$disconnect());
