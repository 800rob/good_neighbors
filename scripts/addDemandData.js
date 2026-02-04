/**
 * Script to add sample demand data for testing nearby demand/supply insights
 * Run with: node scripts/addDemandData.js
 */

const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  console.log('Adding sample demand data...');

  // Get existing users
  const users = await prisma.user.findMany({
    orderBy: { email: 'asc' },
  });

  if (users.length < 3) {
    console.error('Not enough users in database. Run seed first.');
    process.exit(1);
  }

  // Find users by email for clarity
  const alice = users.find(u => u.email === 'alice@example.com');
  const bob = users.find(u => u.email === 'bob@example.com');
  const carol = users.find(u => u.email === 'carol@example.com');
  const david = users.find(u => u.email === 'david@example.com');
  const emma = users.find(u => u.email === 'emma@example.com');
  const frank = users.find(u => u.email === 'frank@example.com');

  const now = new Date();
  const tomorrow = new Date(now.getTime() + 24 * 60 * 60 * 1000);
  const nextWeek = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);
  const inTwoWeeks = new Date(now.getTime() + 14 * 24 * 60 * 60 * 1000);
  const expiresAt = new Date(now.getTime() + 72 * 60 * 60 * 1000);

  // Create requests that match Alice's items (drill, pressure washer, basic tool set)
  const aliceItemRequests = [
    {
      requesterId: bob.id,
      category: 'tools',
      title: 'Need a drill for hanging shelves',
      description: 'Looking for a cordless drill to hang some shelves this weekend.',
      neededFrom: tomorrow,
      neededUntil: new Date(tomorrow.getTime() + 24 * 60 * 60 * 1000),
      maxBudget: 20,
      maxDistanceMiles: 15,
      latitude: bob.latitude,
      longitude: bob.longitude,
      expiresAt,
    },
    {
      requesterId: david.id,
      category: 'lawn_garden',
      title: 'Pressure washer for driveway cleaning',
      description: 'Need to clean my driveway before a family visit.',
      neededFrom: nextWeek,
      neededUntil: new Date(nextWeek.getTime() + 24 * 60 * 60 * 1000),
      maxBudget: 35,
      maxDistanceMiles: 12,
      latitude: david.latitude,
      longitude: david.longitude,
      expiresAt,
    },
    {
      requesterId: emma.id,
      category: 'tools',
      title: 'Basic tools for furniture assembly',
      description: 'Just moved in, need basic tools to assemble IKEA furniture.',
      neededFrom: tomorrow,
      neededUntil: new Date(tomorrow.getTime() + 48 * 60 * 60 * 1000),
      maxBudget: 10,
      maxDistanceMiles: 10,
      latitude: emma.latitude,
      longitude: emma.longitude,
      expiresAt,
    },
  ];

  // Create requests that match Carol's items (folding tables, speaker, party decorations)
  const carolItemRequests = [
    {
      requesterId: alice.id,
      category: 'party_events',
      title: 'Tables for birthday party',
      description: 'Hosting a birthday party next weekend, need folding tables.',
      neededFrom: nextWeek,
      neededUntil: new Date(nextWeek.getTime() + 48 * 60 * 60 * 1000),
      maxBudget: 50,
      maxDistanceMiles: 10,
      latitude: alice.latitude,
      longitude: alice.longitude,
      expiresAt,
    },
    {
      requesterId: frank.id,
      category: 'party_events',
      title: 'Speaker for backyard BBQ',
      description: 'Having a BBQ, need a good outdoor speaker for music.',
      neededFrom: inTwoWeeks,
      neededUntil: new Date(inTwoWeeks.getTime() + 24 * 60 * 60 * 1000),
      maxBudget: 60,
      maxDistanceMiles: 20,
      latitude: frank.latitude,
      longitude: frank.longitude,
      expiresAt,
    },
    {
      requesterId: bob.id,
      category: 'party_events',
      title: 'Party decorations for graduation',
      description: 'Throwing a graduation party, looking for decorations.',
      neededFrom: nextWeek,
      neededUntil: new Date(nextWeek.getTime() + 24 * 60 * 60 * 1000),
      maxBudget: 20,
      maxDistanceMiles: 15,
      latitude: bob.latitude,
      longitude: bob.longitude,
      expiresAt,
    },
  ];

  // Create requests that match David's items (miter saw, lawn mower, handyman service)
  const davidItemRequests = [
    {
      requesterId: alice.id,
      category: 'tools',
      title: 'Miter saw for trim work',
      description: 'Doing some baseboard installation, need a miter saw.',
      neededFrom: tomorrow,
      neededUntil: new Date(tomorrow.getTime() + 72 * 60 * 60 * 1000),
      maxBudget: 50,
      maxDistanceMiles: 12,
      latitude: alice.latitude,
      longitude: alice.longitude,
      expiresAt,
    },
    {
      requesterId: emma.id,
      category: 'lawn_garden',
      title: 'Lawn mower - mine broke down',
      description: 'My lawn mower died and grass is getting long!',
      neededFrom: tomorrow,
      neededUntil: new Date(tomorrow.getTime() + 24 * 60 * 60 * 1000),
      maxBudget: 40,
      maxDistanceMiles: 10,
      latitude: emma.latitude,
      longitude: emma.longitude,
      expiresAt,
    },
  ];

  // Create all requests
  const allRequests = [...aliceItemRequests, ...carolItemRequests, ...davidItemRequests];

  for (const requestData of allRequests) {
    try {
      await prisma.request.create({ data: requestData });
      console.log(`Created request: "${requestData.title}"`);
    } catch (err) {
      console.log(`Skipped duplicate request: "${requestData.title}"`);
    }
  }

  // Generate matches for the new requests
  const { findMatchesForRequest } = require('../src/utils/matching');
  const newRequests = await prisma.request.findMany({
    where: {
      status: 'open',
      createdAt: { gte: new Date(now.getTime() - 60000) }, // Created in last minute
    },
  });

  for (const request of newRequests) {
    try {
      const matches = await findMatchesForRequest(request.id);
      console.log(`Generated ${matches.length} matches for: "${request.title}"`);
    } catch (err) {
      console.log(`Could not generate matches for: "${request.title}" - ${err.message}`);
    }
  }

  console.log('\nDone! Sample demand data added.');
  console.log('\nNow you can test:');
  console.log('  - Login as alice@example.com to see nearby demand for her tools');
  console.log('  - Login as carol@example.com to see nearby demand for her party items');
  console.log('  - Login as david@example.com to see nearby demand for his tools/services');
}

main()
  .catch((e) => {
    console.error('Error:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
