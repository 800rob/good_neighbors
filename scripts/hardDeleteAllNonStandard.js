const prisma = require('../src/config/database');

async function hardDeleteAll() {
  console.log('=== HARD DELETE: All non-standard items, transactions, and requests ===\n');

  // 1. Find all items with non-standard naming
  const allItems = await prisma.item.findMany({
    select: {
      id: true,
      title: true,
      categoryTier3: true,
      isOther: true,
      customItemName: true,
      owner: { select: { email: true } }
    }
  });

  const nonStandardItems = allItems.filter(item => {
    const expectedTitle = item.isOther ? item.customItemName : item.categoryTier3;
    return item.title !== expectedTitle;
  });

  console.log(`Found ${nonStandardItems.length} non-standard items to delete:\n`);
  nonStandardItems.forEach(i => {
    console.log(`  - "${i.title}" (${i.owner.email})`);
  });

  // 2. Delete transactions for non-standard items first (foreign key constraint)
  const itemIds = nonStandardItems.map(i => i.id);

  if (itemIds.length > 0) {
    // Delete related matches first
    const matchesDeleted = await prisma.match.deleteMany({
      where: { itemId: { in: itemIds } }
    });
    console.log(`\nDeleted ${matchesDeleted.count} matches`);

    // Delete related messages (via transactions)
    const transactionsToDelete = await prisma.transaction.findMany({
      where: { itemId: { in: itemIds } },
      select: { id: true }
    });
    const transactionIds = transactionsToDelete.map(t => t.id);

    if (transactionIds.length > 0) {
      const messagesDeleted = await prisma.message.deleteMany({
        where: { transactionId: { in: transactionIds } }
      });
      console.log(`Deleted ${messagesDeleted.count} messages`);

      const ratingsDeleted = await prisma.rating.deleteMany({
        where: { transactionId: { in: transactionIds } }
      });
      console.log(`Deleted ${ratingsDeleted.count} ratings`);
    }

    // Delete transactions
    const transactionsDeleted = await prisma.transaction.deleteMany({
      where: { itemId: { in: itemIds } }
    });
    console.log(`Deleted ${transactionsDeleted.count} transactions`);

    // Delete the items
    const itemsDeleted = await prisma.item.deleteMany({
      where: { id: { in: itemIds } }
    });
    console.log(`Deleted ${itemsDeleted.count} items`);
  }

  // 3. Find and delete non-standard requests
  const allRequests = await prisma.request.findMany({
    select: {
      id: true,
      title: true,
      categoryTier3: true,
      isOther: true,
      customNeed: true,
      requester: { select: { email: true } }
    }
  });

  const nonStandardRequests = allRequests.filter(req => {
    const expectedTitle = req.isOther ? req.customNeed : req.categoryTier3;
    return req.title !== expectedTitle;
  });

  console.log(`\nFound ${nonStandardRequests.length} non-standard requests to delete:\n`);
  nonStandardRequests.forEach(r => {
    console.log(`  - "${r.title}" (${r.requester.email})`);
  });

  if (nonStandardRequests.length > 0) {
    const requestIds = nonStandardRequests.map(r => r.id);

    // Delete related matches
    const matchesDeleted = await prisma.match.deleteMany({
      where: { requestId: { in: requestIds } }
    });
    console.log(`\nDeleted ${matchesDeleted.count} request matches`);

    // Delete related transactions
    const transactionsDeleted = await prisma.transaction.deleteMany({
      where: { requestId: { in: requestIds } }
    });
    console.log(`Deleted ${transactionsDeleted.count} request transactions`);

    // Delete the requests
    const requestsDeleted = await prisma.request.deleteMany({
      where: { id: { in: requestIds } }
    });
    console.log(`Deleted ${requestsDeleted.count} requests`);
  }

  // 4. Also delete any "test" items that might be edge cases
  const testItems = await prisma.item.findMany({
    where: {
      OR: [
        { title: { contains: 'test', mode: 'insensitive' } },
      ]
    },
    select: { id: true, title: true }
  });

  if (testItems.length > 0) {
    console.log(`\nFound ${testItems.length} test items to delete:`);
    testItems.forEach(i => console.log(`  - "${i.title}"`));

    const testItemIds = testItems.map(i => i.id);

    // Delete related data
    await prisma.match.deleteMany({ where: { itemId: { in: testItemIds } } });

    const testTxns = await prisma.transaction.findMany({
      where: { itemId: { in: testItemIds } },
      select: { id: true }
    });
    const testTxnIds = testTxns.map(t => t.id);

    if (testTxnIds.length > 0) {
      await prisma.message.deleteMany({ where: { transactionId: { in: testTxnIds } } });
      await prisma.rating.deleteMany({ where: { transactionId: { in: testTxnIds } } });
    }

    await prisma.transaction.deleteMany({ where: { itemId: { in: testItemIds } } });
    await prisma.item.deleteMany({ where: { id: { in: testItemIds } } });
    console.log(`Deleted test items and related data`);
  }

  // 5. Delete any "test" requests
  const testRequests = await prisma.request.findMany({
    where: {
      title: { contains: 'test', mode: 'insensitive' }
    },
    select: { id: true, title: true }
  });

  if (testRequests.length > 0) {
    console.log(`\nFound ${testRequests.length} test requests to delete:`);
    testRequests.forEach(r => console.log(`  - "${r.title}"`));

    const testReqIds = testRequests.map(r => r.id);
    await prisma.match.deleteMany({ where: { requestId: { in: testReqIds } } });
    await prisma.transaction.deleteMany({ where: { requestId: { in: testReqIds } } });
    await prisma.request.deleteMany({ where: { id: { in: testReqIds } } });
    console.log(`Deleted test requests and related data`);
  }

  console.log('\n=== CLEANUP COMPLETE ===');

  // Show what's left
  const remainingItems = await prisma.item.count();
  const remainingRequests = await prisma.request.count();
  const remainingTransactions = await prisma.transaction.count();

  console.log(`\nRemaining data:`);
  console.log(`  Items: ${remainingItems}`);
  console.log(`  Requests: ${remainingRequests}`);
  console.log(`  Transactions: ${remainingTransactions}`);

  await prisma.$disconnect();
}

hardDeleteAll().catch(console.error);
