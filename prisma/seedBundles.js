const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

const templates = [
  {
    title: 'Camping Essentials',
    templateSlug: 'camping-essentials',
    description: 'Everything you need for a weekend camping trip. Just add food and friends!',
    keywords: ['camping', 'outdoors', 'hiking', 'tent', 'nature', 'weekend'],
    suggestedCategories: ['outdoor_recreation'],
    items: [
      { slotLabel: 'Tent', slotTier1: 'Outdoor & Recreation', slotTier2: 'Camping', slotTier3: 'Tent', slotKeywords: ['tent', '2-person', '4-person', 'camping tent'], isRequired: true, quantity: 1 },
      { slotLabel: 'Sleeping Bag', slotTier1: 'Outdoor & Recreation', slotTier2: 'Camping', slotTier3: 'Sleeping Bag', slotKeywords: ['sleeping bag', 'mummy bag', 'cold weather'], isRequired: true, quantity: 1 },
      { slotLabel: 'Camp Stove', slotTier1: 'Outdoor & Recreation', slotTier2: 'Camping', slotTier3: 'Camp Stove', slotKeywords: ['camp stove', 'propane stove', 'portable stove', 'cooking'], isRequired: false, quantity: 1 },
      { slotLabel: 'Cooler', slotTier1: 'Outdoor & Recreation', slotTier2: 'Camping', slotTier3: 'Cooler', slotKeywords: ['cooler', 'ice chest', 'insulated'], isRequired: false, quantity: 1 },
      { slotLabel: 'Camp Chairs', slotTier1: 'Outdoor & Recreation', slotTier2: 'Camping', slotTier3: 'Camp Chair', slotKeywords: ['camp chair', 'folding chair', 'portable chair'], isRequired: false, quantity: 2 },
      { slotLabel: 'Lantern', slotTier1: 'Outdoor & Recreation', slotTier2: 'Camping', slotTier3: 'Lantern', slotKeywords: ['lantern', 'camp light', 'LED lantern', 'headlamp'], isRequired: false, quantity: 1 },
    ],
  },
  {
    title: 'Birthday Party Kit',
    templateSlug: 'birthday-party-kit',
    description: 'Host an amazing outdoor birthday party without buying everything. Tables, seating, music, and ambiance covered.',
    keywords: ['party', 'birthday', 'celebration', 'outdoor party', 'event'],
    suggestedCategories: ['party_events'],
    items: [
      { slotLabel: 'Canopy / Pop-Up Tent', slotTier1: 'Party & Events', slotTier2: 'Shelter', slotTier3: 'Canopy', slotKeywords: ['canopy', 'pop-up tent', 'shade tent', 'party tent'], isRequired: true, quantity: 1 },
      { slotLabel: 'Folding Tables', slotTier1: 'Party & Events', slotTier2: 'Furniture', slotTier3: 'Table', slotKeywords: ['folding table', 'banquet table', 'party table'], isRequired: true, quantity: 2 },
      { slotLabel: 'Folding Chairs', slotTier1: 'Party & Events', slotTier2: 'Furniture', slotTier3: 'Chair', slotKeywords: ['folding chair', 'party chair', 'seating'], isRequired: true, quantity: 8 },
      { slotLabel: 'Bluetooth Speaker', slotTier1: 'Party & Events', slotTier2: 'Audio', slotTier3: 'Speaker', slotKeywords: ['bluetooth speaker', 'portable speaker', 'party speaker', 'music'], isRequired: false, quantity: 1 },
      { slotLabel: 'Cooler', slotTier1: 'Outdoor & Recreation', slotTier2: 'Camping', slotTier3: 'Cooler', slotKeywords: ['cooler', 'ice chest', 'beverage cooler'], isRequired: false, quantity: 1 },
      { slotLabel: 'String Lights', slotTier1: 'Party & Events', slotTier2: 'Decor', slotTier3: 'Lighting', slotKeywords: ['string lights', 'fairy lights', 'patio lights', 'party lights'], isRequired: false, quantity: 1 },
    ],
  },
  {
    title: 'Moving Day Kit',
    templateSlug: 'moving-day-kit',
    description: 'All the gear you need for a smooth move day. Save hundreds vs. renting from a big-box store.',
    keywords: ['moving', 'move', 'relocation', 'hauling', 'furniture'],
    suggestedCategories: ['tools', 'vehicles_transport'],
    items: [
      { slotLabel: 'Furniture Dolly', slotTier1: 'Tools', slotTier2: 'Moving', slotTier3: 'Dolly', slotKeywords: ['dolly', 'hand truck', 'furniture dolly', 'appliance dolly'], isRequired: true, quantity: 1 },
      { slotLabel: 'Moving Blankets', slotTier1: 'Tools', slotTier2: 'Moving', slotTier3: 'Moving Blanket', slotKeywords: ['moving blanket', 'furniture pad', 'protection blanket'], isRequired: true, quantity: 4 },
      { slotLabel: 'Ratchet Straps', slotTier1: 'Tools', slotTier2: 'Moving', slotTier3: 'Straps', slotKeywords: ['ratchet strap', 'tie down', 'cargo strap'], isRequired: true, quantity: 4 },
      { slotLabel: 'Pickup Truck', slotTier1: 'Vehicles & Transport', slotTier2: 'Trucks', slotTier3: 'Pickup Truck', slotKeywords: ['pickup truck', 'truck', 'hauling', 'cargo'], isRequired: false, quantity: 1 },
    ],
  },
  {
    title: 'Backyard Movie Night',
    templateSlug: 'backyard-movie-night',
    description: 'Transform your backyard into an outdoor cinema. Perfect for family nights or neighborhood gatherings.',
    keywords: ['movie', 'projector', 'outdoor movie', 'backyard', 'cinema', 'entertainment'],
    suggestedCategories: ['party_events'],
    items: [
      { slotLabel: 'Projector', slotTier1: 'Party & Events', slotTier2: 'AV Equipment', slotTier3: 'Projector', slotKeywords: ['projector', 'movie projector', 'HD projector', 'portable projector'], isRequired: true, quantity: 1 },
      { slotLabel: 'Projection Screen', slotTier1: 'Party & Events', slotTier2: 'AV Equipment', slotTier3: 'Screen', slotKeywords: ['projection screen', 'movie screen', 'portable screen', 'inflatable screen'], isRequired: true, quantity: 1 },
      { slotLabel: 'Outdoor Speakers', slotTier1: 'Party & Events', slotTier2: 'Audio', slotTier3: 'Speaker', slotKeywords: ['speaker', 'bluetooth speaker', 'outdoor speaker', 'sound system'], isRequired: true, quantity: 1 },
      { slotLabel: 'Extension Cord', slotTier1: 'Tools', slotTier2: 'Electrical', slotTier3: 'Extension Cord', slotKeywords: ['extension cord', 'outdoor extension cord', 'power cord'], isRequired: false, quantity: 1 },
      { slotLabel: 'Outdoor Seating', slotTier1: 'Party & Events', slotTier2: 'Furniture', slotTier3: 'Seating', slotKeywords: ['lawn chairs', 'blankets', 'bean bags', 'outdoor seating'], isRequired: false, quantity: 4 },
    ],
  },
  {
    title: 'Home Renovation Starter',
    templateSlug: 'home-renovation-starter',
    description: 'Core power tools and equipment for DIY home renovation projects. Try before you buy!',
    keywords: ['renovation', 'DIY', 'tools', 'home improvement', 'construction', 'remodel'],
    suggestedCategories: ['tools'],
    items: [
      { slotLabel: 'Cordless Drill', slotTier1: 'Tools', slotTier2: 'Power Tools', slotTier3: 'Drill', slotKeywords: ['drill', 'cordless drill', 'impact driver', 'drill set'], isRequired: true, quantity: 1 },
      { slotLabel: 'Circular Saw', slotTier1: 'Tools', slotTier2: 'Power Tools', slotTier3: 'Circular Saw', slotKeywords: ['circular saw', 'skill saw', 'power saw'], isRequired: true, quantity: 1 },
      { slotLabel: 'Orbital Sander', slotTier1: 'Tools', slotTier2: 'Power Tools', slotTier3: 'Sander', slotKeywords: ['sander', 'orbital sander', 'palm sander', 'power sander'], isRequired: false, quantity: 1 },
      { slotLabel: 'Level', slotTier1: 'Tools', slotTier2: 'Measuring', slotTier3: 'Level', slotKeywords: ['level', 'laser level', 'spirit level', 'bubble level'], isRequired: true, quantity: 1 },
      { slotLabel: 'Extension Ladder', slotTier1: 'Tools', slotTier2: 'Ladders', slotTier3: 'Ladder', slotKeywords: ['ladder', 'extension ladder', 'step ladder', 'A-frame ladder'], isRequired: false, quantity: 1 },
      { slotLabel: 'Sawhorses', slotTier1: 'Tools', slotTier2: 'Workshop', slotTier3: 'Sawhorse', slotKeywords: ['sawhorse', 'sawhorses', 'work table', 'workbench'], isRequired: false, quantity: 2 },
    ],
  },
];

async function seedBundles() {
  console.log('Seeding bundle templates...');

  for (const tmpl of templates) {
    const existing = await prisma.bundle.findUnique({
      where: { templateSlug: tmpl.templateSlug },
    });

    if (existing) {
      console.log(`  Skipping "${tmpl.title}" (already exists)`);
      continue;
    }

    await prisma.bundle.create({
      data: {
        type: 'template',
        status: 'active',
        title: tmpl.title,
        description: tmpl.description,
        templateSlug: tmpl.templateSlug,
        suggestedCategories: tmpl.suggestedCategories,
        keywords: tmpl.keywords,
        creatorId: null,
        bundleItems: {
          create: tmpl.items.map((item, index) => ({
            sortOrder: index,
            isRequired: item.isRequired,
            quantity: item.quantity,
            slotLabel: item.slotLabel,
            slotTier1: item.slotTier1,
            slotTier2: item.slotTier2,
            slotTier3: item.slotTier3,
            slotKeywords: item.slotKeywords,
            itemId: null,
          })),
        },
      },
    });

    console.log(`  Created "${tmpl.title}" with ${tmpl.items.length} slots`);
  }

  console.log('Bundle template seeding complete!');
}

// Allow both direct execution and import
if (require.main === module) {
  seedBundles()
    .catch(console.error)
    .finally(() => prisma.$disconnect());
}

module.exports = { seedBundles };
