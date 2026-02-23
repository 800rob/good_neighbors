const { PrismaClient } = require('@prisma/client');
const bcrypt = require('bcrypt');

const prisma = new PrismaClient();

async function main() {
  console.log('Seeding database...');

  // Clear existing data (order matters for FK constraints)
  await prisma.transactionItem.deleteMany();
  await prisma.transactionAuditLog.deleteMany();
  await prisma.rating.deleteMany();
  await prisma.message.deleteMany();
  await prisma.photo.deleteMany();
  await prisma.transaction.deleteMany();
  await prisma.match.deleteMany();
  await prisma.bundleItem.deleteMany();
  await prisma.bundleRequest.deleteMany();
  await prisma.request.deleteMany();
  await prisma.item.deleteMany();
  await prisma.bundle.deleteMany();
  await prisma.notificationPreference.deleteMany();
  await prisma.notification.deleteMany();
  await prisma.user.deleteMany();

  console.log('Cleared existing data');

  // ── Users (12 — Fort Collins, CO area) ──────────────────────────────
  const passwordHash = await bcrypt.hash('password123', 10);

  const users = await Promise.all([
    prisma.user.create({
      data: {
        email: 'alice@example.com', passwordHash,
        firstName: 'Alice', lastName: 'Johnson',
        phoneNumber: '9705551001',
        address: '123 Mountain Ave', city: 'Fort Collins', state: 'CO', zipCode: '80521',
        latitude: 40.5853, longitude: -105.0844,
        neighborhood: 'Old Town',
      },
    }),
    prisma.user.create({
      data: {
        email: 'bob@example.com', passwordHash,
        firstName: 'Bob', lastName: 'Smith',
        phoneNumber: '9705551002',
        address: '456 College Ave', city: 'Fort Collins', state: 'CO', zipCode: '80524',
        latitude: 40.5734, longitude: -105.0865,
        neighborhood: 'Campus West',
      },
    }),
    prisma.user.create({
      data: {
        email: 'carol@example.com', passwordHash,
        firstName: 'Carol', lastName: 'Williams',
        phoneNumber: '9705551003',
        address: '789 Shields St', city: 'Fort Collins', state: 'CO', zipCode: '80521',
        latitude: 40.5501, longitude: -105.0753,
        neighborhood: 'Midtown',
      },
    }),
    prisma.user.create({
      data: {
        email: 'david@example.com', passwordHash,
        firstName: 'David', lastName: 'Brown',
        phoneNumber: '9705551004',
        address: '321 Harmony Rd', city: 'Fort Collins', state: 'CO', zipCode: '80525',
        latitude: 40.5254, longitude: -105.0578,
        neighborhood: 'Harmony',
      },
    }),
    prisma.user.create({
      data: {
        email: 'emma@example.com', passwordHash,
        firstName: 'Emma', lastName: 'Davis',
        phoneNumber: '9705551005',
        address: '654 Drake Rd', city: 'Fort Collins', state: 'CO', zipCode: '80526',
        latitude: 40.5456, longitude: -105.0912,
        neighborhood: 'Drake',
      },
    }),
    prisma.user.create({
      data: {
        email: 'frank@example.com', passwordHash,
        firstName: 'Frank', lastName: 'Miller',
        phoneNumber: '9705551006',
        address: '987 Timberline Rd', city: 'Fort Collins', state: 'CO', zipCode: '80525',
        latitude: 40.5389, longitude: -105.0234,
        neighborhood: 'Timberline',
      },
    }),
    prisma.user.create({
      data: {
        email: 'grace@example.com', passwordHash,
        firstName: 'Grace', lastName: 'Lee',
        phoneNumber: '9705551007',
        address: '222 Prospect Rd', city: 'Fort Collins', state: 'CO', zipCode: '80525',
        latitude: 40.5620, longitude: -105.0700,
        neighborhood: 'Prospect',
      },
    }),
    prisma.user.create({
      data: {
        email: 'hank@example.com', passwordHash,
        firstName: 'Hank', lastName: 'Garcia',
        phoneNumber: '9705551008',
        address: '555 Lemay Ave', city: 'Fort Collins', state: 'CO', zipCode: '80524',
        latitude: 40.5650, longitude: -105.0450,
        neighborhood: 'Lemay',
      },
    }),
    prisma.user.create({
      data: {
        email: 'irene@example.com', passwordHash,
        firstName: 'Irene', lastName: 'Kim',
        phoneNumber: '9705551009',
        address: '111 Mulberry St', city: 'Fort Collins', state: 'CO', zipCode: '80521',
        latitude: 40.5780, longitude: -105.0780,
        neighborhood: 'Old Town',
      },
    }),
    prisma.user.create({
      data: {
        email: 'jake@example.com', passwordHash,
        firstName: 'Jake', lastName: 'Wilson',
        phoneNumber: '9705551010',
        address: '444 Riverside Ave', city: 'Fort Collins', state: 'CO', zipCode: '80524',
        latitude: 40.5900, longitude: -105.0600,
        neighborhood: 'Riverside',
      },
    }),
    prisma.user.create({
      data: {
        email: 'kate@example.com', passwordHash,
        firstName: 'Kate', lastName: 'Martinez',
        phoneNumber: '9705551011',
        address: '888 Taft Hill Rd', city: 'Fort Collins', state: 'CO', zipCode: '80521',
        latitude: 40.5550, longitude: -105.1100,
        neighborhood: 'Taft Hill',
      },
    }),
    prisma.user.create({
      data: {
        email: 'leo@example.com', passwordHash,
        firstName: 'Leo', lastName: 'Nguyen',
        phoneNumber: '9705551012',
        address: '333 Laurel St', city: 'Fort Collins', state: 'CO', zipCode: '80521',
        latitude: 40.5810, longitude: -105.0830,
        neighborhood: 'Old Town',
      },
    }),
  ]);

  const [alice, bob, carol, david, emma, frank, grace, hank, irene, jake, kate, leo] = users;
  console.log(`Created ${users.length} users`);

  // ── Bundles (created before items/requests so they can reference bundleId) ──
  const campingBundle = await prisma.bundle.create({
    data: {
      creatorId: bob.id,
      type: 'curated',
      status: 'active',
      title: 'Weekend Camping Kit',
      description: 'Everything you need for a weekend camping trip near Horsetooth',
      keywords: ['camping', 'tent', 'sleeping', 'outdoors'],
    },
  });

  const woodworkingBundle = await prisma.bundle.create({
    data: {
      creatorId: frank.id,
      type: 'curated',
      status: 'active',
      title: 'Woodworking Essentials',
      description: 'Table saw, miter saw, and workspace for your project',
      keywords: ['woodworking', 'tools', 'saw', 'workshop'],
    },
  });

  // Bundle for grouped requests (borrower creates)
  const partyBundle = await prisma.bundle.create({
    data: {
      creatorId: grace.id,
      type: 'curated',
      status: 'active',
      title: 'Backyard Party Setup',
      description: 'Tables, speaker, and decorations for a party',
      keywords: ['party', 'tables', 'speaker', 'decorations'],
    },
  });

  console.log('Created 3 bundles');

  // ── Items (24 — diverse categories, pricing, protection prefs) ──────
  const items = await Promise.all([
    // --- Alice's items (Old Town) ---
    // 0: Tool with multi-tier pricing + specs
    prisma.item.create({
      data: {
        ownerId: alice.id,
        category: 'tools', subcategory: 'power_tools',
        listingType: 'item', categoryTier1: 'Tools', categoryTier2: 'Power Tools', categoryTier3: 'Drill',
        title: 'Drill',
        description: 'Powerful cordless drill with two batteries and charger. Great for home projects.',
        condition: 'excellent', replacementValue: 150,
        pricingType: 'daily', priceAmount: 15, lateFeeAmount: 10,
        protectionPreference: 'let_me_decide', depositPercentage: 50,
        details: {
          specs: { voltage: { value: 20 }, cordless: { value: true }, chuckSize: { value: '1/2 inch' } },
          pricingTiers: { hourly: 5, daily: 15, weekly: 60 },
        },
        photoUrls: ['https://images.unsplash.com/photo-1683029937055-3342dd0be6d3?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w4NzU2ODR8MHwxfHNlYXJjaHwxfHxlbGVjdHJpYyUyMGRyaWxsJTIwdG9vbHxlbnwwfDJ8fHwxNzcxMjYwODQzfDA&ixlib=rb-4.1.0&q=80&w=1080'],
      },
    }),
    // 1: Lawn/Garden with deposit required
    prisma.item.create({
      data: {
        ownerId: alice.id,
        category: 'lawn_garden', subcategory: 'lawn_care',
        listingType: 'item', categoryTier1: 'Lawn & Garden', categoryTier2: 'Lawn Care', categoryTier3: 'Pressure Washer',
        title: 'Pressure Washer',
        description: 'Sun Joe pressure washer, perfect for decks, driveways, and siding.',
        condition: 'good', replacementValue: 200,
        pricingType: 'daily', priceAmount: 25, lateFeeAmount: 15,
        protectionPreference: 'deposit_required', depositPercentage: 50,
        details: { pricingTiers: { daily: 25, weekly: 100 } },
        photoUrls: ['https://images.unsplash.com/photo-1657095544219-6328434702a8?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w4NzU2ODR8MHwxfHNlYXJjaHwxfHxjaXJjdWxhciUyMHNhdyUyMGNvcmRsZXNzJTIwY3V0dGluZyUyMHdvb2R8ZW58MHwyfHx8MTc3MTE5ODY5M3ww&ixlib=rb-4.1.0&q=80&w=1080'],
      },
    }),
    // 2: Free tool set
    prisma.item.create({
      data: {
        ownerId: alice.id,
        category: 'tools', subcategory: 'hand_tools',
        listingType: 'item', categoryTier1: 'Tools', categoryTier2: 'Hand Tools', categoryTier3: 'Tool Set',
        title: 'Tool Set',
        description: 'Hammer, screwdrivers, pliers, tape measure. Happy to lend for free!',
        condition: 'good', replacementValue: 50,
        pricingType: 'free',
        protectionPreference: 'waiver_ok',
        photoUrls: ['https://images.unsplash.com/photo-1625133379631-8684c1e9f722?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w4NzU2ODR8MHwxfHNlYXJjaHwxfHxiYXNpYyUyMHRvb2wlMjBzZXQlMjBoYW1tZXIlMjBzY3Jld2RyaXZlcnxlbnwwfDJ8fHwxNzcxMTk4Njg3fDA&ixlib=rb-4.1.0&q=80&w=1080'],
      },
    }),

    // --- Bob's items (Campus West) — camping bundle ---
    // 3: Tent (bundled)
    prisma.item.create({
      data: {
        ownerId: bob.id,
        category: 'outdoor_recreation', subcategory: 'camping_gear',
        listingType: 'item', categoryTier1: 'Outdoor Recreation', categoryTier2: 'Camping', categoryTier3: 'Tent',
        title: 'Tent',
        description: 'REI Co-op Passage 4 tent. Easy setup, great for family camping.',
        condition: 'excellent', replacementValue: 250,
        pricingType: 'daily', priceAmount: 20, lateFeeAmount: 15,
        protectionPreference: 'insurance_required',
        bundleId: campingBundle.id,
        details: { pricingTiers: { daily: 20, weekly: 80 } },
        photoUrls: ['https://images.unsplash.com/photo-1629580600442-d77795f7efd3?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w4NzU2ODR8MHwxfHNlYXJjaHwxfHxjYW1waW5nJTIwdGVudCUyMG91dGRvb3JzJTIwZm9yZXN0fGVufDB8Mnx8fDE3NzExOTg2NzZ8MA&ixlib=rb-4.1.0&q=80&w=1080'],
      },
    }),
    // 4: Sleeping bags (bundled)
    prisma.item.create({
      data: {
        ownerId: bob.id,
        category: 'outdoor_recreation', subcategory: 'camping_gear',
        listingType: 'item', categoryTier1: 'Outdoor Recreation', categoryTier2: 'Camping', categoryTier3: 'Sleeping Bag',
        title: 'Sleeping Bag',
        description: 'Two mummy-style sleeping bags, good down to 30°F. Great for Colorado camping.',
        condition: 'good', replacementValue: 180,
        pricingType: 'daily', priceAmount: 12, lateFeeAmount: 8,
        protectionPreference: 'waiver_ok',
        bundleId: campingBundle.id,
        details: { pricingTiers: { daily: 12, weekly: 50 } },
        photoUrls: ['https://images.unsplash.com/photo-1504280390367-361c6d9f38f4?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w4NzU2ODR8MHwxfHNlYXJjaHwxfHxzbGVlcGluZyUyMGJhZyUyMGNhbXBpbmd8ZW58MHwyfHx8MTc3MTI2MDc4MHww&ixlib=rb-4.1.0&q=80&w=1080'],
      },
    }),
    // 5: Camping lantern (bundled)
    prisma.item.create({
      data: {
        ownerId: bob.id,
        category: 'outdoor_recreation', subcategory: 'camping_gear',
        listingType: 'item', categoryTier1: 'Outdoor Recreation', categoryTier2: 'Camping', categoryTier3: 'Lantern',
        title: 'Lantern',
        description: 'Rechargeable LED lantern, 1000 lumens, lasts 12 hours.',
        condition: 'excellent', replacementValue: 45,
        pricingType: 'free',
        protectionPreference: 'waiver_ok',
        bundleId: campingBundle.id,
        photoUrls: ['https://images.unsplash.com/photo-1510312305653-8ed496efae75?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w4NzU2ODR8MHwxfHNlYXJjaHwxfHxjYW1waW5nJTIwbGFudGVybiUyMGxpZ2h0fGVufDB8Mnx8fDE3NzEyNjA3ODB8MA&ixlib=rb-4.1.0&q=80&w=1080'],
      },
    }),
    // 6: Mountain bike (standalone)
    prisma.item.create({
      data: {
        ownerId: bob.id,
        category: 'outdoor_recreation', subcategory: 'bikes',
        listingType: 'item', categoryTier1: 'Outdoor Recreation', categoryTier2: 'Cycling', categoryTier3: 'Mountain Bike',
        title: 'Mountain Bike',
        description: '29" wheels, great for trails around Horsetooth.',
        condition: 'good', replacementValue: 600,
        pricingType: 'daily', priceAmount: 35, lateFeeAmount: 25,
        protectionPreference: 'deposit_required', depositPercentage: 30,
        details: { pricingTiers: { daily: 35, weekly: 150 } },
        photoUrls: ['https://images.unsplash.com/photo-1673121414555-e9c178fb7826?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w4NzU2ODR8MHwxfHNlYXJjaHwxfHxtb3VudGFpbiUyMGJpa2UlMjB0cmFpbCUyMHJpZGluZ3xlbnwwfDJ8fHwxNzcxMTk4Njc5fDA&ixlib=rb-4.1.0&q=80&w=1080'],
      },
    }),

    // --- Carol's items (Midtown) — party items ---
    // 7: Folding tables (linked to party bundle)
    prisma.item.create({
      data: {
        ownerId: carol.id,
        category: 'party_events', subcategory: 'tables_chairs',
        listingType: 'item', categoryTier1: 'Party & Events', categoryTier2: 'Furniture', categoryTier3: 'Folding Tables',
        title: 'Folding Tables',
        description: '6-foot folding tables, great for parties and events.',
        condition: 'good', replacementValue: 200,
        pricingType: 'daily', priceAmount: 30,
        protectionPreference: 'waiver_ok',
        photoUrls: ['https://images.unsplash.com/photo-1586939731615-bd3396cbd440?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w4NzU2ODR8MHwxfHNlYXJjaHwxfHxmb2xkaW5nJTIwdGFibGVzJTIwZXZlbnQlMjBzZXR1cHxlbnwwfDJ8fHwxNzcxMTk4NjgxfDA&ixlib=rb-4.1.0&q=80&w=1080'],
      },
    }),
    // 8: Party speaker
    prisma.item.create({
      data: {
        ownerId: carol.id,
        category: 'party_events', subcategory: 'entertainment',
        listingType: 'item', categoryTier1: 'Party & Events', categoryTier2: 'Entertainment', categoryTier3: 'Speaker',
        title: 'Speaker',
        description: 'Powerful Bluetooth speaker with lights. Perfect for outdoor parties.',
        condition: 'excellent', replacementValue: 500,
        pricingType: 'daily', priceAmount: 40, lateFeeAmount: 30,
        protectionPreference: 'deposit_required', depositPercentage: 40,
        details: { pricingTiers: { hourly: 10, daily: 40 } },
        photoUrls: ['https://images.unsplash.com/photo-1665672629999-0994c3f052a9?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w4NzU2ODR8MHwxfHNlYXJjaHwxfHxwb3J0YWJsZSUyMHNwZWFrZXIlMjBtdXNpY3xlbnwwfDJ8fHwxNzcxMjYwNzgzfDA&ixlib=rb-4.1.0&q=80&w=1080'],
      },
    }),
    // 9: Free party decorations
    prisma.item.create({
      data: {
        ownerId: carol.id,
        category: 'party_events', subcategory: 'decorations',
        listingType: 'item', categoryTier1: 'Party & Events', categoryTier2: 'Decorations', categoryTier3: 'General Decorations',
        title: 'General Decorations',
        description: 'Streamers, balloons, tablecloths, and more. Free to borrow!',
        condition: 'good', replacementValue: 30,
        pricingType: 'free',
        protectionPreference: 'waiver_ok',
        photoUrls: ['https://images.unsplash.com/photo-1574276254982-d209f79d673a?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w4NzU2ODR8MHwxfHNlYXJjaHwxfHxwYXJ0eSUyMGRlY29yYXRpb25zJTIwYmFsbG9vbnMlMjBzdHJlYW1lcnN8ZW58MHwyfHx8MTc3MTE5ODY4OHww&ixlib=rb-4.1.0&q=80&w=1080'],
      },
    }),

    // --- David's items (Harmony) ---
    // 10: Miter saw (bundled woodworking)
    prisma.item.create({
      data: {
        ownerId: david.id,
        category: 'tools', subcategory: 'power_tools',
        listingType: 'item', categoryTier1: 'Tools', categoryTier2: 'Power Tools', categoryTier3: 'Miter Saw',
        title: 'Miter Saw',
        description: 'Compound miter saw, great for trim work and framing.',
        condition: 'good', replacementValue: 400,
        pricingType: 'daily', priceAmount: 35, lateFeeAmount: 25,
        protectionPreference: 'insurance_required',
        details: {
          specs: { bladeSize: { value: 12 }, bevelRange: { value: '0-48°' } },
          pricingTiers: { daily: 35, weekly: 150 },
        },
        photoUrls: ['https://images.unsplash.com/photo-1657095544219-6328434702a8?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w4NzU2ODR8MHwxfHNlYXJjaHwxfHxtaXRlciUyMHNhdyUyMGN1dHRpbmclMjB3b29kfGVufDB8Mnx8fDE3NzEyNjA3ODJ8MA&ixlib=rb-4.1.0&q=80&w=1080'],
      },
    }),
    // 11: Lawn mower
    prisma.item.create({
      data: {
        ownerId: david.id,
        category: 'lawn_garden', subcategory: 'lawn_care',
        listingType: 'item', categoryTier1: 'Lawn & Garden', categoryTier2: 'Lawn Care', categoryTier3: 'Lawn Mower',
        title: 'Lawn Mower',
        description: 'Self-propelled Honda mower. Reliable and easy to use.',
        condition: 'good', replacementValue: 450,
        pricingType: 'daily', priceAmount: 30, lateFeeAmount: 20,
        protectionPreference: 'deposit_required', depositPercentage: 30,
        photoUrls: ['https://images.unsplash.com/photo-1742232104913-2bf24cfe9f6d?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w4NzU2ODR8MHwxfHNlYXJjaHwxfHxsYXduJTIwbW93ZXIlMjBncmFzcyUyMGN1dHRpbmd8ZW58MHwyfHx8MTc3MTE5ODY4Mnww&ixlib=rb-4.1.0&q=80&w=1080'],
      },
    }),
    // 12: Handyman service
    prisma.item.create({
      data: {
        ownerId: david.id,
        category: 'services', subcategory: 'handyman',
        listingType: 'service', categoryTier1: 'Services', categoryTier2: 'Home', categoryTier3: 'Handyman',
        title: 'Handyman',
        description: 'I can help with basic home repairs, furniture assembly, drywall patches, etc.',
        condition: 'excellent', replacementValue: 0,
        pricingType: 'hourly', priceAmount: 25,
        protectionPreference: 'waiver_ok',
        photoUrls: ['https://images.unsplash.com/photo-1571115637435-26e423673f7b?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w4NzU2ODR8MHwxfHNlYXJjaHwxfHxoYW5keW1hbiUyMGhvbWUlMjByZXBhaXIlMjB0b29sc3xlbnwwfDJ8fHwxNzcxMTk4Njc3fDA&ixlib=rb-4.1.0&q=80&w=1080'],
      },
    }),

    // --- Emma's items (Drake) ---
    // 13: Utility trailer
    prisma.item.create({
      data: {
        ownerId: emma.id,
        category: 'vehicles_transport', subcategory: 'trailers',
        listingType: 'item', categoryTier1: 'Vehicles & Transport', categoryTier2: 'Trailers', categoryTier3: 'Utility Trailer',
        title: 'Utility Trailer',
        description: 'Small utility trailer, great for hauling furniture or yard waste.',
        condition: 'fair', replacementValue: 800,
        pricingType: 'daily', priceAmount: 40, lateFeeAmount: 30,
        protectionPreference: 'insurance_required',
        details: { pricingTiers: { daily: 40, weekly: 180 } },
        photoUrls: ['https://images.unsplash.com/photo-1647686898085-ef3c0bd74f43?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w4NzU2ODR8MHwxfHNlYXJjaHwxfHx1dGlsaXR5JTIwdHJhaWxlciUyMGhhdWxpbmd8ZW58MHwyfHx8MTc3MTE5ODY4NHww&ixlib=rb-4.1.0&q=80&w=1080'],
      },
    }),
    // 14: Appliance dolly
    prisma.item.create({
      data: {
        ownerId: emma.id,
        category: 'specialized_equipment', subcategory: 'moving',
        listingType: 'item', categoryTier1: 'Specialized Equipment', categoryTier2: 'Moving', categoryTier3: 'Dolly',
        title: 'Dolly',
        description: 'Heavy-duty appliance dolly for moving refrigerators, washers, etc.',
        condition: 'good', replacementValue: 150,
        pricingType: 'daily', priceAmount: 15,
        protectionPreference: 'waiver_ok',
        photoUrls: ['https://images.unsplash.com/photo-1742155441086-646419ee8670?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w4NzU2ODR8MHwxfHNlYXJjaHwxfHxhcHBsaWFuY2UlMjBkb2xseSUyMGhhbmQlMjB0cnVjayUyMG1vdmluZ3xlbnwwfDJ8fHwxNzcxMTk4Njg1fDA&ixlib=rb-4.1.0&q=80&w=1080'],
      },
    }),

    // --- Frank's items (Timberline) — woodworking bundle ---
    // 15: Table saw (bundled)
    prisma.item.create({
      data: {
        ownerId: frank.id,
        category: 'tools', subcategory: 'power_tools',
        listingType: 'item', categoryTier1: 'Tools', categoryTier2: 'Power Tools', categoryTier3: 'Table Saw',
        title: 'Table Saw',
        description: '10" portable table saw with stand. Great for woodworking projects.',
        condition: 'excellent', replacementValue: 500,
        pricingType: 'daily', priceAmount: 40, lateFeeAmount: 30,
        protectionPreference: 'deposit_required', depositPercentage: 40,
        bundleId: woodworkingBundle.id,
        details: {
          specs: { bladeSize: { value: 10 }, ripCapacity: { value: '24.5 inch' } },
          pricingTiers: { daily: 40, weekly: 180 },
        },
        photoUrls: ['https://images.unsplash.com/photo-1565791380713-1756b9a05343?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w4NzU2ODR8MHwxfHNlYXJjaHwxfHx0YWJsZSUyMHNhdyUyMHdvb2R3b3JraW5nJTIwd29ya3Nob3B8ZW58MHwyfHx8MTc3MTE5ODY3M3ww&ixlib=rb-4.1.0&q=80&w=1080'],
      },
    }),
    // 16: Garage workshop (bundled)
    prisma.item.create({
      data: {
        ownerId: frank.id,
        category: 'workspace', subcategory: 'garage',
        listingType: 'item', categoryTier1: 'Workspace', categoryTier2: 'Garage', categoryTier3: 'Workshop Space',
        title: 'Workshop Space',
        description: 'Heated garage with workbench and basic tools. Great for projects.',
        condition: 'excellent', replacementValue: 0,
        pricingType: 'hourly', priceAmount: 10,
        protectionPreference: 'waiver_ok',
        bundleId: woodworkingBundle.id,
        details: { pricingTiers: { hourly: 10, daily: 60 } },
        photoUrls: ['https://images.unsplash.com/photo-1742989667140-c69adadf556b?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w4NzU2ODR8MHwxfHNlYXJjaHwxfHx3b3Jrc2hvcCUyMHRvb2xzJTIwd29ya2JlbmNofGVufDB8Mnx8fDE3NzEyNjA3ODV8MA&ixlib=rb-4.1.0&q=80&w=1080'],
      },
    }),

    // --- Grace's items (Prospect) ---
    // 17: Lawn care service (weekly pricing)
    prisma.item.create({
      data: {
        ownerId: grace.id,
        category: 'services', subcategory: 'lawn_care',
        listingType: 'service', categoryTier1: 'Services', categoryTier2: 'Outdoor', categoryTier3: 'Lawn Mowing',
        title: 'Lawn Mowing',
        description: 'I\'ll mow your lawn weekly. Includes edging and blowing. Fort Collins area.',
        condition: 'excellent', replacementValue: 0,
        pricingType: 'weekly', priceAmount: 35,
        protectionPreference: 'waiver_ok',
        photoUrls: ['https://images.unsplash.com/photo-1558618666-fcd25c85f82e?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w4NzU2ODR8MHwxfHNlYXJjaHwxfHxsYXduJTIwY2FyZSUyMG1vd2luZ3xlbnwwfDJ8fHwxNzcxMjYwNzgwfDA&ixlib=rb-4.1.0&q=80&w=1080'],
      },
    }),
    // 18: Kayak (monthly pricing)
    prisma.item.create({
      data: {
        ownerId: grace.id,
        category: 'outdoor_recreation', subcategory: 'water_sports',
        listingType: 'item', categoryTier1: 'Outdoor Recreation', categoryTier2: 'Water Sports', categoryTier3: 'Kayak',
        title: 'Kayak',
        description: '2-person sit-on-top kayak with paddles and life vests. Perfect for Horsetooth.',
        condition: 'good', replacementValue: 700,
        pricingType: 'daily', priceAmount: 45, lateFeeAmount: 30,
        protectionPreference: 'deposit_required', depositPercentage: 25,
        details: { pricingTiers: { daily: 45, weekly: 200, monthly: 500 } },
        photoUrls: ['https://images.unsplash.com/photo-1472745942893-4b9f730c7668?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w4NzU2ODR8MHwxfHNlYXJjaHwxfHxrYXlhayUyMGxha2UlMjBwYWRkbGV8ZW58MHwyfHx8MTc3MTI2MDc4MHww&ixlib=rb-4.1.0&q=80&w=1080'],
      },
    }),

    // --- Hank's items (Lemay) ---
    // 19: Snow blower (seasonal)
    prisma.item.create({
      data: {
        ownerId: hank.id,
        category: 'lawn_garden', subcategory: 'snow_removal',
        listingType: 'item', categoryTier1: 'Lawn & Garden', categoryTier2: 'Snow Removal', categoryTier3: 'Snow Blower',
        title: 'Snow Blower',
        description: 'Single-stage snow blower. Handles up to 8 inches of snow easily.',
        condition: 'good', replacementValue: 400,
        pricingType: 'daily', priceAmount: 30, lateFeeAmount: 20,
        protectionPreference: 'insurance_required',
        details: { pricingTiers: { daily: 30, weekly: 120 } },
        photoUrls: ['https://images.unsplash.com/photo-1516062423079-7ca13cdc7f5a?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w4NzU2ODR8MHwxfHNlYXJjaHwxfHxzbm93JTIwYmxvd2VyJTIwd2ludGVyfGVufDB8Mnx8fDE3NzEyNjA3ODB8MA&ixlib=rb-4.1.0&q=80&w=1080'],
      },
    }),

    // --- Irene's items (Old Town) ---
    // 20: Stand mixer (kitchen/specialized)
    prisma.item.create({
      data: {
        ownerId: irene.id,
        category: 'specialized_equipment', subcategory: 'kitchen',
        listingType: 'item', categoryTier1: 'Specialized Equipment', categoryTier2: 'Kitchen', categoryTier3: 'Stand Mixer',
        title: 'Stand Mixer',
        description: 'Artisan 5-quart stand mixer with dough hook, paddle, and whisk attachments.',
        condition: 'excellent', replacementValue: 350,
        pricingType: 'daily', priceAmount: 15,
        protectionPreference: 'deposit_required', depositPercentage: 30,
        details: { pricingTiers: { daily: 15, weekly: 50 } },
        photoUrls: ['https://images.unsplash.com/photo-1594631252845-29fc4cc8cde9?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w4NzU2ODR8MHwxfHNlYXJjaHwxfHxzdGFuZCUyMG1peGVyJTIwa2l0Y2hlbnxlbnwwfDJ8fHwxNzcxMjYwNzgwfDA&ixlib=rb-4.1.0&q=80&w=1080'],
      },
    }),

    // --- Jake's items (Riverside) ---
    // 21: Photography service
    prisma.item.create({
      data: {
        ownerId: jake.id,
        category: 'services', subcategory: 'photography',
        listingType: 'service', categoryTier1: 'Services', categoryTier2: 'Creative', categoryTier3: 'Photography',
        title: 'Photography',
        description: 'Professional event photography. Includes edited digital photos within 48 hours.',
        condition: 'excellent', replacementValue: 0,
        pricingType: 'hourly', priceAmount: 50,
        protectionPreference: 'waiver_ok',
        photoUrls: ['https://images.unsplash.com/photo-1554048612-b6a482bc67e5?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w4NzU2ODR8MHwxfHNlYXJjaHwxfHxwaG90b2dyYXBoZXIlMjBjYW1lcmElMjBldmVudHxlbnwwfDJ8fHwxNzcxMjYwNzgwfDA&ixlib=rb-4.1.0&q=80&w=1080'],
      },
    }),

    // --- Kate's items (Taft Hill) ---
    // 22: Projector
    prisma.item.create({
      data: {
        ownerId: kate.id,
        category: 'party_events', subcategory: 'entertainment',
        listingType: 'item', categoryTier1: 'Party & Events', categoryTier2: 'Entertainment', categoryTier3: 'Projector',
        title: 'Projector',
        description: 'Mini projector with 100" screen. Great for outdoor movie nights.',
        condition: 'excellent', replacementValue: 300,
        pricingType: 'daily', priceAmount: 25,
        protectionPreference: 'deposit_required', depositPercentage: 30,
        details: { pricingTiers: { daily: 25, weekly: 100 } },
        photoUrls: ['https://images.unsplash.com/photo-1626379801357-1342aba1b1f6?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w4NzU2ODR8MHwxfHNlYXJjaHwxfHxwb3J0YWJsZSUyMHByb2plY3RvciUyMG1vdmllfGVufDB8Mnx8fDE3NzEyNjA3ODB8MA&ixlib=rb-4.1.0&q=80&w=1080'],
      },
    }),

    // --- Leo's items (Old Town) ---
    // 23: Tutoring service (monthly)
    prisma.item.create({
      data: {
        ownerId: leo.id,
        category: 'services', subcategory: 'tutoring',
        listingType: 'service', categoryTier1: 'Services', categoryTier2: 'Education', categoryTier3: 'Math Tutoring',
        title: 'Math Tutoring',
        description: 'CSU grad student offering math tutoring. Algebra through Calculus III.',
        condition: 'excellent', replacementValue: 0,
        pricingType: 'hourly', priceAmount: 30,
        protectionPreference: 'waiver_ok',
        photoUrls: ['https://images.unsplash.com/photo-1580582932707-520aed937b7b?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w4NzU2ODR8MHwxfHNlYXJjaHwxfHxtYXRoJTIwdHV0b3JpbmclMjBzdHVkeXxlbnwwfDJ8fHwxNzcxMjYwNzgwfDA&ixlib=rb-4.1.0&q=80&w=1080'],
      },
    }),
  ]);

  console.log(`Created ${items.length} items`);

  // Link bundle items to their bundles via BundleItem
  await prisma.bundleItem.createMany({
    data: [
      { bundleId: campingBundle.id, itemId: items[3].id, sortOrder: 0 },  // Tent
      { bundleId: campingBundle.id, itemId: items[4].id, sortOrder: 1 },  // Sleeping bags
      { bundleId: campingBundle.id, itemId: items[5].id, sortOrder: 2 },  // Lantern
      { bundleId: woodworkingBundle.id, itemId: items[15].id, sortOrder: 0 }, // Table saw
      { bundleId: woodworkingBundle.id, itemId: items[16].id, sortOrder: 1 }, // Workshop
    ],
  });
  console.log('Created bundle items');

  // ── Requests (8 — mix of standalone, service, and bundle) ───────────
  const now = new Date();
  const tomorrow = new Date(now.getTime() + 24 * 60 * 60 * 1000);
  const in3Days = new Date(now.getTime() + 3 * 24 * 60 * 60 * 1000);
  const nextWeek = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);
  const in2Weeks = new Date(now.getTime() + 14 * 24 * 60 * 60 * 1000);
  const daysAgo = (n) => new Date(now.getTime() - n * 24 * 60 * 60 * 1000);
  const expiresIn48h = new Date(now.getTime() + 48 * 60 * 60 * 1000);

  const requests = await Promise.all([
    // 0: Carol wants pressure washer
    prisma.request.create({
      data: {
        requesterId: carol.id,
        category: 'lawn_garden', listingType: 'item',
        categoryTier1: 'Lawn & Garden', categoryTier2: 'Lawn Care', categoryTier3: 'Pressure Washer',
        title: 'Pressure Washer',
        description: 'Want to clean my deck before a party. Need a pressure washer for Saturday.',
        neededFrom: tomorrow, neededUntil: in3Days,
        maxBudget: 50, maxDistanceMiles: 10,
        latitude: 40.5501, longitude: -105.0753,
        details: { budgetTiers: { daily: 30, weekly: 100 } },
        expiresAt: expiresIn48h,
      },
    }),
    // 1: Frank wants camping gear (bundle request — tent)
    prisma.request.create({
      data: {
        requesterId: frank.id,
        category: 'outdoor_recreation', listingType: 'item',
        categoryTier1: 'Outdoor Recreation', categoryTier2: 'Camping', categoryTier3: 'Tent',
        title: 'Tent',
        description: 'Planning a camping trip to State Forest. Need a 3-4 person tent.',
        neededFrom: nextWeek, neededUntil: new Date(nextWeek.getTime() + 3 * 24 * 60 * 60 * 1000),
        maxBudget: 100, maxDistanceMiles: 15,
        latitude: 40.5389, longitude: -105.0234,
        bundleId: campingBundle.id,
        details: { budgetTiers: { daily: 25, weekly: 90 } },
        expiresAt: expiresIn48h,
      },
    }),
    // 2: Frank wants sleeping bag (bundle request)
    prisma.request.create({
      data: {
        requesterId: frank.id,
        category: 'outdoor_recreation', listingType: 'item',
        categoryTier1: 'Outdoor Recreation', categoryTier2: 'Camping', categoryTier3: 'Sleeping Bag',
        title: 'Sleeping Bag',
        description: 'Need 2 sleeping bags rated for cold weather.',
        neededFrom: nextWeek, neededUntil: new Date(nextWeek.getTime() + 3 * 24 * 60 * 60 * 1000),
        maxBudget: 50, maxDistanceMiles: 15,
        latitude: 40.5389, longitude: -105.0234,
        bundleId: campingBundle.id,
        details: { budgetTiers: { daily: 15, weekly: 55 } },
        expiresAt: expiresIn48h,
      },
    }),
    // 3: Frank wants lantern (bundle request)
    prisma.request.create({
      data: {
        requesterId: frank.id,
        category: 'outdoor_recreation', listingType: 'item',
        categoryTier1: 'Outdoor Recreation', categoryTier2: 'Camping', categoryTier3: 'Lantern',
        title: 'Lantern',
        description: 'LED lantern for campsite.',
        neededFrom: nextWeek, neededUntil: new Date(nextWeek.getTime() + 3 * 24 * 60 * 60 * 1000),
        maxBudget: 20, maxDistanceMiles: 15,
        latitude: 40.5389, longitude: -105.0234,
        bundleId: campingBundle.id,
        details: {},
        expiresAt: expiresIn48h,
      },
    }),
    // 4: Bob wants table saw
    prisma.request.create({
      data: {
        requesterId: bob.id,
        category: 'tools', listingType: 'item',
        categoryTier1: 'Tools', categoryTier2: 'Power Tools', categoryTier3: 'Table Saw',
        title: 'Table Saw',
        description: 'Building some shelves and need a table saw for the weekend.',
        neededFrom: tomorrow, neededUntil: in3Days,
        maxBudget: 80, maxDistanceMiles: 10,
        latitude: 40.5734, longitude: -105.0865,
        details: { budgetTiers: { daily: 45, weekly: 200 } },
        expiresAt: expiresIn48h,
      },
    }),
    // 5: Grace wants party stuff (bundle — tables + speaker + decorations)
    prisma.request.create({
      data: {
        requesterId: grace.id,
        category: 'party_events', listingType: 'item',
        categoryTier1: 'Party & Events', categoryTier2: 'Furniture', categoryTier3: 'Folding Tables',
        title: 'Folding Tables',
        description: 'Hosting a graduation party, need tables for food and seating.',
        neededFrom: in2Weeks, neededUntil: new Date(in2Weeks.getTime() + 24 * 60 * 60 * 1000),
        maxBudget: 60, maxDistanceMiles: 10,
        latitude: 40.5620, longitude: -105.0700,
        bundleId: partyBundle.id,
        details: { budgetTiers: { daily: 35 } },
        expiresAt: expiresIn48h,
      },
    }),
    // 6: Grace wants speaker (bundle)
    prisma.request.create({
      data: {
        requesterId: grace.id,
        category: 'party_events', listingType: 'item',
        categoryTier1: 'Party & Events', categoryTier2: 'Entertainment', categoryTier3: 'Speaker',
        title: 'Speaker',
        description: 'Bluetooth speaker for outdoor party.',
        neededFrom: in2Weeks, neededUntil: new Date(in2Weeks.getTime() + 24 * 60 * 60 * 1000),
        maxBudget: 50, maxDistanceMiles: 10,
        latitude: 40.5620, longitude: -105.0700,
        bundleId: partyBundle.id,
        details: { budgetTiers: { daily: 45, hourly: 12 } },
        expiresAt: expiresIn48h,
      },
    }),
    // 7: Hank wants handyman service
    prisma.request.create({
      data: {
        requesterId: hank.id,
        category: 'services', listingType: 'service',
        categoryTier1: 'Services', categoryTier2: 'Home', categoryTier3: 'Handyman',
        title: 'Handyman',
        description: 'Just moved in, need help assembling IKEA furniture. About 3-4 hours of work.',
        neededFrom: tomorrow, neededUntil: tomorrow,
        maxBudget: 100, maxDistanceMiles: 10,
        latitude: 40.5650, longitude: -105.0450,
        details: { budgetTiers: { hourly: 30 } },
        expiresAt: expiresIn48h,
      },
    }),
  ]);

  console.log(`Created ${requests.length} requests`);

  // ── Generate matches via matching engine ─────────────────────────────
  const { findMatchesForRequest } = require('../src/utils/matching');

  for (const request of requests) {
    try {
      const matches = await findMatchesForRequest(request.id);
      console.log(`  ${matches.length} matches for: "${request.title}"`);
    } catch (err) {
      console.warn(`  Matching failed for "${request.title}": ${err.message}`);
    }
  }

  // ── Transactions (varied states) ────────────────────────────────────

  // 1. Completed transaction: Carol borrowed Alice's drill (past)
  const completedTxn = await prisma.transaction.create({
    data: {
      itemId: items[0].id,          // DeWalt Drill
      borrowerId: carol.id,
      lenderId: alice.id,
      status: 'completed',
      pickupTime: daysAgo(10),
      returnTime: daysAgo(8),
      actualPickupTime: daysAgo(10),
      actualReturnTime: daysAgo(8),
      rentalFee: 30, platformFee: 1.90,
      taxRate: 0.029, taxAmount: 0.87,
      protectionType: 'waiver',
      totalCharged: 32.77,
      paymentStatus: 'captured',
    },
  });

  // Ratings for completed transaction
  await prisma.rating.createMany({
    data: [
      {
        transactionId: completedTxn.id,
        raterId: carol.id, ratedUserId: alice.id,
        role: 'lender', overallRating: 5,
        onTimeRating: 5, communicationRating: 5, itemAsDescribedRating: 5,
        reviewText: 'Alice was great! Drill worked perfectly and she was very helpful.',
        wouldTransactAgain: true,
      },
      {
        transactionId: completedTxn.id,
        raterId: alice.id, ratedUserId: carol.id,
        role: 'borrower', overallRating: 5,
        onTimeRating: 5, communicationRating: 5, conditionRating: 5,
        reviewText: 'Carol returned the drill in perfect condition. Great borrower!',
        wouldTransactAgain: true,
      },
    ],
  });

  // Messages for completed transaction
  await prisma.message.createMany({
    data: [
      { transactionId: completedTxn.id, senderId: carol.id, recipientId: alice.id, messageText: 'Hi Alice! What time works for pickup tomorrow?', isRead: true },
      { transactionId: completedTxn.id, senderId: alice.id, recipientId: carol.id, messageText: 'Hi Carol! Anytime after 10am works for me.', isRead: true },
      { transactionId: completedTxn.id, senderId: carol.id, recipientId: alice.id, messageText: "Perfect! I'll be there around 10:30.", isRead: true },
    ],
  });

  console.log('Created completed transaction with ratings + messages');

  // 2. Active transaction: Hank borrowed Emma's trailer
  const activeTxn = await prisma.transaction.create({
    data: {
      itemId: items[13].id,       // Utility trailer
      borrowerId: hank.id,
      lenderId: emma.id,
      status: 'active',
      pickupTime: daysAgo(2),
      returnTime: new Date(now.getTime() + 2 * 24 * 60 * 60 * 1000),
      actualPickupTime: daysAgo(2),
      rentalFee: 80, platformFee: 3.40,
      taxRate: 0.029, taxAmount: 2.32,
      protectionType: 'insurance',
      insuranceFee: 40,
      totalCharged: 123.72,
      paymentStatus: 'authorized',
    },
  });

  await prisma.message.create({
    data: { transactionId: activeTxn.id, senderId: hank.id, recipientId: emma.id, messageText: 'Picked up the trailer, thanks! I\'ll have it back by Thursday.', isRead: true },
  });

  console.log('Created active transaction (trailer)');

  // 3. Accepted transaction: Irene's stand mixer lent to Leo
  await prisma.transaction.create({
    data: {
      itemId: items[20].id,       // Stand mixer
      borrowerId: leo.id,
      lenderId: irene.id,
      status: 'accepted',
      pickupTime: in3Days,
      returnTime: new Date(in3Days.getTime() + 3 * 24 * 60 * 60 * 1000),
      rentalFee: 45, platformFee: 2.35,
      taxRate: 0.029, taxAmount: 1.31,
      protectionType: 'deposit',
      depositAmount: 105,
      totalCharged: 48.66,
      paymentStatus: 'authorized',
    },
  });

  console.log('Created accepted transaction (stand mixer)');

  // 4. Requested transaction: Jake wants Bob's mountain bike
  await prisma.transaction.create({
    data: {
      itemId: items[6].id,        // Mountain bike
      borrowerId: jake.id,
      lenderId: bob.id,
      status: 'requested',
      pickupTime: nextWeek,
      returnTime: new Date(nextWeek.getTime() + 2 * 24 * 60 * 60 * 1000),
      rentalFee: 70, platformFee: 3.10,
      taxRate: 0.029, taxAmount: 2.03,
      protectionType: 'deposit',
      depositAmount: 180,
      totalCharged: 75.13,
      paymentStatus: 'pending',
    },
  });

  console.log('Created requested transaction (mountain bike)');

  // 5. Cancelled transaction: Kate cancelled projector rental
  await prisma.transaction.create({
    data: {
      itemId: items[22].id,       // Projector
      borrowerId: hank.id,
      lenderId: kate.id,
      status: 'cancelled',
      pickupTime: daysAgo(3),
      returnTime: daysAgo(1),
      rentalFee: 50, platformFee: 2.50,
      taxRate: 0.029, taxAmount: 1.45,
      protectionType: 'deposit',
      depositAmount: 90,
      totalCharged: 53.95,
      paymentStatus: 'refunded',
    },
  });

  console.log('Created cancelled transaction (projector)');

  // 6. Second completed: David's handyman service for Kate
  const completedServiceTxn = await prisma.transaction.create({
    data: {
      itemId: items[12].id,       // Handyman service
      borrowerId: kate.id,
      lenderId: david.id,
      status: 'completed',
      pickupTime: new Date(daysAgo(5).getTime()),
      returnTime: new Date(daysAgo(5).getTime() + 4 * 60 * 60 * 1000), // 4 hours later
      actualPickupTime: new Date(daysAgo(5).getTime()),
      actualReturnTime: new Date(daysAgo(5).getTime() + 3 * 60 * 60 * 1000),
      rentalFee: 75, platformFee: 3.25,
      taxRate: 0.029, taxAmount: 2.18,
      protectionType: 'waiver',
      totalCharged: 78.43,
      paymentStatus: 'captured',
    },
  });

  await prisma.rating.createMany({
    data: [
      {
        transactionId: completedServiceTxn.id,
        raterId: kate.id, ratedUserId: david.id,
        role: 'lender', overallRating: 4,
        communicationRating: 5,
        reviewText: 'David did a great job fixing my shelves. Very professional.',
        wouldTransactAgain: true,
      },
      {
        transactionId: completedServiceTxn.id,
        raterId: david.id, ratedUserId: kate.id,
        role: 'borrower', overallRating: 5,
        communicationRating: 5,
        reviewText: 'Kate was easy to work with. Clear about what she needed.',
        wouldTransactAgain: true,
      },
    ],
  });

  console.log('Created completed service transaction with ratings');

  // 7. Bundle transaction: Grace's party bundle from Carol (tables + speaker)
  // This demonstrates TransactionItem per-item breakdown
  const bundleTxn = await prisma.transaction.create({
    data: {
      itemId: items[7].id,         // Primary: folding tables (first item in bundle)
      bundleId: partyBundle.id,
      borrowerId: grace.id,
      lenderId: carol.id,
      status: 'requested',
      pickupTime: in2Weeks,
      returnTime: new Date(in2Weeks.getTime() + 24 * 60 * 60 * 1000),
      rentalFee: 70,               // 30 (tables) + 40 (speaker)
      platformFee: 3.10,
      taxRate: 0.029, taxAmount: 2.03,
      protectionType: 'deposit',
      depositAmount: 200,           // 40% of $500 speaker
      totalCharged: 75.13,
      paymentStatus: 'pending',
    },
  });

  // TransactionItem rows for per-item fee breakdown
  await prisma.transactionItem.createMany({
    data: [
      {
        transactionId: bundleTxn.id,
        itemId: items[7].id,       // Folding tables
        rentalFee: 30, platformFee: 1.30,
        taxAmount: 0.87,
      },
      {
        transactionId: bundleTxn.id,
        itemId: items[8].id,       // Speaker
        rentalFee: 40, platformFee: 1.80,
        taxAmount: 1.16, depositAmount: 200,
      },
    ],
  });

  console.log('Created bundle transaction with TransactionItem rows');

  console.log('\n✅ Seeding completed successfully!');
  console.log('\nTest accounts (all passwords: password123):');
  users.forEach((user) => {
    console.log(`  - ${user.email} (${user.neighborhood})`);
  });
  console.log('\nData summary:');
  console.log(`  ${users.length} users, ${items.length} items, ${requests.length} requests`);
  console.log('  3 bundles (camping, woodworking, party)');
  console.log('  7 transactions (2 completed, 1 active, 1 accepted, 2 requested, 1 cancelled)');
  console.log('  1 bundle transaction with TransactionItem rows');
  console.log('  4 service listings (handyman, lawn mowing, photography, tutoring)');
}

main()
  .catch((e) => {
    console.error('Seeding failed:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
