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
  // Use start of today UTC so a request is only expired once the entire start day has passed
  const todayUTC = new Date();
  todayUTC.setUTCHours(0, 0, 0, 0);

  // Find requests whose start date is strictly before today and still open/matched
  const expiredRequests = await prisma.request.findMany({
    where: {
      status: {
        in: ['open', 'matched']
      },
      neededFrom: {
        lt: todayUTC
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
 * Auto-complete transactions stuck in return_confirmed for 7+ days
 */
async function autoCompleteStaleTransactions() {
  const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);

  const transactions = await prisma.transaction.findMany({
    where: {
      status: 'return_confirmed',
      updatedAt: { lt: sevenDaysAgo },
    },
    include: {
      item: { select: { id: true, title: true } },
      borrower: { select: { id: true, firstName: true, lastName: true } },
      lender: { select: { id: true, firstName: true, lastName: true } },
    },
  });

  for (const transaction of transactions) {
    try {
      await prisma.transaction.update({
        where: { id: transaction.id },
        data: { status: 'completed' },
      });

      // Audit log: auto-completed stale transaction
      // Use lenderId as userId since this is a system action (no user initiated it)
      await prisma.transactionAuditLog.create({
        data: {
          transactionId: transaction.id,
          userId: transaction.lenderId,
          action: 'status_change',
          fromStatus: transaction.status,
          toStatus: 'completed',
          metadata: { triggeredBy: 'system', reason: 'Auto-completed after stale timeout' },
        },
      }).catch(err => console.error('[AuditLog] Failed to log auto-complete:', err.message));

      const borrowerName = [transaction.borrower.firstName, transaction.borrower.lastName].filter(Boolean).join(' ');
      const lenderName = [transaction.lender.firstName, transaction.lender.lastName].filter(Boolean).join(' ');

      const ctx = {
        transactionId: transaction.id,
        itemId: transaction.item.id,
        itemTitle: transaction.item.title,
        borrowerId: transaction.borrowerId,
        borrowerName,
        lenderId: transaction.lenderId,
        lenderName,
      };

      await notifyUser(transaction.borrowerId, 'transaction_completed', ctx);
      await notifyUser(transaction.lenderId, 'transaction_completed', ctx);

      console.log(`[Scheduler] Auto-completed stale transaction ${transaction.id}`);
    } catch (error) {
      console.error(`[Scheduler] Failed to auto-complete transaction ${transaction.id}:`, error);
    }
  }
}

/**
 * Delete notifications older than 90 days
 */
async function cleanupOldNotifications() {
  const ninetyDaysAgo = new Date(Date.now() - 90 * 24 * 60 * 60 * 1000);

  try {
    const result = await prisma.notification.deleteMany({
      where: { createdAt: { lt: ninetyDaysAgo } },
    });
    if (result.count > 0) {
      console.log(`[Scheduler] Cleaned up ${result.count} old notifications`);
    }
  } catch (error) {
    console.error('[Scheduler] Failed to cleanup old notifications:', error);
  }
}

/**
 * Cleanup expired match groups older than 60 days
 */
async function cleanupExpiredMatchGroups() {
  const sixtyDaysAgo = new Date(Date.now() - 60 * 24 * 60 * 60 * 1000);

  try {
    const result = await prisma.matchGroup.deleteMany({
      where: {
        status: 'expired',
        updatedAt: { lt: sixtyDaysAgo },
      },
    });
    if (result.count > 0) {
      console.log(`[Scheduler] Cleaned up ${result.count} expired match groups`);
    }
  } catch (error) {
    console.error('[Scheduler] Failed to cleanup expired match groups:', error);
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
    await autoCompleteStaleTransactions();
    await cleanupOldNotifications();
    await cleanupExpiredMatchGroups();
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
