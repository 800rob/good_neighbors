const prisma = require('../config/database');
const { notifyUser } = require('./notificationService');

/**
 * Check for transactions that should auto-transition to 'active' status
 * Runs when pickup time has passed and status is still pickup_confirmed
 */
async function checkAutoActivateTransactions() {
  const now = new Date();

  const transactions = await prisma.transaction.findMany({
    where: {
      status: 'pickup_confirmed',
      pickupTime: {
        lte: now
      }
    },
    include: {
      item: true,
      borrower: {
        select: { id: true, firstName: true, lastName: true }
      },
      lender: {
        select: { id: true, firstName: true, lastName: true }
      }
    }
  });

  for (const transaction of transactions) {
    try {
      await prisma.transaction.update({
        where: { id: transaction.id },
        data: { status: 'active' }
      });

      const borrowerName = [transaction.borrower.firstName, transaction.borrower.lastName].filter(Boolean).join(' ');
      const lenderName = [transaction.lender.firstName, transaction.lender.lastName].filter(Boolean).join(' ');

      const notificationContext = {
        transactionId: transaction.id,
        itemId: transaction.item.id,
        itemTitle: transaction.item.title,
        borrowerId: transaction.borrowerId,
        borrowerName,
        lenderId: transaction.lenderId,
        lenderName,
      };

      // Notify both parties that the transaction is now active
      await notifyUser(transaction.borrowerId, 'transaction_active', notificationContext);
      await notifyUser(transaction.lenderId, 'transaction_active', notificationContext);

      console.log(`[Scheduler] Auto-activated transaction ${transaction.id}`);
    } catch (error) {
      console.error(`[Scheduler] Failed to auto-activate transaction ${transaction.id}:`, error);
    }
  }
}

/**
 * Send return reminders 24 hours before scheduled return time
 */
async function sendReturnReminders() {
  const now = new Date();
  const in24Hours = new Date(now.getTime() + 24 * 60 * 60 * 1000);
  const in23Hours = new Date(now.getTime() + 23 * 60 * 60 * 1000);

  // Find active transactions with return time between 23-24 hours from now
  // This ensures we only send the reminder once per hour check
  const transactions = await prisma.transaction.findMany({
    where: {
      status: 'active',
      returnTime: {
        gte: in23Hours,
        lte: in24Hours
      },
      returnReminderSent: false
    },
    include: {
      item: true,
      borrower: {
        select: { id: true, firstName: true, lastName: true }
      },
      lender: {
        select: { id: true, firstName: true, lastName: true }
      }
    }
  });

  for (const transaction of transactions) {
    try {
      const borrowerName = [transaction.borrower.firstName, transaction.borrower.lastName].filter(Boolean).join(' ');
      const lenderName = [transaction.lender.firstName, transaction.lender.lastName].filter(Boolean).join(' ');

      const notificationContext = {
        transactionId: transaction.id,
        itemId: transaction.item.id,
        itemTitle: transaction.item.title,
        borrowerId: transaction.borrowerId,
        borrowerName,
        lenderId: transaction.lenderId,
        lenderName,
        returnTime: transaction.returnTime.toISOString(),
      };

      // Notify both borrower and lender about upcoming return
      await notifyUser(transaction.borrowerId, 'return_reminder', notificationContext);
      await notifyUser(transaction.lenderId, 'return_reminder', notificationContext);

      // Mark reminder as sent
      await prisma.transaction.update({
        where: { id: transaction.id },
        data: { returnReminderSent: true }
      });

      console.log(`[Scheduler] Sent return reminder for transaction ${transaction.id}`);
    } catch (error) {
      console.error(`[Scheduler] Failed to send return reminder for transaction ${transaction.id}:`, error);
    }
  }
}

/**
 * Check for overdue transactions and send notifications
 */
async function checkOverdueTransactions() {
  const now = new Date();

  const transactions = await prisma.transaction.findMany({
    where: {
      status: 'active',
      returnTime: {
        lt: now
      },
      overdueNotificationSent: false
    },
    include: {
      item: true,
      borrower: {
        select: { id: true, firstName: true, lastName: true }
      },
      lender: {
        select: { id: true, firstName: true, lastName: true }
      }
    }
  });

  for (const transaction of transactions) {
    try {
      const borrowerName = [transaction.borrower.firstName, transaction.borrower.lastName].filter(Boolean).join(' ');
      const lenderName = [transaction.lender.firstName, transaction.lender.lastName].filter(Boolean).join(' ');

      const daysOverdue = Math.ceil((now - transaction.returnTime) / (1000 * 60 * 60 * 24));

      const notificationContext = {
        transactionId: transaction.id,
        itemId: transaction.item.id,
        itemTitle: transaction.item.title,
        borrowerId: transaction.borrowerId,
        borrowerName,
        lenderId: transaction.lenderId,
        lenderName,
        daysOverdue,
      };

      // Notify both parties about overdue item
      await notifyUser(transaction.borrowerId, 'transaction_overdue', notificationContext);
      await notifyUser(transaction.lenderId, 'transaction_overdue', notificationContext);

      // Mark overdue notification as sent
      await prisma.transaction.update({
        where: { id: transaction.id },
        data: { overdueNotificationSent: true }
      });

      console.log(`[Scheduler] Sent overdue notification for transaction ${transaction.id} (${daysOverdue} days overdue)`);
    } catch (error) {
      console.error(`[Scheduler] Failed to send overdue notification for transaction ${transaction.id}:`, error);
    }
  }
}

/**
 * Check for expired requests and update their status.
 * A request expires when its start date (neededFrom) has passed
 * and it still hasn't been fulfilled with a transaction.
 */
async function checkExpiredRequests() {
  const now = new Date();

  // Find requests whose start date has passed but are still open/matched
  const expiredRequests = await prisma.request.findMany({
    where: {
      status: {
        in: ['open', 'matched']
      },
      neededFrom: {
        lt: now
      }
    },
    include: {
      requester: {
        select: { id: true, firstName: true, lastName: true }
      },
      transactions: {
        where: { status: { notIn: ['cancelled'] } },
        select: { id: true },
        take: 1,
      },
    }
  });

  for (const request of expiredRequests) {
    try {
      // Skip if the request already has an active/accepted transaction
      if (request.transactions && request.transactions.length > 0) {
        continue;
      }

      // Update status to expired
      await prisma.request.update({
        where: { id: request.id },
        data: { status: 'expired' }
      });

      // Notify the requester
      await notifyUser(request.requesterId, 'request_expired', {
        requestId: request.id,
        requestTitle: request.title,
      });

      console.log(`[Scheduler] Marked request ${request.id} (${request.title}) as expired (start date passed)`);
    } catch (error) {
      console.error(`[Scheduler] Failed to expire request ${request.id}:`, error);
    }
  }
}

/**
 * Send reminders for pending transaction approvals (lender hasn't responded)
 */
async function sendApprovalReminders() {
  const now = new Date();
  // Remind after 12 hours of no response
  const twelveHoursAgo = new Date(now.getTime() - 12 * 60 * 60 * 1000);

  const pendingTransactions = await prisma.transaction.findMany({
    where: {
      status: 'requested',
      createdAt: {
        lt: twelveHoursAgo
      }
    },
    include: {
      item: true,
      borrower: {
        select: { id: true, firstName: true, lastName: true }
      },
      lender: {
        select: { id: true, firstName: true, lastName: true }
      }
    }
  });

  for (const transaction of pendingTransactions) {
    try {
      const borrowerName = [transaction.borrower.firstName, transaction.borrower.lastName].filter(Boolean).join(' ');

      // Check if we already sent a reminder recently (avoid spamming)
      const recentNotifications = await prisma.notification.findMany({
        where: {
          userId: transaction.lenderId,
          type: 'approval_reminder',
          createdAt: { gt: twelveHoursAgo },
        },
      });
      const alreadySent = recentNotifications.some(
        n => n.data?.transactionId === transaction.id
      );

      if (alreadySent) continue;

      await notifyUser(transaction.lenderId, 'approval_reminder', {
        transactionId: transaction.id,
        itemId: transaction.item.id,
        itemTitle: transaction.item.title,
        borrowerId: transaction.borrowerId,
        borrowerName,
      });

      console.log(`[Scheduler] Sent approval reminder for transaction ${transaction.id} to lender ${transaction.lenderId}`);
    } catch (error) {
      console.error(`[Scheduler] Failed to send approval reminder for transaction ${transaction.id}:`, error);
    }
  }
}

/**
 * Run all scheduled tasks
 */
async function runScheduledTasks() {
  console.log(`[Scheduler] Running scheduled tasks at ${new Date().toISOString()}`);

  try {
    await checkAutoActivateTransactions();
    await sendReturnReminders();
    await checkOverdueTransactions();
    await checkExpiredRequests();
    await sendApprovalReminders();
  } catch (error) {
    console.error('[Scheduler] Error running scheduled tasks:', error);
  }
}

/**
 * Start the scheduler - runs every hour
 */
function startScheduler() {
  // Run immediately on startup
  runScheduledTasks();

  // Then run every hour
  const intervalMs = 60 * 60 * 1000; // 1 hour
  setInterval(runScheduledTasks, intervalMs);

  console.log('[Scheduler] Started - running every hour');
}

module.exports = {
  startScheduler,
  runScheduledTasks,
  checkAutoActivateTransactions,
  sendReturnReminders,
  checkOverdueTransactions,
};
