const { PrismaClient } = require('@prisma/client');
const bcrypt = require('bcrypt');

const prisma = new PrismaClient();

async function main() {
  console.log('Seeding demo data with specs matching scenarios...\n');

  // Clear existing data
  await prisma.rating.deleteMany();
  await prisma.message.deleteMany();
  await prisma.photo.deleteMany();
  await prisma.transaction.deleteMany();
  await prisma.match.deleteMany();
  await prisma.request.deleteMany();
  await prisma.item.deleteMany();
  await prisma.notification.deleteMany();
  await prisma.notificationPreference.deleteMany();
  await prisma.user.deleteMany();

  console.log('Cleared existing data\n');

  const passwordHash = await bcrypt.hash('password123', 10);

  // ================================================================
  // USERS - 12 users in Fort Collins, CO area
  // ================================================================
  const users = await Promise.all([
    // Original 6 users (fixed: firstName/lastName instead of fullName)
    prisma.user.create({ data: {
      email: 'alice@example.com', passwordHash,
      firstName: 'Alice', lastName: 'Johnson',
      phoneNumber: '9705551001',
      address: '123 Mountain Ave', city: 'Fort Collins', state: 'CO', zipCode: '80521',
      latitude: 40.5853, longitude: -105.0844,
      neighborhood: 'Old Town',
    }}),
    prisma.user.create({ data: {
      email: 'bob@example.com', passwordHash,
      firstName: 'Bob', lastName: 'Smith',
      phoneNumber: '9705551002',
      address: '456 College Ave', city: 'Fort Collins', state: 'CO', zipCode: '80524',
      latitude: 40.5734, longitude: -105.0865,
      neighborhood: 'Campus West',
    }}),
    prisma.user.create({ data: {
      email: 'carol@example.com', passwordHash,
      firstName: 'Carol', lastName: 'Williams',
      phoneNumber: '9705551003',
      address: '789 Shields St', city: 'Fort Collins', state: 'CO', zipCode: '80521',
      latitude: 40.5501, longitude: -105.0753,
      neighborhood: 'Midtown',
    }}),
    prisma.user.create({ data: {
      email: 'david@example.com', passwordHash,
      firstName: 'David', lastName: 'Brown',
      phoneNumber: '9705551004',
      address: '321 Harmony Rd', city: 'Fort Collins', state: 'CO', zipCode: '80525',
      latitude: 40.5254, longitude: -105.0578,
      neighborhood: 'Harmony',
    }}),
    prisma.user.create({ data: {
      email: 'emma@example.com', passwordHash,
      firstName: 'Emma', lastName: 'Davis',
      phoneNumber: '9705551005',
      address: '654 Drake Rd', city: 'Fort Collins', state: 'CO', zipCode: '80526',
      latitude: 40.5456, longitude: -105.0912,
      neighborhood: 'Drake',
    }}),
    prisma.user.create({ data: {
      email: 'frank@example.com', passwordHash,
      firstName: 'Frank', lastName: 'Miller',
      phoneNumber: '9705551006',
      address: '987 Timberline Rd', city: 'Fort Collins', state: 'CO', zipCode: '80525',
      latitude: 40.5389, longitude: -105.0234,
      neighborhood: 'Timberline',
    }}),
    // 6 new users
    prisma.user.create({ data: {
      email: 'grace@example.com', passwordHash,
      firstName: 'Grace', lastName: 'Chen',
      phoneNumber: '9705551007',
      address: '220 Linden St', city: 'Fort Collins', state: 'CO', zipCode: '80524',
      latitude: 40.5870, longitude: -105.0830,
      neighborhood: 'Old Town',
    }}),
    prisma.user.create({ data: {
      email: 'hank@example.com', passwordHash,
      firstName: 'Hank', lastName: 'Rodriguez',
      phoneNumber: '9705551008',
      address: '1450 Trilby Rd', city: 'Fort Collins', state: 'CO', zipCode: '80525',
      latitude: 40.5190, longitude: -105.0650,
      neighborhood: 'South Fort Collins',
    }}),
    prisma.user.create({ data: {
      email: 'irene@example.com', passwordHash,
      firstName: 'Irene', lastName: 'Park',
      phoneNumber: '9705551009',
      address: '2200 Harmony Rd', city: 'Fort Collins', state: 'CO', zipCode: '80525',
      latitude: 40.5280, longitude: -105.0600,
      neighborhood: 'Harmony',
    }}),
    prisma.user.create({ data: {
      email: 'jake@example.com', passwordHash,
      firstName: 'Jake', lastName: 'Thompson',
      phoneNumber: '9705551010',
      address: '800 W Plum St', city: 'Fort Collins', state: 'CO', zipCode: '80521',
      latitude: 40.5750, longitude: -105.0840,
      neighborhood: 'Campus West',
    }}),
    prisma.user.create({ data: {
      email: 'kate@example.com', passwordHash,
      firstName: 'Kate', lastName: 'Wilson',
      phoneNumber: '9705551011',
      address: '1100 W Drake Rd', city: 'Fort Collins', state: 'CO', zipCode: '80526',
      latitude: 40.5470, longitude: -105.0890,
      neighborhood: 'Drake',
    }}),
    prisma.user.create({ data: {
      email: 'leo@example.com', passwordHash,
      firstName: 'Leo', lastName: 'Martinez',
      phoneNumber: '9705551012',
      address: '900 Shields St', city: 'Fort Collins', state: 'CO', zipCode: '80521',
      latitude: 40.5520, longitude: -105.0780,
      neighborhood: 'Midtown',
    }}),
  ]);

  const [alice, bob, carol, david, emma, frank, grace, hank, irene, jake, kate, leo] = users;
  console.log(`Created ${users.length} users\n`);

  // ================================================================
  // ITEMS - Mix of items and services with specs
  // ================================================================

  const items = await Promise.all([
    // --- WINTER SPORTS ITEMS (for hard/soft/non-match demos) ---

    // Grace: Alpine Skis 170cm All-Mountain (HARD MATCH target for Jake's request)
    prisma.item.create({ data: {
      ownerId: grace.id,
      category: 'outdoor_recreation',
      listingType: 'item',
      categoryTier1: 'Outdoor & Recreation',
      categoryTier2: 'Winter Sports',
      categoryTier3: 'Alpine Skis',
      title: 'Alpine Skis',
      description: 'All-mountain skis in great shape. 170cm, bindings included. Perfect for intermediate skiers hitting the Front Range resorts.',
      condition: 'excellent',
      replacementValue: 600,
      pricingType: 'daily',
      priceAmount: 30,
      lateFeeAmount: 20,
      protectionPreference: 'deposit_required',
      depositPercentage: 30,
      photoUrls: ['https://images.unsplash.com/photo-1558733496-4eb96dacb4cf?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w4NzU2ODR8MHwxfHNlYXJjaHwxfHxhbHBpbmUlMjBza2lpbmclMjBkb3duaGlsbHxlbnwwfDJ8fHwxNzcxMjYwNzg2fDA&ixlib=rb-4.1.0&q=80&w=1080'],
      details: {
        specs: {
          sizeCm: { value: 170 },
          skillLevel: { value: 'Intermediate' },
          brand: { value: 'Rossignol' },
          bindingIncluded: { value: true },
          waistWidth: { value: 82 },
          skiType: { value: 'All-Mountain' },
        },
        specVersion: 1,
        additionalNotes: 'Waxed and tuned this season. Bindings are adjustable.',
      },
    }}),

    // Bob: Alpine Skis 180cm Powder (SOFT MATCH - size in range but wrong type)
    prisma.item.create({ data: {
      ownerId: bob.id,
      category: 'outdoor_recreation',
      listingType: 'item',
      categoryTier1: 'Outdoor & Recreation',
      categoryTier2: 'Winter Sports',
      categoryTier3: 'Alpine Skis',
      title: 'Alpine Skis',
      description: 'Fat powder skis, 180cm. Great for deep days at Steamboat or Cameron Pass.',
      condition: 'good',
      replacementValue: 700,
      pricingType: 'daily',
      priceAmount: 35,
      lateFeeAmount: 25,
      protectionPreference: 'deposit_required',
      depositPercentage: 40,
      photoUrls: ['https://images.unsplash.com/photo-1755547721485-1a717d61a54b?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w4NzU2ODR8MHwxfHNlYXJjaHwxfHxwb3dkZXIlMjBza2lzJTIwZGVlcCUyMHNub3clMjBza2lpbmd8ZW58MHwyfHx8MTc3MTE5ODY5MHww&ixlib=rb-4.1.0&q=80&w=1080'],
      details: {
        specs: {
          sizeCm: { value: 180 },
          skillLevel: { value: 'Advanced' },
          brand: { value: 'K2' },
          bindingIncluded: { value: true },
          waistWidth: { value: 108 },
          skiType: { value: 'Powder' },
        },
        specVersion: 1,
        additionalNotes: 'Wide powder skis. Not great for groomers.',
      },
    }}),

    // Grace: Ski Boots 270mm Intermediate (HARD MATCH for Jake's boot request)
    prisma.item.create({ data: {
      ownerId: grace.id,
      category: 'outdoor_recreation',
      listingType: 'item',
      categoryTier1: 'Outdoor & Recreation',
      categoryTier2: 'Winter Sports',
      categoryTier3: 'Ski Boots (Alpine)',
      title: 'Ski Boots (Alpine)',
      description: 'Comfortable intermediate ski boots. Mondo 270 (US 9). Flex 80.',
      condition: 'good',
      replacementValue: 350,
      pricingType: 'daily',
      priceAmount: 20,
      lateFeeAmount: 15,
      protectionPreference: 'deposit_required',
      depositPercentage: 30,
      photoUrls: ['https://images.unsplash.com/photo-1733743800254-619d7a5fc6d9?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w4NzU2ODR8MHwxfHNlYXJjaHwxfHxza2klMjBib290c3xlbnwwfDJ8fHwxNzcxMjYwNzg4fDA&ixlib=rb-4.1.0&q=80&w=1080'],
      details: {
        specs: {
          bootSize: { value: 270 },
          flex: { value: 80 },
          skillLevel: { value: 'Intermediate' },
          brand: { value: 'Salomon' },
        },
        specVersion: 1,
      },
    }}),

    // David: Ski Boots 295mm (NON-MATCH - size way too big, will be excluded by required)
    prisma.item.create({ data: {
      ownerId: david.id,
      category: 'outdoor_recreation',
      listingType: 'item',
      categoryTier1: 'Outdoor & Recreation',
      categoryTier2: 'Winter Sports',
      categoryTier3: 'Ski Boots (Alpine)',
      title: 'Ski Boots (Alpine)',
      description: 'Stiff performance boots. Mondo 295 (US 11.5). Flex 100.',
      condition: 'excellent',
      replacementValue: 400,
      pricingType: 'daily',
      priceAmount: 25,
      lateFeeAmount: 15,
      protectionPreference: 'deposit_required',
      depositPercentage: 30,
      photoUrls: ['https://images.unsplash.com/photo-1704402496338-185406195639?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w4NzU2ODR8MHwxfHNlYXJjaHwxfHxza2klMjBlcXVpcG1lbnQlMjBib290c3xlbnwwfDJ8fHwxNzcxMjYwNzg5fDA&ixlib=rb-4.1.0&q=80&w=1080'],
      details: {
        specs: {
          bootSize: { value: 295 },
          flex: { value: 100 },
          skillLevel: { value: 'Advanced' },
          brand: { value: 'Nordica' },
        },
        specVersion: 1,
      },
    }}),

    // Frank: Snowboard 155cm All-Mountain (HARD MATCH for Bob's snowboard request)
    prisma.item.create({ data: {
      ownerId: frank.id,
      category: 'outdoor_recreation',
      listingType: 'item',
      categoryTier1: 'Outdoor & Recreation',
      categoryTier2: 'Winter Sports',
      categoryTier3: 'Snowboard',
      title: 'Snowboard',
      description: 'Versatile all-mountain board. 155cm with Burton Re:Flex bindings. Great for everything.',
      condition: 'excellent',
      replacementValue: 500,
      pricingType: 'daily',
      priceAmount: 30,
      lateFeeAmount: 20,
      protectionPreference: 'deposit_required',
      depositPercentage: 30,
      photoUrls: ['https://images.unsplash.com/photo-1592754385298-f2dfcb95b95b?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w4NzU2ODR8MHwxfHNlYXJjaHwxfHxzbm93Ym9hcmQlMjB3aW50ZXJ8ZW58MHwyfHx8MTc3MTI2MDc5MXww&ixlib=rb-4.1.0&q=80&w=1080'],
      details: {
        specs: {
          sizeCm: { value: 155 },
          skillLevel: { value: 'Intermediate' },
          brand: { value: 'Burton' },
          boardType: { value: 'All-Mountain' },
          bindingsIncluded: { value: true },
        },
        specVersion: 1,
      },
    }}),

    // Leo: Snowboard 158cm Freestyle NO bindings (SOFT MATCH - close size, wrong type, no bindings)
    prisma.item.create({ data: {
      ownerId: leo.id,
      category: 'outdoor_recreation',
      listingType: 'item',
      categoryTier1: 'Outdoor & Recreation',
      categoryTier2: 'Winter Sports',
      categoryTier3: 'Snowboard',
      title: 'Snowboard',
      description: 'Park and freestyle board. 158cm. Bindings not included.',
      condition: 'good',
      replacementValue: 400,
      pricingType: 'daily',
      priceAmount: 25,
      lateFeeAmount: 15,
      protectionPreference: 'deposit_required',
      depositPercentage: 30,
      photoUrls: ['https://images.unsplash.com/photo-1755554817665-a098ba78b88d?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w4NzU2ODR8MHwxfHNlYXJjaHwxfHxzbm93Ym9hcmRpbmclMjBmcmVlc3R5bGV8ZW58MHwyfHx8MTc3MTI2MDc5Mnww&ixlib=rb-4.1.0&q=80&w=1080'],
      details: {
        specs: {
          sizeCm: { value: 158 },
          skillLevel: { value: 'Advanced' },
          brand: { value: 'Ride' },
          boardType: { value: 'Freestyle' },
          bindingsIncluded: { value: false },
        },
        specVersion: 1,
      },
    }}),

    // Grace: Snowshoes (HARD MATCH for Kate's request)
    prisma.item.create({ data: {
      ownerId: grace.id,
      category: 'outdoor_recreation',
      listingType: 'item',
      categoryTier1: 'Outdoor & Recreation',
      categoryTier2: 'Winter Sports',
      categoryTier3: 'Snowshoes',
      title: 'Snowshoes',
      description: 'Great recreational snowshoes for trails around Horsetooth and Cameron Pass.',
      condition: 'excellent',
      replacementValue: 180,
      pricingType: 'daily',
      priceAmount: 15,
      lateFeeAmount: 10,
      protectionPreference: 'waiver_ok',
      photoUrls: ['https://images.unsplash.com/photo-1631847774480-443cada911d1?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w4NzU2ODR8MHwxfHNlYXJjaHwxfHxzbm93c2hvZXMlMjBzbm93JTIwaGlraW5nfGVufDB8Mnx8fDE3NzEyNjA3OTR8MA&ixlib=rb-4.1.0&q=80&w=1080'],
      details: {
        specs: {
          weightRange: { value: '120-200 lbs' },
          sizeCm: { value: 22 },
          includesPoles: { value: true },
        },
        specVersion: 1,
        additionalNotes: 'Great for beginner to intermediate trails.',
      },
    }}),

    // --- TOOLS ---

    // Alice: Circular Saw (HARD MATCH for Bob's request)
    prisma.item.create({ data: {
      ownerId: alice.id,
      category: 'tools',
      listingType: 'item',
      categoryTier1: 'Tools',
      categoryTier2: 'Power Tools',
      categoryTier3: 'Circular Saw',
      title: 'Circular Saw',
      description: 'Cordless circular saw with 7-1/4" blade. Includes battery and charger.',
      condition: 'excellent',
      replacementValue: 180,
      pricingType: 'daily',
      priceAmount: 15,
      lateFeeAmount: 10,
      protectionPreference: 'deposit_required',
      depositPercentage: 40,
      photoUrls: ['https://images.unsplash.com/photo-1657095544219-6328434702a8?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w4NzU2ODR8MHwxfHNlYXJjaHwxfHxjaXJjdWxhciUyMHNhdyUyMGNvcmRsZXNzJTIwY3V0dGluZyUyMHdvb2R8ZW58MHwyfHx8MTc3MTE5ODY5M3ww&ixlib=rb-4.1.0&q=80&w=1080'],
      details: {
        specs: {
          powerSource: { value: 'Cordless (Battery)' },
          voltage: { value: '20V' },
          brand: { value: 'DeWalt' },
          includesCase: { value: true },
          includesBattery: { value: true },
          bladeSize: { value: '7-1/4"' },
        },
        specVersion: 1,
      },
    }}),

    // David: Miter Saw with specs
    prisma.item.create({ data: {
      ownerId: david.id,
      category: 'tools',
      listingType: 'item',
      categoryTier1: 'Tools',
      categoryTier2: 'Power Tools',
      categoryTier3: 'Miter Saw',
      title: 'Miter Saw',
      description: 'Sliding compound miter saw. Great for trim work, crown molding, and framing.',
      condition: 'good',
      replacementValue: 400,
      pricingType: 'daily',
      priceAmount: 35,
      lateFeeAmount: 25,
      protectionPreference: 'insurance_required',
      photoUrls: ['https://images.unsplash.com/photo-1657095544219-6328434702a8?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w4NzU2ODR8MHwxfHNlYXJjaHwxfHxtaXRlciUyMHNhdyUyMGN1dHRpbmclMjB3b29kfGVufDB8Mnx8fDE3NzEyNjA3ODJ8MA&ixlib=rb-4.1.0&q=80&w=1080'],
      details: {
        specs: {
          powerSource: { value: 'Corded' },
          voltage: { value: '120V (Corded)' },
          brand: { value: 'DeWalt' },
          includesCase: { value: false },
          includesBattery: { value: false },
          bladeSize: { value: '12"' },
          slidingCompound: { value: true },
        },
        specVersion: 1,
      },
    }}),

    // Frank: Table Saw with specs
    prisma.item.create({ data: {
      ownerId: frank.id,
      category: 'tools',
      listingType: 'item',
      categoryTier1: 'Tools',
      categoryTier2: 'Power Tools',
      categoryTier3: 'Table Saw',
      title: 'Table Saw',
      description: '10" portable table saw with stand. Great for woodworking projects.',
      condition: 'excellent',
      replacementValue: 500,
      pricingType: 'daily',
      priceAmount: 40,
      lateFeeAmount: 30,
      protectionPreference: 'deposit_required',
      depositPercentage: 40,
      photoUrls: ['https://images.unsplash.com/photo-1565791380713-1756b9a05343?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w4NzU2ODR8MHwxfHNlYXJjaHwxfHx0YWJsZSUyMHNhdyUyMHdvb2R3b3JraW5nJTIwd29ya3Nob3B8ZW58MHwyfHx8MTc3MTE5ODY3M3ww&ixlib=rb-4.1.0&q=80&w=1080'],
      details: {
        specs: {
          powerSource: { value: 'Corded' },
          voltage: { value: '120V (Corded)' },
          brand: { value: 'DeWalt' },
          includesCase: { value: false },
          includesBattery: { value: false },
          bladeSize: { value: '10"' },
          tableType: { value: 'Portable/Jobsite' },
        },
        specVersion: 1,
      },
    }}),

    // Leo: Extension Ladder (HARD MATCH for Emma's request)
    prisma.item.create({ data: {
      ownerId: leo.id,
      category: 'tools',
      listingType: 'item',
      categoryTier1: 'Tools',
      categoryTier2: 'Ladders & Scaffolding',
      categoryTier3: 'Extension Ladder (16-20 ft)',
      title: 'Extension Ladder (16-20 ft)',
      description: '20-foot fiberglass extension ladder. 300 lb capacity. Great for painting, gutters, etc.',
      condition: 'good',
      replacementValue: 250,
      pricingType: 'daily',
      priceAmount: 20,
      lateFeeAmount: 15,
      protectionPreference: 'waiver_ok',
      photoUrls: ['https://images.unsplash.com/photo-1746950061282-be919bf6c570?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w4NzU2ODR8MHwxfHNlYXJjaHwxfHxleHRlbnNpb24lMjBsYWRkZXIlMjBmaWJlcmdsYXNzJTIwdGFsbHxlbnwwfDJ8fHwxNzcxMTk4Njk1fDA&ixlib=rb-4.1.0&q=80&w=1080'],
      details: {
        specs: {
          heightFt: { value: 20 },
          weightCapacity: { value: 300 },
          material: { value: 'Fiberglass' },
        },
        specVersion: 1,
      },
    }}),

    // --- PARTY & EVENTS ---

    // Irene: Bounce House (HARD MATCH for Carol's request)
    prisma.item.create({ data: {
      ownerId: irene.id,
      category: 'party_events',
      listingType: 'item',
      categoryTier1: 'Party & Events',
      categoryTier2: 'Entertainment',
      categoryTier3: 'Bounce House',
      title: 'Bounce House',
      description: 'Colorful bounce house with slide. Great for birthday parties! Blower and stakes included.',
      condition: 'good',
      replacementValue: 350,
      pricingType: 'daily',
      priceAmount: 60,
      lateFeeAmount: 40,
      protectionPreference: 'deposit_required',
      depositPercentage: 50,
      photoUrls: ['https://images.unsplash.com/photo-1574276254982-d209f79d673a?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w4NzU2ODR8MHwxfHNlYXJjaHwxfHxwYXJ0eSUyMGRlY29yYXRpb25zJTIwYmFsbG9vbnMlMjBzdHJlYW1lcnN8ZW58MHwyfHx8MTc3MTE5ODY4OHww&ixlib=rb-4.1.0&q=80&w=1080'],
      details: {
        specs: {
          dimensions: { value: '13ft x 12ft x 9ft' },
          ageRange: { value: 'Kids (3-10)' },
          includesBlower: { value: true },
          includesDelivery: { value: true },
        },
        specVersion: 1,
        additionalNotes: 'I can deliver and set up within 10 miles. Takes about 20 min to inflate.',
      },
    }}),

    // Irene: Projector & Screen
    prisma.item.create({ data: {
      ownerId: irene.id,
      category: 'party_events',
      listingType: 'item',
      categoryTier1: 'Party & Events',
      categoryTier2: 'Entertainment',
      categoryTier3: 'Projector & Screen',
      title: 'Projector & Screen',
      description: 'HD projector with portable 120" screen. Great for outdoor movie nights!',
      condition: 'excellent',
      replacementValue: 600,
      pricingType: 'daily',
      priceAmount: 45,
      lateFeeAmount: 30,
      protectionPreference: 'deposit_required',
      depositPercentage: 40,
      photoUrls: ['https://images.unsplash.com/photo-1753019492873-6593679cf031?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w4NzU2ODR8MHwxfHNlYXJjaHwxfHxvdXRkb29yJTIwbW92aWUlMjBwcm9qZWN0b3J8ZW58MHwyfHx8MTc3MTI2MDc5NXww&ixlib=rb-4.1.0&q=80&w=1080'],
      details: {
        specs: {
          lumens: { value: 3200 },
          screenSize: { value: 120 },
          includesScreen: { value: true },
          includesAudio: { value: false },
        },
        specVersion: 1,
        additionalNotes: 'HDMI and USB inputs. Bring your own speakers for best sound.',
      },
    }}),

    // Carol: Sound System (HARD MATCH for David's party request)
    prisma.item.create({ data: {
      ownerId: carol.id,
      category: 'party_events',
      listingType: 'item',
      categoryTier1: 'Party & Events',
      categoryTier2: 'Entertainment',
      categoryTier3: 'Sound System/Speakers',
      title: 'Sound System/Speakers',
      description: 'Powerful Bluetooth speaker with LED lights. Mic included. Perfect for outdoor parties.',
      condition: 'excellent',
      replacementValue: 500,
      pricingType: 'daily',
      priceAmount: 40,
      lateFeeAmount: 30,
      protectionPreference: 'deposit_required',
      depositPercentage: 40,
      photoUrls: ['https://images.unsplash.com/photo-1665672629999-0994c3f052a9?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w4NzU2ODR8MHwxfHNlYXJjaHwxfHxwb3J0YWJsZSUyMHNwZWFrZXIlMjBtdXNpY3xlbnwwfDJ8fHwxNzcxMjYwNzgzfDA&ixlib=rb-4.1.0&q=80&w=1080'],
      details: {
        specs: {
          watts: { value: 240 },
          hasBluetooth: { value: true },
          includesMic: { value: true },
        },
        specVersion: 1,
      },
    }}),

    // --- VEHICLES ---

    // Leo: Pickup Truck (HARD MATCH for Frank's request - has 4WD)
    prisma.item.create({ data: {
      ownerId: leo.id,
      category: 'vehicles_transport',
      listingType: 'item',
      categoryTier1: 'Vehicles & Transport',
      categoryTier2: 'Trucks & Trailers',
      categoryTier3: 'Pickup Truck',
      title: 'Pickup Truck',
      description: '2019 Ford F-250. Crew cab, long bed, 4WD. Great for hauling and towing.',
      condition: 'good',
      replacementValue: 35000,
      pricingType: 'daily',
      priceAmount: 100,
      lateFeeAmount: 75,
      protectionPreference: 'insurance_required',
      photoUrls: ['https://images.unsplash.com/photo-1631433048456-42126b541bfb?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w4NzU2ODR8MHwxfHNlYXJjaHwxfHxmb3JkJTIwZjI1MCUyMHBpY2t1cCUyMHRydWNrfGVufDB8Mnx8fDE3NzExOTg2OTd8MA&ixlib=rb-4.1.0&q=80&w=1080'],
      details: {
        specs: {
          towCapacity: { value: 12000 },
          hitchType: { value: 'Bumper Pull' },
          bedSize: { value: 'Long (8 ft)' },
          cabType: { value: 'Crew Cab' },
          fourWD: { value: true },
        },
        specVersion: 1,
      },
    }}),

    // David: Pickup Truck (NON-MATCH for 4WD-required requests - no 4WD)
    prisma.item.create({ data: {
      ownerId: david.id,
      category: 'vehicles_transport',
      listingType: 'item',
      categoryTier1: 'Vehicles & Transport',
      categoryTier2: 'Trucks & Trailers',
      categoryTier3: 'Pickup Truck',
      title: 'Pickup Truck',
      description: '2020 Tacoma. Regular cab, short bed. 2WD. Good for light hauling around town.',
      condition: 'good',
      replacementValue: 25000,
      pricingType: 'daily',
      priceAmount: 65,
      lateFeeAmount: 50,
      protectionPreference: 'insurance_required',
      photoUrls: ['https://images.unsplash.com/photo-1631433048456-42126b541bfb?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w4NzU2ODR8MHwxfHNlYXJjaHwxfHxwaWNrdXAlMjB0cnVja3xlbnwwfDJ8fHwxNzcxMjYwNzk3fDA&ixlib=rb-4.1.0&q=80&w=1080'],
      details: {
        specs: {
          towCapacity: { value: 3500 },
          hitchType: { value: 'Bumper Pull' },
          bedSize: { value: 'Short (5-6 ft)' },
          cabType: { value: 'Regular Cab' },
          fourWD: { value: false },
        },
        specVersion: 1,
      },
    }}),

    // --- SPECIALIZED EQUIPMENT ---

    // Grace: DSLR Camera (HARD MATCH for Emma's camera request)
    prisma.item.create({ data: {
      ownerId: grace.id,
      category: 'specialized_equipment',
      listingType: 'item',
      categoryTier1: 'Specialized Equipment',
      categoryTier2: 'Photography & Video',
      categoryTier3: 'DSLR Camera',
      title: 'DSLR Camera',
      description: 'Full-frame DSLR with 24-70mm f/2.8L lens. Extra battery and 64GB card included.',
      condition: 'excellent',
      replacementValue: 3000,
      pricingType: 'daily',
      priceAmount: 75,
      lateFeeAmount: 50,
      protectionPreference: 'insurance_required',
      photoUrls: ['https://images.unsplash.com/photo-1612810033524-dc632d5fb19d?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w4NzU2ODR8MHwxfHNlYXJjaHwxfHxjYW5vbiUyMGRzbHIlMjBjYW1lcmElMjBsZW5zJTIwcGhvdG9ncmFwaHl8ZW58MHwyfHx8MTc3MTE5ODY5OXww&ixlib=rb-4.1.0&q=80&w=1080'],
      details: {
        specs: {
          brand: { value: 'Canon' },
          model: { value: 'EOS 5D Mark IV' },
          includesBattery: { value: true },
          includesMemoryCard: { value: true },
          sensorType: { value: 'Full Frame' },
          lensMount: { value: 'Canon EF' },
          includesLens: { value: true },
        },
        specVersion: 1,
        additionalNotes: 'Comes with Canon 24-70mm f/2.8L II lens, 2 batteries, 64GB CF card.',
      },
    }}),

    // --- LAWN & GARDEN ---

    // Alice: Pressure Washer (HARD MATCH for Emma's request)
    prisma.item.create({ data: {
      ownerId: alice.id,
      category: 'specialized_equipment',
      listingType: 'item',
      categoryTier1: 'Specialized Equipment',
      categoryTier2: 'Home Improvement',
      categoryTier3: 'Pressure Washer (Electric)',
      title: 'Pressure Washer (Electric)',
      description: '2030 PSI electric pressure washer. 5 quick-connect nozzle tips included.',
      condition: 'good',
      replacementValue: 200,
      pricingType: 'daily',
      priceAmount: 25,
      lateFeeAmount: 15,
      protectionPreference: 'deposit_required',
      depositPercentage: 50,
      photoUrls: ['https://images.unsplash.com/photo-1657095544219-6328434702a8?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w4NzU2ODR8MHwxfHNlYXJjaHwxfHxjaXJjdWxhciUyMHNhdyUyMGNvcmRsZXNzJTIwY3V0dGluZyUyMHdvb2R8ZW58MHwyfHx8MTc3MTE5ODY5M3ww&ixlib=rb-4.1.0&q=80&w=1080'],
      details: {
        specs: {
          psi: { value: 2030 },
          gpm: { value: 1.76 },
          includesNozzles: { value: true },
          powerSource: { value: 'Electric (Corded)' },
          brand: { value: 'Sun Joe' },
        },
        specVersion: 1,
      },
    }}),

    // --- WORKSPACE ---

    // Frank: Garage Workshop
    prisma.item.create({ data: {
      ownerId: frank.id,
      category: 'workspace',
      listingType: 'item',
      categoryTier1: 'Workspace',
      categoryTier2: 'Garage Space',
      categoryTier3: 'Workshop Space',
      title: 'Workshop Space',
      description: 'Heated 2-car garage with workbench, power outlets, and lighting. Vehicle drive-in access.',
      condition: 'excellent',
      replacementValue: 0,
      pricingType: 'hourly',
      priceAmount: 12,
      protectionPreference: 'waiver_ok',
      photoUrls: ['https://images.unsplash.com/photo-1742989667140-c69adadf556b?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w4NzU2ODR8MHwxfHNlYXJjaHwxfHx3b3Jrc2hvcCUyMHRvb2xzJTIwd29ya2JlbmNofGVufDB8Mnx8fDE3NzEyNjA3ODV8MA&ixlib=rb-4.1.0&q=80&w=1080'],
      details: {
        specs: {
          sqFt: { value: 400 },
          hasPower: { value: true },
          hasLighting: { value: true },
          ceilingHeight: { value: 10 },
          vehicleAccess: { value: true },
        },
        specVersion: 1,
      },
    }}),

    // --- CAMPING ---

    // Bob: 4-Person Tent (HARD MATCH for Frank's camping request)
    prisma.item.create({ data: {
      ownerId: bob.id,
      category: 'outdoor_recreation',
      listingType: 'item',
      categoryTier1: 'Outdoor & Recreation',
      categoryTier2: 'Camping',
      categoryTier3: 'Tent (4-Person)',
      title: 'Tent (4-Person)',
      description: '4-person 3-season tent. Easy setup, great for family camping at state parks.',
      condition: 'excellent',
      replacementValue: 250,
      pricingType: 'daily',
      priceAmount: 20,
      lateFeeAmount: 15,
      protectionPreference: 'deposit_required',
      depositPercentage: 30,
      photoUrls: ['https://images.unsplash.com/photo-1629580600442-d77795f7efd3?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w4NzU2ODR8MHwxfHNlYXJjaHwxfHxjYW1waW5nJTIwdGVudCUyMG91dGRvb3JzJTIwZm9yZXN0fGVufDB8Mnx8fDE3NzExOTg2NzZ8MA&ixlib=rb-4.1.0&q=80&w=1080'],
      details: {
        specs: {
          brand: { value: 'REI' },
          weightLbs: { value: 7.5 },
          seasonRating: { value: '3-Season' },
          capacity: { value: 4 },
        },
        specVersion: 1,
        additionalNotes: 'Includes footprint and rainfly. Fits 4 sleeping pads.',
      },
    }}),

    // --- EMERGENCY ---

    // Leo: Generator (for matching demo)
    prisma.item.create({ data: {
      ownerId: leo.id,
      category: 'other',
      listingType: 'item',
      categoryTier1: 'Emergency & Cleanup',
      categoryTier2: 'Emergency',
      categoryTier3: 'Generator (Portable)',
      title: 'Generator (Portable)',
      description: 'Quiet inverter generator. 2200W. Perfect for camping or power outages.',
      condition: 'excellent',
      replacementValue: 1100,
      pricingType: 'daily',
      priceAmount: 50,
      lateFeeAmount: 35,
      protectionPreference: 'insurance_required',
      photoUrls: ['https://images.unsplash.com/photo-1672257278876-b9142b7493cc?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w4NzU2ODR8MHwxfHNlYXJjaHwxfHxwb3J0YWJsZSUyMGdlbmVyYXRvciUyMGhvbmRhJTIwY2FtcGluZ3xlbnwwfDJ8fHwxNzcxMTk4NzAwfDA&ixlib=rb-4.1.0&q=80&w=1080'],
      details: {
        specs: {
          watts: { value: 2200 },
          fuelType: { value: 'Gasoline' },
          startType: { value: 'Pull Start' },
          outlets: { value: ['120V (Standard)', '120V (GFCI)', 'USB', '12V DC'] },
          inverter: { value: true },
        },
        specVersion: 1,
      },
    }}),

    // ================================================================
    // SERVICE LISTINGS
    // ================================================================

    // Hank: General Handyman (HARD MATCH for Kate's request)
    prisma.item.create({ data: {
      ownerId: hank.id,
      category: 'services',
      listingType: 'service',
      categoryTier1: 'Home & Repair',
      categoryTier2: 'General Handyman',
      categoryTier3: 'General Repair',
      title: 'General Repair',
      description: '10+ years experience. Licensed and insured. I bring my own tools. Everything from drywall to plumbing.',
      condition: 'excellent',
      replacementValue: 0,
      pricingType: 'hourly',
      priceAmount: 35,
      protectionPreference: 'waiver_ok',
      photoUrls: ['https://images.unsplash.com/photo-1571115637435-26e423673f7b?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w4NzU2ODR8MHwxfHNlYXJjaHwxfHxoYW5keW1hbiUyMGhvbWUlMjByZXBhaXIlMjB0b29sc3xlbnwwfDJ8fHwxNzcxMTk4Njc3fDA&ixlib=rb-4.1.0&q=80&w=1080'],
      details: {
        specs: {
          yearsExperience: { value: 12 },
          licensed: { value: true },
          providesOwnTools: { value: true },
        },
        specVersion: 1,
        additionalNotes: 'Free estimates. Available weekdays and weekends.',
      },
    }}),

    // Hank: Moving Help (HARD MATCH for Kate's moving request)
    prisma.item.create({ data: {
      ownerId: hank.id,
      category: 'services',
      listingType: 'service',
      categoryTier1: 'Moving & Hauling',
      categoryTier2: 'Moving Help',
      categoryTier3: 'Local Move',
      title: 'Local Move',
      description: 'Me and a buddy with a truck. Moving blankets, dollies, and straps included.',
      condition: 'excellent',
      replacementValue: 0,
      pricingType: 'hourly',
      priceAmount: 55,
      protectionPreference: 'waiver_ok',
      photoUrls: ['https://images.unsplash.com/photo-1764852865537-fa1b0b4885cf?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w4NzU2ODR8MHwxfHNlYXJjaHwxfHxtb3ZpbmclMjBoZWxwZXJzJTIwY2FycnlpbmclMjBmdXJuaXR1cmUlMjB0cnVja3xlbnwwfDJ8fHwxNzcxMTk4NzAyfDA&ixlib=rb-4.1.0&q=80&w=1080'],
      details: {
        specs: {
          numHelpers: { value: 2 },
          hasTruck: { value: true },
          hasEquipment: { value: true },
        },
        specVersion: 1,
        additionalNotes: 'Full-size pickup truck. Can do apartments, houses, storage units.',
      },
    }}),

    // Leo: Snow Removal Service (HARD MATCH for Alice's request)
    prisma.item.create({ data: {
      ownerId: leo.id,
      category: 'services',
      listingType: 'service',
      categoryTier1: 'Yard & Outdoor',
      categoryTier2: 'Snow Removal',
      categoryTier3: 'Driveway & Sidewalk',
      title: 'Driveway & Sidewalk',
      description: 'Residential snow removal. I bring my own equipment. Salt/de-icer included.',
      condition: 'excellent',
      replacementValue: 0,
      pricingType: 'hourly',
      priceAmount: 40,
      protectionPreference: 'waiver_ok',
      photoUrls: ['https://images.unsplash.com/photo-1580219431602-b2b7bed1f479?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w4NzU2ODR8MHwxfHNlYXJjaHwxfHxzbm93JTIwc2hvdmVsaW5nJTIwd2ludGVyfGVufDB8Mnx8fDE3NzEyNjA3OTh8MA&ixlib=rb-4.1.0&q=80&w=1080'],
      details: {
        specs: {
          providesEquipment: { value: true },
          includesSalt: { value: true },
        },
        specVersion: 1,
      },
    }}),

    // Irene: House Cleaning (HARD MATCH for David's request)
    prisma.item.create({ data: {
      ownerId: irene.id,
      category: 'services',
      listingType: 'service',
      categoryTier1: 'Cleaning',
      categoryTier2: 'House Cleaning',
      categoryTier3: 'Standard Cleaning',
      title: 'Standard Cleaning',
      description: 'Thorough cleaning service. I bring all supplies. Eco-friendly products available.',
      condition: 'excellent',
      replacementValue: 0,
      pricingType: 'hourly',
      priceAmount: 30,
      protectionPreference: 'waiver_ok',
      photoUrls: ['https://images.unsplash.com/photo-1763048819607-ea55217cff34?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w4NzU2ODR8MHwxfHNlYXJjaHwxfHxob3VzZSUyMGNsZWFuaW5nJTIwc2VydmljZSUyMHN1cHBsaWVzfGVufDB8Mnx8fDE3NzExOTk0MzN8MA&ixlib=rb-4.1.0&q=80&w=1080'],
      details: {
        specs: {
          providesSupplies: { value: true },
          ecoFriendly: { value: true },
          maxSqFt: { value: 'Large (2000-3500 sq ft)' },
        },
        specVersion: 1,
        additionalNotes: 'References available. Been cleaning homes in Fort Collins for 5 years.',
      },
    }}),

    // Carol: Pet Sitting (for matching demo)
    prisma.item.create({ data: {
      ownerId: carol.id,
      category: 'services',
      listingType: 'service',
      categoryTier1: 'Personal Services',
      categoryTier2: 'Pet Care',
      categoryTier3: 'Pet Sitting',
      title: 'Pet Sitting',
      description: 'Experienced pet sitter. Fenced yard for dogs. Daily updates with photos!',
      condition: 'excellent',
      replacementValue: 0,
      pricingType: 'daily',
      priceAmount: 35,
      protectionPreference: 'waiver_ok',
      photoUrls: ['https://images.unsplash.com/photo-1715517642914-837e3c95dfd7?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w4NzU2ODR8MHwxfHNlYXJjaHwxfHxwZXQlMjBzaXR0aW5nJTIwZG9nJTIwZ29sZGVuJTIwcmV0cmlldmVyJTIwaGFwcHl8ZW58MHwyfHx8MTc3MTI2MDcwNnww&ixlib=rb-4.1.0&q=80&w=1080'],
      details: {
        specs: {
          petTypes: { value: ['Dogs', 'Cats'] },
          hasYard: { value: true },
        },
        specVersion: 1,
        additionalNotes: 'I have 2 cats and a dog of my own. Your pets will feel right at home!',
      },
    }}),

    // Emma: Photography Service
    prisma.item.create({ data: {
      ownerId: emma.id,
      category: 'services',
      listingType: 'service',
      categoryTier1: 'Creative & Media',
      categoryTier2: 'Photography',
      categoryTier3: 'Portrait Photography',
      title: 'Portrait Photography',
      description: 'Natural light portrait photography. Indoor and outdoor locations around Fort Collins.',
      condition: 'excellent',
      replacementValue: 0,
      pricingType: 'hourly',
      priceAmount: 75,
      protectionPreference: 'waiver_ok',
      photoUrls: ['https://images.unsplash.com/photo-1768700519416-60d5e8931b74?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w4NzU2ODR8MHwxfHNlYXJjaHwxfHxwb3J0cmFpdCUyMHBob3RvZ3JhcGh5JTIwbmF0dXJhbCUyMGxpZ2h0JTIwb3V0ZG9vcnxlbnwwfDJ8fHwxNzcxMjYwNzA4fDA&ixlib=rb-4.1.0&q=80&w=1080'],
      details: {
        specs: {
          style: { value: ['Candid', 'Posed/Formal'] },
          providesEquipment: { value: true },
          includesEditing: { value: true },
          deliveryFormat: { value: ['Digital Download', 'Online Gallery'] },
        },
        specVersion: 1,
      },
    }}),

    // Alice: Furniture Assembly (NON-MATCH for handyman requiring licensed - not licensed)
    prisma.item.create({ data: {
      ownerId: alice.id,
      category: 'services',
      listingType: 'service',
      categoryTier1: 'Tech & Assembly',
      categoryTier2: 'Assembly',
      categoryTier3: 'Furniture Assembly',
      title: 'Furniture Assembly',
      description: 'I can assemble IKEA furniture, shelving, desks, etc. I bring my own tools.',
      condition: 'excellent',
      replacementValue: 0,
      pricingType: 'hourly',
      priceAmount: 25,
      protectionPreference: 'waiver_ok',
      photoUrls: ['https://images.unsplash.com/photo-1706048111522-e4865f909940?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w4NzU2ODR8MHwxfHNlYXJjaHwxfHx3b29kd29ya2luZyUyMGFzc2VtYmx5JTIwZnVybml0dXJlfGVufDB8Mnx8fDE3NzEyNjA3OTl8MA&ixlib=rb-4.1.0&q=80&w=1080'],
      details: {
        specs: {
          providesOwnTools: { value: true },
          yearsExperience: { value: 3 },
        },
        specVersion: 1,
      },
    }}),
  ]);

  console.log(`Created ${items.length} items/services\n`);

  // ================================================================
  // REQUESTS - Week of Feb 9-15, 2026
  // ================================================================
  const feb9 = new Date('2026-02-09T08:00:00Z');
  const feb10 = new Date('2026-02-10T08:00:00Z');
  const feb11 = new Date('2026-02-11T08:00:00Z');
  const feb12 = new Date('2026-02-12T08:00:00Z');
  const feb13 = new Date('2026-02-13T08:00:00Z');
  const feb14 = new Date('2026-02-14T08:00:00Z');
  const feb15 = new Date('2026-02-15T18:00:00Z');
  const expiresAt = new Date('2026-02-20T00:00:00Z');

  const requests = await Promise.all([

    // REQUEST 1: Jake wants Alpine Skis ~170cm, All-Mountain REQUIRED, bindings REQUIRED
    // HARD MATCH: Grace's Rossignol 170cm All-Mountain w/ bindings
    // SOFT MATCH: Bob's K2 180cm Powder w/ bindings (size in range, wrong type → not excluded if not required but lower score)
    prisma.request.create({ data: {
      requesterId: jake.id,
      category: 'outdoor_recreation',
      listingType: 'item',
      categoryTier1: 'Outdoor & Recreation',
      categoryTier2: 'Winter Sports',
      categoryTier3: 'Alpine Skis',
      title: 'Alpine Skis',
      description: 'Looking for all-mountain skis around 170cm for a weekend at Eldora. Intermediate skier.',
      neededFrom: feb9,
      neededUntil: feb11,
      maxBudget: 40,
      maxDistanceMiles: 15,
      latitude: jake.latitude,
      longitude: jake.longitude,
      expiresAt,
      details: {
        specs: {
          sizeCm: { value: 170, flexibility: 10, requiredMatch: false },
          skiType: { value: 'All-Mountain', requiredMatch: true },
          bindingIncluded: { value: true, requiredMatch: true },
          skillLevel: { value: 'Intermediate', requiredMatch: false },
        },
        specVersion: 1,
      },
    }}),

    // REQUEST 2: Jake wants Ski Boots ~275mm, Intermediate
    // HARD MATCH: Grace's boots 270mm (within ±10 flexibility)
    // NON-MATCH: David's boots 295mm (too far outside range, required match fails)
    prisma.request.create({ data: {
      requesterId: jake.id,
      category: 'outdoor_recreation',
      listingType: 'item',
      categoryTier1: 'Outdoor & Recreation',
      categoryTier2: 'Winter Sports',
      categoryTier3: 'Ski Boots (Alpine)',
      title: 'Ski Boots (Alpine)',
      description: 'Need ski boots around size 275mm (US 9.5). Intermediate flex preferred.',
      neededFrom: feb9,
      neededUntil: feb11,
      maxBudget: 30,
      maxDistanceMiles: 15,
      latitude: jake.latitude,
      longitude: jake.longitude,
      expiresAt,
      details: {
        specs: {
          bootSize: { value: 275, flexibility: 10, requiredMatch: true },
          skillLevel: { value: 'Intermediate', requiredMatch: false },
          flex: { value: 85, flexibility: 20, requiredMatch: false },
        },
        specVersion: 1,
      },
    }}),

    // REQUEST 3: Bob wants Snowboard ~155cm, All-Mountain REQUIRED, bindings REQUIRED
    // HARD MATCH: Frank's Burton 155cm All-Mountain w/ bindings
    // NON-MATCH: Leo's Ride 158cm Freestyle NO bindings (bindings required → excluded)
    prisma.request.create({ data: {
      requesterId: bob.id,
      category: 'outdoor_recreation',
      listingType: 'item',
      categoryTier1: 'Outdoor & Recreation',
      categoryTier2: 'Winter Sports',
      categoryTier3: 'Snowboard',
      title: 'Snowboard',
      description: 'Need an all-mountain snowboard around 155cm for a weekend at Copper. Bindings required.',
      neededFrom: feb12,
      neededUntil: feb14,
      maxBudget: 40,
      maxDistanceMiles: 15,
      latitude: bob.latitude,
      longitude: bob.longitude,
      expiresAt,
      details: {
        specs: {
          sizeCm: { value: 155, flexibility: 5, requiredMatch: false },
          boardType: { value: 'All-Mountain', requiredMatch: true },
          bindingsIncluded: { value: true, requiredMatch: true },
        },
        specVersion: 1,
      },
    }}),

    // REQUEST 4: Kate wants Handyman - licensed REQUIRED, provides tools REQUIRED
    // HARD MATCH: Hank's handyman (licensed, provides tools)
    prisma.request.create({ data: {
      requesterId: kate.id,
      category: 'services',
      listingType: 'service',
      categoryTier1: 'Home & Repair',
      categoryTier2: 'General Handyman',
      categoryTier3: 'General Repair',
      title: 'General Repair',
      description: 'Need a licensed handyman to fix some drywall and a leaky faucet.',
      neededFrom: feb10,
      neededUntil: feb10,
      maxBudget: 50,
      maxDistanceMiles: 15,
      latitude: kate.latitude,
      longitude: kate.longitude,
      expiresAt,
      details: {
        specs: {
          licensed: { value: true, requiredMatch: true },
          providesOwnTools: { value: true, requiredMatch: true },
          yearsExperience: { value: 5, flexibility: 10, requiredMatch: false },
        },
        specVersion: 1,
      },
    }}),

    // REQUEST 5: Kate wants Moving Help - has truck REQUIRED, 2+ helpers
    // HARD MATCH: Hank's moving service (has truck, 2 helpers)
    prisma.request.create({ data: {
      requesterId: kate.id,
      category: 'services',
      listingType: 'service',
      categoryTier1: 'Moving & Hauling',
      categoryTier2: 'Moving Help',
      categoryTier3: 'Local Move',
      title: 'Local Move',
      description: 'Moving from apartment to house. Need help with furniture and boxes. Need a truck!',
      neededFrom: feb14,
      neededUntil: feb14,
      maxBudget: 70,
      maxDistanceMiles: 15,
      latitude: kate.latitude,
      longitude: kate.longitude,
      expiresAt,
      details: {
        specs: {
          hasTruck: { value: true, requiredMatch: true },
          numHelpers: { value: 2, requiredMatch: false },
          hasEquipment: { value: true, requiredMatch: false },
        },
        specVersion: 1,
      },
    }}),

    // REQUEST 6: Carol wants Bounce House - Kids 3-10 REQUIRED, blower REQUIRED
    // HARD MATCH: Irene's bounce house (Kids 3-10, blower included)
    prisma.request.create({ data: {
      requesterId: carol.id,
      category: 'party_events',
      listingType: 'item',
      categoryTier1: 'Party & Events',
      categoryTier2: 'Entertainment',
      categoryTier3: 'Bounce House',
      title: 'Bounce House',
      description: 'Need a bounce house for my daughter\'s birthday party! Ages 4-8.',
      neededFrom: feb15,
      neededUntil: feb15,
      maxBudget: 75,
      maxDistanceMiles: 15,
      latitude: carol.latitude,
      longitude: carol.longitude,
      expiresAt,
      details: {
        specs: {
          ageRange: { value: 'Kids (3-10)', requiredMatch: true },
          includesBlower: { value: true, requiredMatch: true },
          includesDelivery: { value: true, requiredMatch: false },
        },
        specVersion: 1,
      },
    }}),

    // REQUEST 7: Frank wants Pickup Truck - 4WD REQUIRED, tow capacity 8000+ REQUIRED
    // HARD MATCH: Leo's F-250 (4WD, 12000 lbs tow)
    // NON-MATCH: David's Tacoma (no 4WD → excluded, tow only 3500 → excluded)
    prisma.request.create({ data: {
      requesterId: frank.id,
      category: 'vehicles_transport',
      listingType: 'item',
      categoryTier1: 'Vehicles & Transport',
      categoryTier2: 'Trucks & Trailers',
      categoryTier3: 'Pickup Truck',
      title: 'Pickup Truck',
      description: 'Need a 4WD truck to haul a load of firewood from the mountains. Must have good towing capacity.',
      neededFrom: feb11,
      neededUntil: feb12,
      maxBudget: 120,
      maxDistanceMiles: 15,
      latitude: frank.latitude,
      longitude: frank.longitude,
      expiresAt,
      details: {
        specs: {
          fourWD: { value: true, requiredMatch: true },
          towCapacity: { value: 8000, flexibility: 4000, requiredMatch: true },
        },
        specVersion: 1,
      },
    }}),

    // REQUEST 8: Emma wants Pressure Washer 2000 PSI, nozzles REQUIRED
    // HARD MATCH: Alice's Sun Joe 2030 PSI w/ nozzles
    prisma.request.create({ data: {
      requesterId: emma.id,
      category: 'specialized_equipment',
      listingType: 'item',
      categoryTier1: 'Specialized Equipment',
      categoryTier2: 'Home Improvement',
      categoryTier3: 'Pressure Washer (Electric)',
      title: 'Pressure Washer (Electric)',
      description: 'Need to pressure wash my deck and driveway. Looking for around 2000 PSI.',
      neededFrom: feb13,
      neededUntil: feb14,
      maxBudget: 35,
      maxDistanceMiles: 10,
      latitude: emma.latitude,
      longitude: emma.longitude,
      expiresAt,
      details: {
        specs: {
          psi: { value: 2000, flexibility: 300, requiredMatch: false },
          includesNozzles: { value: true, requiredMatch: true },
        },
        specVersion: 1,
      },
    }}),

    // REQUEST 9: David wants House Cleaning - provides supplies REQUIRED, Large home REQUIRED
    // HARD MATCH: Irene's cleaning service (provides supplies, large homes)
    prisma.request.create({ data: {
      requesterId: david.id,
      category: 'services',
      listingType: 'service',
      categoryTier1: 'Cleaning',
      categoryTier2: 'House Cleaning',
      categoryTier3: 'Standard Cleaning',
      title: 'Standard Cleaning',
      description: 'Need a deep clean before guests arrive. 2800 sq ft house.',
      neededFrom: feb13,
      neededUntil: feb13,
      maxBudget: 45,
      maxDistanceMiles: 15,
      latitude: david.latitude,
      longitude: david.longitude,
      expiresAt,
      details: {
        specs: {
          providesSupplies: { value: true, requiredMatch: true },
          maxSqFt: { value: 'Large (2000-3500 sq ft)', requiredMatch: true },
          ecoFriendly: { value: true, requiredMatch: false },
        },
        specVersion: 1,
      },
    }}),

    // REQUEST 10: Alice wants Snow Removal - provides equipment REQUIRED
    // HARD MATCH: Leo's snow removal (provides equipment, includes salt)
    prisma.request.create({ data: {
      requesterId: alice.id,
      category: 'services',
      listingType: 'service',
      categoryTier1: 'Yard & Outdoor',
      categoryTier2: 'Snow Removal',
      categoryTier3: 'Driveway & Sidewalk',
      title: 'Driveway & Sidewalk',
      description: 'Big storm coming. Need someone to clear driveway and front walkway.',
      neededFrom: feb10,
      neededUntil: feb10,
      maxBudget: 50,
      maxDistanceMiles: 10,
      latitude: alice.latitude,
      longitude: alice.longitude,
      expiresAt,
      details: {
        specs: {
          providesEquipment: { value: true, requiredMatch: true },
          includesSalt: { value: true, requiredMatch: false },
        },
        specVersion: 1,
      },
    }}),

    // REQUEST 11: Bob wants Circular Saw - 7-1/4" REQUIRED, cordless preferred
    // HARD MATCH: Alice's DeWalt circular saw (7-1/4", cordless)
    prisma.request.create({ data: {
      requesterId: bob.id,
      category: 'tools',
      listingType: 'item',
      categoryTier1: 'Tools',
      categoryTier2: 'Power Tools',
      categoryTier3: 'Circular Saw',
      title: 'Circular Saw',
      description: 'Need a circular saw for cutting plywood this weekend. 7-1/4" blade preferred.',
      neededFrom: feb9,
      neededUntil: feb10,
      maxBudget: 25,
      maxDistanceMiles: 10,
      latitude: bob.latitude,
      longitude: bob.longitude,
      expiresAt,
      details: {
        specs: {
          bladeSize: { value: '7-1/4"', requiredMatch: true },
          powerSource: { value: 'Cordless (Battery)', requiredMatch: false },
          includesBattery: { value: true, requiredMatch: false },
        },
        specVersion: 1,
      },
    }}),

    // REQUEST 12: Emma wants DSLR Camera - Canon EF REQUIRED, lens REQUIRED
    // HARD MATCH: Grace's Canon 5D Mark IV (Canon EF, includes lens)
    prisma.request.create({ data: {
      requesterId: emma.id,
      category: 'specialized_equipment',
      listingType: 'item',
      categoryTier1: 'Specialized Equipment',
      categoryTier2: 'Photography & Video',
      categoryTier3: 'DSLR Camera',
      title: 'DSLR Camera',
      description: 'Need a Canon DSLR with lens for a family portrait session. Full frame preferred.',
      neededFrom: feb14,
      neededUntil: feb15,
      maxBudget: 100,
      maxDistanceMiles: 15,
      latitude: emma.latitude,
      longitude: emma.longitude,
      expiresAt,
      details: {
        specs: {
          lensMount: { value: 'Canon EF', requiredMatch: true },
          includesLens: { value: true, requiredMatch: true },
          sensorType: { value: 'Full Frame', requiredMatch: false },
        },
        specVersion: 1,
      },
    }}),

    // REQUEST 13: Kate wants Snowshoes - 120-200 lbs range, poles included preferred
    // HARD MATCH: Grace's MSR snowshoes (120-200 lbs, includes poles)
    prisma.request.create({ data: {
      requesterId: kate.id,
      category: 'outdoor_recreation',
      listingType: 'item',
      categoryTier1: 'Outdoor & Recreation',
      categoryTier2: 'Winter Sports',
      categoryTier3: 'Snowshoes',
      title: 'Snowshoes',
      description: 'Want to try snowshoeing at Cameron Pass this weekend! I weigh about 160 lbs.',
      neededFrom: feb14,
      neededUntil: feb15,
      maxBudget: 25,
      maxDistanceMiles: 15,
      latitude: kate.latitude,
      longitude: kate.longitude,
      expiresAt,
      details: {
        specs: {
          weightRange: { value: '120-200 lbs', requiredMatch: true },
          includesPoles: { value: true, requiredMatch: false },
        },
        specVersion: 1,
      },
    }}),

    // REQUEST 14: Frank wants 4-Person Tent - 3-Season REQUIRED
    // HARD MATCH: Bob's REI tent (3-Season, 4-person)
    prisma.request.create({ data: {
      requesterId: frank.id,
      category: 'outdoor_recreation',
      listingType: 'item',
      categoryTier1: 'Outdoor & Recreation',
      categoryTier2: 'Camping',
      categoryTier3: 'Tent (4-Person)',
      title: 'Tent (4-Person)',
      description: 'Need a tent for a family camping trip to State Forest State Park.',
      neededFrom: feb13,
      neededUntil: feb15,
      maxBudget: 30,
      maxDistanceMiles: 20,
      latitude: frank.latitude,
      longitude: frank.longitude,
      expiresAt,
      details: {
        specs: {
          seasonRating: { value: '3-Season', requiredMatch: true },
          capacity: { value: 4, requiredMatch: false },
        },
        specVersion: 1,
      },
    }}),

    // REQUEST 15: Irene wants Generator - inverter REQUIRED, 2000W+ REQUIRED
    // HARD MATCH: Leo's Honda EU2200i (inverter, 2200W)
    prisma.request.create({ data: {
      requesterId: irene.id,
      category: 'other',
      listingType: 'item',
      categoryTier1: 'Emergency & Cleanup',
      categoryTier2: 'Emergency',
      categoryTier3: 'Generator (Portable)',
      title: 'Generator (Portable)',
      description: 'Need a quiet inverter generator for an outdoor event. Must be safe for electronics.',
      neededFrom: feb15,
      neededUntil: feb15,
      maxBudget: 60,
      maxDistanceMiles: 10,
      latitude: irene.latitude,
      longitude: irene.longitude,
      expiresAt,
      details: {
        specs: {
          inverter: { value: true, requiredMatch: true },
          watts: { value: 2000, flexibility: 500, requiredMatch: true },
        },
        specVersion: 1,
      },
    }}),

    // REQUEST 16: Grace wants Pet Sitting - Dogs REQUIRED, fenced yard preferred
    // HARD MATCH: Carol's pet sitting (Dogs, fenced yard)
    prisma.request.create({ data: {
      requesterId: grace.id,
      category: 'services',
      listingType: 'service',
      categoryTier1: 'Personal Services',
      categoryTier2: 'Pet Care',
      categoryTier3: 'Pet Sitting',
      title: 'Pet Sitting',
      description: 'Need someone to watch my golden retriever while I go skiing next weekend.',
      neededFrom: feb14,
      neededUntil: feb15,
      maxBudget: 45,
      maxDistanceMiles: 10,
      latitude: grace.latitude,
      longitude: grace.longitude,
      expiresAt,
      details: {
        specs: {
          petTypes: { value: ['Dogs'], requiredMatch: true },
          hasYard: { value: true, requiredMatch: false },
        },
        specVersion: 1,
      },
    }}),
  ]);

  console.log(`Created ${requests.length} requests\n`);

  // ================================================================
  // GENERATE MATCHES
  // ================================================================
  const { findMatchesForRequest } = require('../src/utils/matching');

  console.log('Generating matches...\n');
  console.log('═'.repeat(70));

  for (const request of requests) {
    try {
      const matches = await findMatchesForRequest(request.id);
      const requester = users.find(u => u.id === request.requesterId);
      const requesterName = `${requester.firstName} ${requester.lastName}`;
      console.log(`\n"${request.title}" by ${requesterName}`);
      console.log(`  Category: ${request.categoryTier1} > ${request.categoryTier2} > ${request.categoryTier3}`);
      if (matches.length === 0) {
        console.log('  → No matches found');
      } else {
        for (const match of matches) {
          const ownerName = `${match.item.owner.firstName} ${match.item.owner.lastName}`;
          console.log(`  → Score ${match.matchScore}: "${match.item.title}" by ${ownerName} (${match.distanceMiles} mi)`);
        }
      }
    } catch (err) {
      console.log(`  → Error matching: ${err.message}`);
    }
  }

  console.log('\n' + '═'.repeat(70));

  // ================================================================
  // SAMPLE COMPLETED TRANSACTION (for ratings demo)
  // ================================================================
  const sampleTransaction = await prisma.transaction.create({
    data: {
      itemId: items[0].id, // Grace's Alpine Skis
      borrowerId: jake.id,
      lenderId: grace.id,
      status: 'completed',
      pickupTime: new Date('2026-01-25T10:00:00Z'),
      returnTime: new Date('2026-01-27T16:00:00Z'),
      actualPickupTime: new Date('2026-01-25T10:15:00Z'),
      actualReturnTime: new Date('2026-01-27T15:45:00Z'),
      rentalFee: 60,
      platformFee: 3.80,
      protectionType: 'deposit',
      depositAmount: 180,
      totalCharged: 63.80,
      paymentStatus: 'captured',
    },
  });

  await prisma.rating.createMany({
    data: [
      {
        transactionId: sampleTransaction.id,
        raterId: jake.id,
        ratedUserId: grace.id,
        role: 'lender',
        overallRating: 5,
        onTimeRating: 5,
        communicationRating: 5,
        itemAsDescribedRating: 5,
        reviewText: 'Grace was awesome! Skis were in perfect condition and exactly as described.',
        wouldTransactAgain: true,
      },
      {
        transactionId: sampleTransaction.id,
        raterId: grace.id,
        ratedUserId: jake.id,
        role: 'borrower',
        overallRating: 5,
        onTimeRating: 5,
        communicationRating: 5,
        conditionRating: 5,
        reviewText: 'Jake returned everything on time and in great shape. Great borrower!',
        wouldTransactAgain: true,
      },
    ],
  });

  console.log('\nCreated sample completed transaction with ratings');

  console.log('\n✅ Demo seed completed successfully!');
  console.log('\nTest accounts (all passwords: password123):');
  users.forEach((user) => {
    console.log(`  - ${user.email} (${user.firstName} ${user.lastName}, ${user.neighborhood})`);
  });

  console.log('\n📊 Match Summary:');
  console.log('  HARD matches: Items where all required specs align perfectly');
  console.log('  SOFT matches: Items where specs partially match (size in range but wrong type, etc.)');
  console.log('  NON-matches:  Items excluded because a required spec failed (wrong boot size, no 4WD, etc.)');
}

main()
  .catch((e) => {
    console.error('Seeding failed:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
