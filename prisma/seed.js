const { PrismaClient } = require('@prisma/client');
const bcrypt = require('bcrypt');

const prisma = new PrismaClient();

async function main() {
  console.log('Seeding database...');

  // Clear existing data
  await prisma.rating.deleteMany();
  await prisma.message.deleteMany();
  await prisma.photo.deleteMany();
  await prisma.transaction.deleteMany();
  await prisma.match.deleteMany();
  await prisma.request.deleteMany();
  await prisma.item.deleteMany();
  await prisma.user.deleteMany();

  console.log('Cleared existing data');

  // Create users (Fort Collins area neighborhoods)
  const passwordHash = await bcrypt.hash('password123', 10);

  const users = await Promise.all([
    prisma.user.create({
      data: {
        email: 'alice@example.com',
        passwordHash,
        firstName: 'Alice',
        lastName: 'Johnson',
        phoneNumber: '9705551001',
        address: '123 Mountain Ave, Fort Collins, CO',
        latitude: 40.5853,
        longitude: -105.0844,
        neighborhood: 'Old Town',
      },
    }),
    prisma.user.create({
      data: {
        email: 'bob@example.com',
        passwordHash,
        firstName: 'Bob',
        lastName: 'Smith',
        phoneNumber: '9705551002',
        address: '456 College Ave, Fort Collins, CO',
        latitude: 40.5734,
        longitude: -105.0865,
        neighborhood: 'Campus West',
      },
    }),
    prisma.user.create({
      data: {
        email: 'carol@example.com',
        passwordHash,
        firstName: 'Carol',
        lastName: 'Williams',
        phoneNumber: '9705551003',
        address: '789 Shields St, Fort Collins, CO',
        latitude: 40.5501,
        longitude: -105.0753,
        neighborhood: 'Midtown',
      },
    }),
    prisma.user.create({
      data: {
        email: 'david@example.com',
        passwordHash,
        firstName: 'David',
        lastName: 'Brown',
        phoneNumber: '9705551004',
        address: '321 Harmony Rd, Fort Collins, CO',
        latitude: 40.5254,
        longitude: -105.0578,
        neighborhood: 'Harmony',
      },
    }),
    prisma.user.create({
      data: {
        email: 'emma@example.com',
        passwordHash,
        firstName: 'Emma',
        lastName: 'Davis',
        phoneNumber: '9705551005',
        address: '654 Drake Rd, Fort Collins, CO',
        latitude: 40.5456,
        longitude: -105.0912,
        neighborhood: 'Drake',
      },
    }),
    prisma.user.create({
      data: {
        email: 'frank@example.com',
        passwordHash,
        firstName: 'Frank',
        lastName: 'Miller',
        phoneNumber: '9705551006',
        address: '987 Timberline Rd, Fort Collins, CO',
        latitude: 40.5389,
        longitude: -105.0234,
        neighborhood: 'Timberline',
      },
    }),
  ]);

  console.log(`Created ${users.length} users`);

  // Create items
  const items = await Promise.all([
    // Alice's items (Old Town)
    prisma.item.create({
      data: {
        ownerId: users[0].id,
        category: 'tools',
        subcategory: 'power_tools',
        title: 'DeWalt 20V Cordless Drill',
        description: 'Powerful cordless drill with two batteries and charger. Great for home projects.',
        condition: 'excellent',
        replacementValue: 150,
        pricingType: 'daily',
        priceAmount: 15,
        lateFeeAmount: 10,
        protectionPreference: 'let_me_decide',
        depositPercentage: 50,
        photoUrls: ['https://images.unsplash.com/photo-1683029937055-3342dd0be6d3?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w4NzU2ODR8MHwxfHNlYXJjaHwxfHxlbGVjdHJpYyUyMGRyaWxsJTIwdG9vbHxlbnwwfDJ8fHwxNzcxMjYwODQzfDA&ixlib=rb-4.1.0&q=80&w=1080'],
      },
    }),
    prisma.item.create({
      data: {
        ownerId: users[0].id,
        category: 'lawn_garden',
        subcategory: 'lawn_care',
        title: 'Electric Pressure Washer 2000 PSI',
        description: 'Sun Joe pressure washer, perfect for decks, driveways, and siding.',
        condition: 'good',
        replacementValue: 200,
        pricingType: 'daily',
        priceAmount: 25,
        lateFeeAmount: 15,
        protectionPreference: 'deposit_required',
        depositPercentage: 50,
        photoUrls: ['https://images.unsplash.com/photo-1657095544219-6328434702a8?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w4NzU2ODR8MHwxfHNlYXJjaHwxfHxjaXJjdWxhciUyMHNhdyUyMGNvcmRsZXNzJTIwY3V0dGluZyUyMHdvb2R8ZW58MHwyfHx8MTc3MTE5ODY5M3ww&ixlib=rb-4.1.0&q=80&w=1080'],
      },
    }),

    // Bob's items (Campus West)
    prisma.item.create({
      data: {
        ownerId: users[1].id,
        category: 'outdoor_recreation',
        subcategory: 'camping_gear',
        title: '4-Person Camping Tent',
        description: 'REI Co-op Passage 4 tent. Easy setup, great for family camping.',
        condition: 'excellent',
        replacementValue: 250,
        pricingType: 'daily',
        priceAmount: 20,
        lateFeeAmount: 15,
        protectionPreference: 'insurance_required',
        photoUrls: ['https://images.unsplash.com/photo-1629580600442-d77795f7efd3?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w4NzU2ODR8MHwxfHNlYXJjaHwxfHxjYW1waW5nJTIwdGVudCUyMG91dGRvb3JzJTIwZm9yZXN0fGVufDB8Mnx8fDE3NzExOTg2NzZ8MA&ixlib=rb-4.1.0&q=80&w=1080'],
      },
    }),
    prisma.item.create({
      data: {
        ownerId: users[1].id,
        category: 'outdoor_recreation',
        subcategory: 'bikes',
        title: 'Mountain Bike - Trek Marlin 5',
        description: '29" wheels, great for trails around Horsetooth.',
        condition: 'good',
        replacementValue: 600,
        pricingType: 'daily',
        priceAmount: 35,
        lateFeeAmount: 25,
        protectionPreference: 'deposit_required',
        depositPercentage: 30,
        photoUrls: ['https://images.unsplash.com/photo-1673121414555-e9c178fb7826?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w4NzU2ODR8MHwxfHNlYXJjaHwxfHxtb3VudGFpbiUyMGJpa2UlMjB0cmFpbCUyMHJpZGluZ3xlbnwwfDJ8fHwxNzcxMTk4Njc5fDA&ixlib=rb-4.1.0&q=80&w=1080'],
      },
    }),

    // Carol's items (Midtown)
    prisma.item.create({
      data: {
        ownerId: users[2].id,
        category: 'party_events',
        subcategory: 'tables_chairs',
        title: 'Folding Tables (Set of 4)',
        description: '6-foot folding tables, great for parties and events.',
        condition: 'good',
        replacementValue: 200,
        pricingType: 'daily',
        priceAmount: 30,
        protectionPreference: 'waiver_ok',
        photoUrls: ['https://images.unsplash.com/photo-1586939731615-bd3396cbd440?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w4NzU2ODR8MHwxfHNlYXJjaHwxfHxmb2xkaW5nJTIwdGFibGVzJTIwZXZlbnQlMjBzZXR1cHxlbnwwfDJ8fHwxNzcxMTk4NjgxfDA&ixlib=rb-4.1.0&q=80&w=1080'],
      },
    }),
    prisma.item.create({
      data: {
        ownerId: users[2].id,
        category: 'party_events',
        subcategory: 'entertainment',
        title: 'JBL PartyBox 310 Speaker',
        description: 'Powerful Bluetooth speaker with lights. Perfect for outdoor parties.',
        condition: 'excellent',
        replacementValue: 500,
        pricingType: 'daily',
        priceAmount: 40,
        lateFeeAmount: 30,
        protectionPreference: 'deposit_required',
        depositPercentage: 40,
        photoUrls: ['https://images.unsplash.com/photo-1665672629999-0994c3f052a9?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w4NzU2ODR8MHwxfHNlYXJjaHwxfHxwb3J0YWJsZSUyMHNwZWFrZXIlMjBtdXNpY3xlbnwwfDJ8fHwxNzcxMjYwNzgzfDA&ixlib=rb-4.1.0&q=80&w=1080'],
      },
    }),

    // David's items (Harmony)
    prisma.item.create({
      data: {
        ownerId: users[3].id,
        category: 'tools',
        subcategory: 'power_tools',
        title: 'Miter Saw - DeWalt 12"',
        description: 'Compound miter saw, great for trim work and framing.',
        condition: 'good',
        replacementValue: 400,
        pricingType: 'daily',
        priceAmount: 35,
        lateFeeAmount: 25,
        protectionPreference: 'insurance_required',
        photoUrls: ['https://images.unsplash.com/photo-1657095544219-6328434702a8?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w4NzU2ODR8MHwxfHNlYXJjaHwxfHxtaXRlciUyMHNhdyUyMGN1dHRpbmclMjB3b29kfGVufDB8Mnx8fDE3NzEyNjA3ODJ8MA&ixlib=rb-4.1.0&q=80&w=1080'],
      },
    }),
    prisma.item.create({
      data: {
        ownerId: users[3].id,
        category: 'lawn_garden',
        subcategory: 'lawn_care',
        title: 'Gas Lawn Mower - Honda',
        description: 'Self-propelled Honda mower. Reliable and easy to use.',
        condition: 'good',
        replacementValue: 450,
        pricingType: 'daily',
        priceAmount: 30,
        lateFeeAmount: 20,
        protectionPreference: 'deposit_required',
        depositPercentage: 30,
        photoUrls: ['https://images.unsplash.com/photo-1742232104913-2bf24cfe9f6d?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w4NzU2ODR8MHwxfHNlYXJjaHwxfHxsYXduJTIwbW93ZXIlMjBncmFzcyUyMGN1dHRpbmd8ZW58MHwyfHx8MTc3MTE5ODY4Mnww&ixlib=rb-4.1.0&q=80&w=1080'],
      },
    }),

    // Emma's items (Drake)
    prisma.item.create({
      data: {
        ownerId: users[4].id,
        category: 'vehicles_transport',
        subcategory: 'trailers',
        title: 'Utility Trailer 5x8',
        description: 'Small utility trailer, great for hauling furniture or yard waste.',
        condition: 'fair',
        replacementValue: 800,
        pricingType: 'daily',
        priceAmount: 40,
        lateFeeAmount: 30,
        protectionPreference: 'insurance_required',
        photoUrls: ['https://images.unsplash.com/photo-1647686898085-ef3c0bd74f43?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w4NzU2ODR8MHwxfHNlYXJjaHwxfHx1dGlsaXR5JTIwdHJhaWxlciUyMGhhdWxpbmd8ZW58MHwyfHx8MTc3MTE5ODY4NHww&ixlib=rb-4.1.0&q=80&w=1080'],
      },
    }),
    prisma.item.create({
      data: {
        ownerId: users[4].id,
        category: 'specialized_equipment',
        subcategory: 'moving',
        title: 'Appliance Dolly',
        description: 'Heavy-duty appliance dolly for moving refrigerators, washers, etc.',
        condition: 'good',
        replacementValue: 150,
        pricingType: 'daily',
        priceAmount: 15,
        protectionPreference: 'waiver_ok',
        photoUrls: ['https://images.unsplash.com/photo-1742155441086-646419ee8670?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w4NzU2ODR8MHwxfHNlYXJjaHwxfHxhcHBsaWFuY2UlMjBkb2xseSUyMGhhbmQlMjB0cnVjayUyMG1vdmluZ3xlbnwwfDJ8fHwxNzcxMTk4Njg1fDA&ixlib=rb-4.1.0&q=80&w=1080'],
      },
    }),

    // Frank's items (Timberline)
    prisma.item.create({
      data: {
        ownerId: users[5].id,
        category: 'workspace',
        subcategory: 'garage',
        title: 'Garage Workshop Space',
        description: 'Heated garage with workbench and basic tools. Great for projects.',
        condition: 'excellent',
        replacementValue: 0,
        pricingType: 'hourly',
        priceAmount: 10,
        protectionPreference: 'waiver_ok',
        photoUrls: ['https://images.unsplash.com/photo-1742989667140-c69adadf556b?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w4NzU2ODR8MHwxfHNlYXJjaHwxfHx3b3Jrc2hvcCUyMHRvb2xzJTIwd29ya2JlbmNofGVufDB8Mnx8fDE3NzEyNjA3ODV8MA&ixlib=rb-4.1.0&q=80&w=1080'],
      },
    }),
    prisma.item.create({
      data: {
        ownerId: users[5].id,
        category: 'tools',
        subcategory: 'power_tools',
        title: 'Table Saw - DeWalt',
        description: '10" portable table saw with stand. Great for woodworking projects.',
        condition: 'excellent',
        replacementValue: 500,
        pricingType: 'daily',
        priceAmount: 40,
        lateFeeAmount: 30,
        protectionPreference: 'deposit_required',
        depositPercentage: 40,
        photoUrls: ['https://images.unsplash.com/photo-1565791380713-1756b9a05343?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w4NzU2ODR8MHwxfHNlYXJjaHwxfHx0YWJsZSUyMHNhdyUyMHdvb2R3b3JraW5nJTIwd29ya3Nob3B8ZW58MHwyfHx8MTc3MTE5ODY3M3ww&ixlib=rb-4.1.0&q=80&w=1080'],
      },
    }),

    // Some free items
    prisma.item.create({
      data: {
        ownerId: users[0].id,
        category: 'tools',
        subcategory: 'hand_tools',
        title: 'Basic Tool Set',
        description: 'Hammer, screwdrivers, pliers, tape measure. Happy to lend for free!',
        condition: 'good',
        replacementValue: 50,
        pricingType: 'free',
        protectionPreference: 'waiver_ok',
        photoUrls: ['https://images.unsplash.com/photo-1625133379631-8684c1e9f722?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w4NzU2ODR8MHwxfHNlYXJjaHwxfHxiYXNpYyUyMHRvb2wlMjBzZXQlMjBoYW1tZXIlMjBzY3Jld2RyaXZlcnxlbnwwfDJ8fHwxNzcxMTk4Njg3fDA&ixlib=rb-4.1.0&q=80&w=1080'],
      },
    }),
    prisma.item.create({
      data: {
        ownerId: users[2].id,
        category: 'party_events',
        subcategory: 'decorations',
        title: 'Party Decorations Box',
        description: 'Streamers, balloons, tablecloths, and more. Free to borrow!',
        condition: 'good',
        replacementValue: 30,
        pricingType: 'free',
        protectionPreference: 'waiver_ok',
        photoUrls: ['https://images.unsplash.com/photo-1574276254982-d209f79d673a?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w4NzU2ODR8MHwxfHNlYXJjaHwxfHxwYXJ0eSUyMGRlY29yYXRpb25zJTIwYmFsbG9vbnMlMjBzdHJlYW1lcnN8ZW58MHwyfHx8MTc3MTE5ODY4OHww&ixlib=rb-4.1.0&q=80&w=1080'],
      },
    }),

    // Service listing
    prisma.item.create({
      data: {
        ownerId: users[3].id,
        category: 'services',
        subcategory: 'handyman',
        title: 'Handyman Help - 2 Hours',
        description: 'I can help with basic home repairs, furniture assembly, etc.',
        condition: 'excellent',
        replacementValue: 0,
        pricingType: 'hourly',
        priceAmount: 25,
        protectionPreference: 'waiver_ok',
        photoUrls: ['https://images.unsplash.com/photo-1571115637435-26e423673f7b?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w4NzU2ODR8MHwxfHNlYXJjaHwxfHxoYW5keW1hbiUyMGhvbWUlMjByZXBhaXIlMjB0b29sc3xlbnwwfDJ8fHwxNzcxMTk4Njc3fDA&ixlib=rb-4.1.0&q=80&w=1080'],
      },
    }),
  ]);

  console.log(`Created ${items.length} items`);

  // Create some requests
  const now = new Date();
  const tomorrow = new Date(now.getTime() + 24 * 60 * 60 * 1000);
  const nextWeek = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);
  const expiresAt = new Date(now.getTime() + 48 * 60 * 60 * 1000);

  const requests = await Promise.all([
    prisma.request.create({
      data: {
        requesterId: users[2].id, // Carol
        category: 'lawn_garden',
        title: 'Need a pressure washer this weekend',
        description: 'Want to clean my deck before a party. Need a pressure washer for Saturday.',
        neededFrom: tomorrow,
        neededUntil: new Date(tomorrow.getTime() + 24 * 60 * 60 * 1000),
        maxBudget: 50,
        maxDistanceMiles: 10,
        latitude: 40.5501,
        longitude: -105.0753,
        expiresAt,
      },
    }),
    prisma.request.create({
      data: {
        requesterId: users[5].id, // Frank
        category: 'outdoor_recreation',
        title: 'Looking for camping gear for weekend trip',
        description: 'Planning a camping trip to State Forest. Need tent and sleeping bags.',
        neededFrom: nextWeek,
        neededUntil: new Date(nextWeek.getTime() + 3 * 24 * 60 * 60 * 1000),
        maxBudget: 100,
        maxDistanceMiles: 15,
        latitude: 40.5389,
        longitude: -105.0234,
        expiresAt,
      },
    }),
    prisma.request.create({
      data: {
        requesterId: users[1].id, // Bob
        category: 'tools',
        title: 'Need a table saw for a weekend project',
        description: 'Building some shelves and need a table saw for the weekend.',
        neededFrom: tomorrow,
        neededUntil: new Date(tomorrow.getTime() + 2 * 24 * 60 * 60 * 1000),
        maxBudget: 80,
        maxDistanceMiles: 10,
        latitude: 40.5734,
        longitude: -105.0865,
        expiresAt,
      },
    }),
  ]);

  console.log(`Created ${requests.length} requests`);

  // Generate matches for requests
  const { findMatchesForRequest } = require('../src/utils/matching');

  for (const request of requests) {
    const matches = await findMatchesForRequest(request.id);
    console.log(`Generated ${matches.length} matches for request: "${request.title}"`);
  }

  // Create a sample completed transaction with ratings
  const sampleTransaction = await prisma.transaction.create({
    data: {
      itemId: items[0].id, // DeWalt Drill
      borrowerId: users[2].id, // Carol
      lenderId: users[0].id, // Alice
      status: 'completed',
      pickupTime: new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000),
      returnTime: new Date(now.getTime() - 5 * 24 * 60 * 60 * 1000),
      actualPickupTime: new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000),
      actualReturnTime: new Date(now.getTime() - 5 * 24 * 60 * 60 * 1000),
      rentalFee: 30,
      platformFee: 1.90,
      protectionType: 'waiver',
      totalCharged: 31.90,
      paymentStatus: 'captured',
    },
  });

  // Add ratings for the sample transaction
  await prisma.rating.createMany({
    data: [
      {
        transactionId: sampleTransaction.id,
        raterId: users[2].id, // Carol rates Alice (lender)
        ratedUserId: users[0].id,
        role: 'lender',
        overallRating: 5,
        onTimeRating: 5,
        communicationRating: 5,
        itemAsDescribedRating: 5,
        reviewText: 'Alice was great! Drill worked perfectly and she was very helpful.',
        wouldTransactAgain: true,
      },
      {
        transactionId: sampleTransaction.id,
        raterId: users[0].id, // Alice rates Carol (borrower)
        ratedUserId: users[2].id,
        role: 'borrower',
        overallRating: 5,
        onTimeRating: 5,
        communicationRating: 5,
        conditionRating: 5,
        reviewText: 'Carol returned the drill in perfect condition. Great borrower!',
        wouldTransactAgain: true,
      },
    ],
  });

  console.log('Created sample completed transaction with ratings');

  // Add some messages to the sample transaction
  await prisma.message.createMany({
    data: [
      {
        transactionId: sampleTransaction.id,
        senderId: users[2].id,
        recipientId: users[0].id,
        messageText: 'Hi Alice! What time works for pickup tomorrow?',
        isRead: true,
      },
      {
        transactionId: sampleTransaction.id,
        senderId: users[0].id,
        recipientId: users[2].id,
        messageText: 'Hi Carol! Anytime after 10am works for me.',
        isRead: true,
      },
      {
        transactionId: sampleTransaction.id,
        senderId: users[2].id,
        recipientId: users[0].id,
        messageText: 'Perfect! I\'ll be there around 10:30.',
        isRead: true,
      },
    ],
  });

  console.log('Added sample messages');

  console.log('\n✅ Seeding completed successfully!');
  console.log('\nTest accounts (all passwords: password123):');
  users.forEach((user) => {
    console.log(`  - ${user.email} (${user.neighborhood})`);
  });
}

main()
  .catch((e) => {
    console.error('Seeding failed:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
