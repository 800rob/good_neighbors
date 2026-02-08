/**
 * Script to send return reminder notifications
 * Run this as a cron job (e.g., every hour)
 *
 * Sends notifications for:
 * - Items due within 24 hours (return_reminder)
 * - Items that are overdue (transaction_overdue)
 */

const prisma = require('../src/config/database');
const { notifyUser } = require('../src/services/notificationService');

async function sendReturnReminders() {
  const now = new Date();
  const in24Hours = new Date(now.getTime() + 24 * 60 * 60 * 1000);

  console.log('Checking for return reminders at', now.toISOString());

  // Find active transactions with return times
  const activeTransactions = await prisma.transaction.findMany({
    where: {
      status: 'active',
      returnTime: {
        not: null
      }
    },
    include: {
      borrower: {
        select: { id: true, firstName: true, lastName: true }
      },
      lender: {
        select: { id: true, firstName: true, lastName: true }
      },
      item: {
        select: { id: true, title: true }
      }
    }
  });

  console.log(`Found ${activeTransactions.length} active transactions with return times`);

  for (const transaction of activeTransactions) {
    const returnTime = new Date(transaction.returnTime);
    const hoursUntilReturn = (returnTime.getTime() - now.getTime()) / (1000 * 60 * 60);

    // Check if we've already sent a reminder for this period
    const existingReminder = await prisma.notification.findFirst({
      where: {
        userId: transaction.borrowerId,
        type: hoursUntilReturn < 0 ? 'transaction_overdue' : 'return_reminder',
        createdAt: {
          gte: new Date(now.getTime() - 12 * 60 * 60 * 1000) // Within last 12 hours
        },
        data: {
          path: ['transactionId'],
          equals: transaction.id
        }
      }
    });

    if (existingReminder) {
      continue; // Skip - already notified recently
    }

    const context = {
      transactionId: transaction.id,
      itemId: transaction.item?.id,
      itemTitle: transaction.item?.title || 'Item',
      lenderName: `${transaction.lender?.firstName || ''} ${transaction.lender?.lastName || ''}`.trim(),
      borrowerName: `${transaction.borrower?.firstName || ''} ${transaction.borrower?.lastName || ''}`.trim()
    };

    if (hoursUntilReturn < 0) {
      // Overdue
      const daysOverdue = Math.ceil(Math.abs(hoursUntilReturn) / 24);
      context.daysOverdue = daysOverdue;

      console.log(`Transaction ${transaction.id} is overdue by ${daysOverdue} day(s) - notifying borrower`);

      // Notify borrower
      await notifyUser(transaction.borrowerId, 'transaction_overdue', context);

      // Also notify lender
      await notifyUser(transaction.lenderId, 'transaction_overdue', {
        ...context,
        message: `"${context.itemTitle}" is now overdue by ${daysOverdue} day${daysOverdue > 1 ? 's' : ''}. The borrower has been notified.`
      });

    } else if (hoursUntilReturn <= 24 && hoursUntilReturn > 0) {
      // Due within 24 hours - send reminder
      console.log(`Transaction ${transaction.id} due in ${Math.round(hoursUntilReturn)} hours - sending reminder`);

      // Notify borrower
      await notifyUser(transaction.borrowerId, 'return_reminder', context);

      // Notify lender too
      await notifyUser(transaction.lenderId, 'return_reminder', {
        ...context,
        message: `Reminder: "${context.itemTitle}" is due to be returned by ${context.borrowerName} tomorrow.`
      });
    }
  }

  console.log('Return reminder check complete');
}

// Run the script
sendReturnReminders()
  .then(() => {
    console.log('Done');
    process.exit(0);
  })
  .catch((error) => {
    console.error('Error sending return reminders:', error);
    process.exit(1);
  });
