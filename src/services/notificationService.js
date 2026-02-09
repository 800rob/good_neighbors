const prisma = require('../config/database');

// Notification types with default channel settings
const NOTIFICATION_TYPES = {
  match_created: {
    defaultInApp: true,
    defaultEmail: true,
    defaultSms: false,
  },
  match_found: {
    defaultInApp: true,
    defaultEmail: true,
    defaultSms: false,
  },
  match_accepted: {
    defaultInApp: true,
    defaultEmail: true,
    defaultSms: false,
  },
  match_declined: {
    defaultInApp: true,
    defaultEmail: false,
    defaultSms: false,
  },
  transaction_requested: {
    defaultInApp: true,
    defaultEmail: true,
    defaultSms: false,
  },
  transaction_accepted: {
    defaultInApp: true,
    defaultEmail: true,
    defaultSms: false,
  },
  transaction_declined: {
    defaultInApp: true,
    defaultEmail: false,
    defaultSms: false,
  },
  pickup_confirmed: {
    defaultInApp: true,
    defaultEmail: false,
    defaultSms: false,
  },
  return_initiated: {
    defaultInApp: true,
    defaultEmail: false,
    defaultSms: false,
  },
  transaction_completed: {
    defaultInApp: true,
    defaultEmail: true,
    defaultSms: false,
  },
  transaction_disputed: {
    defaultInApp: true,
    defaultEmail: true,
    defaultSms: false,
  },
  message_received: {
    defaultInApp: true,
    defaultEmail: false,
    defaultSms: false,
  },
  rating_received: {
    defaultInApp: true,
    defaultEmail: true,
    defaultSms: false,
  },
  transaction_active: {
    defaultInApp: true,
    defaultEmail: true,
    defaultSms: false,
  },
  return_reminder: {
    defaultInApp: true,
    defaultEmail: true,
    defaultSms: true,
  },
  transaction_overdue: {
    defaultInApp: true,
    defaultEmail: true,
    defaultSms: true,
  },
  request_expired: {
    defaultInApp: true,
    defaultEmail: true,
    defaultSms: false,
  },
  request_expiring: {
    defaultInApp: true,
    defaultEmail: true,
    defaultSms: false,
  },
  approval_reminder: {
    defaultInApp: true,
    defaultEmail: true,
    defaultSms: false,
  },
};

/**
 * Generate notification content based on type and context
 */
function getNotificationContent(type, context) {
  const templates = {
    match_created: {
      title: 'New Match Found',
      message: context.itemPrice
        ? `Your item "${context.itemTitle}" (${context.itemPrice}) matches a request from ${context.requesterName}!`
        : `Your item "${context.itemTitle}" matches a request from ${context.requesterName}!`,
    },
    match_found: {
      title: 'Match Found for Your Request',
      message: context.matchCount > 1
        ? `${context.matchCount} items match your request "${context.requestTitle}"! Review them now.`
        : `"${context.itemTitle}" matches your request "${context.requestTitle}"! Review it now.`,
    },
    match_accepted: {
      title: 'Match Accepted',
      message: `${context.lenderName} accepted your request for "${context.itemTitle}". You can now start a transaction.`,
    },
    match_declined: {
      title: 'Match Declined',
      message: `${context.lenderName} declined your request for "${context.itemTitle}".`,
    },
    transaction_requested: {
      title: 'New Borrow Request',
      message: `${context.borrowerName} wants to borrow your "${context.itemTitle}".`,
    },
    transaction_accepted: {
      title: 'Request Accepted',
      message: `${context.lenderName} accepted your request to borrow "${context.itemTitle}".`,
    },
    transaction_declined: {
      title: 'Request Declined',
      message: `${context.lenderName} declined your request to borrow "${context.itemTitle}".`,
    },
    pickup_confirmed: {
      title: 'Pickup Confirmed',
      message: `Pickup confirmed for "${context.itemTitle}". The transaction is now active.`,
    },
    return_initiated: {
      title: 'Return Initiated',
      message: `${context.borrowerName} has initiated the return of "${context.itemTitle}".`,
    },
    transaction_completed: {
      title: 'Transaction Completed',
      message: `Your transaction for "${context.itemTitle}" has been completed. Don't forget to leave a rating!`,
    },
    transaction_disputed: {
      title: 'Transaction Disputed',
      message: `A dispute has been raised for "${context.itemTitle}". Please review the details.`,
    },
    message_received: {
      title: 'New Message',
      message: `${context.senderName} sent you a message about "${context.itemTitle}".`,
    },
    rating_received: {
      title: 'New Rating',
      message: `You received a ${context.rating}-star rating from ${context.raterName}.`,
    },
    transaction_active: {
      title: 'Transaction Now Active',
      message: `Your transaction for "${context.itemTitle}" is now active. Enjoy!`,
    },
    return_reminder: {
      title: 'Return Reminder',
      message: `Reminder: "${context.itemTitle}" is due to be returned tomorrow. Please coordinate with the other party.`,
    },
    transaction_overdue: {
      title: 'Item Overdue',
      message: `"${context.itemTitle}" is now overdue by ${context.daysOverdue} day${context.daysOverdue > 1 ? 's' : ''}. Please return it as soon as possible.`,
    },
    request_expired: {
      title: 'Request Expired',
      message: `Your request for "${context.requestTitle}" has expired. You can create a new request if you still need this item.`,
    },
    request_expiring: {
      title: 'Request Expiring Soon',
      message: context.matchCount > 0
        ? `Your request for "${context.requestTitle}" expires in 24 hours. You have ${context.matchCount} match${context.matchCount > 1 ? 'es' : ''} to review!`
        : `Your request for "${context.requestTitle}" expires in 24 hours. No matches found yet.`,
    },
    approval_reminder: {
      title: 'Pending Borrow Request',
      message: `${context.borrowerName} is waiting for your response on "${context.itemTitle}". Please accept or decline the request.`,
    },
  };

  return templates[type] || { title: 'Notification', message: 'You have a new notification.' };
}

/**
 * Get user's notification preferences for a specific type
 */
async function getUserPreferences(userId, notificationType) {
  let preference = await prisma.notificationPreference.findUnique({
    where: {
      unique_user_notification_type: {
        userId,
        notificationType,
      },
    },
  });

  // If no preference exists, use defaults
  if (!preference) {
    const defaults = NOTIFICATION_TYPES[notificationType] || {
      defaultInApp: true,
      defaultEmail: false,
      defaultSms: false,
    };

    return {
      inAppEnabled: defaults.defaultInApp,
      emailEnabled: defaults.defaultEmail,
      smsEnabled: defaults.defaultSms,
    };
  }

  return {
    inAppEnabled: preference.inAppEnabled,
    emailEnabled: preference.emailEnabled,
    smsEnabled: preference.smsEnabled,
  };
}

/**
 * Create an in-app notification
 */
async function createNotification(userId, type, title, message, data = null) {
  return prisma.notification.create({
    data: {
      userId,
      type,
      title,
      message,
      data,
    },
  });
}

/**
 * Send email notification (stub - implement with Nodemailer later)
 */
async function sendEmailNotification(userId, type, title, message) {
  // Get user email
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { email: true, firstName: true, lastName: true },
  });

  if (!user) return;

  // TODO: Implement with Nodemailer
  // For now, just log it
  console.log(`[EMAIL] To: ${user.email}, Subject: ${title}, Body: ${message}`);
}

/**
 * Send SMS notification (stub - for future implementation)
 */
async function sendSmsNotification(userId, type, title, message) {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { phoneNumber: true },
  });

  if (!user?.phoneNumber) return;

  // TODO: Implement with Twilio or similar
  console.log(`[SMS] To: ${user.phoneNumber}, Message: ${message}`);
}

/**
 * Main entry point - notify a user based on their preferences
 */
async function notifyUser(userId, type, context) {
  const preferences = await getUserPreferences(userId, type);
  const { title, message } = getNotificationContent(type, context);

  const results = {
    inApp: null,
    email: null,
    sms: null,
  };

  // Build data object for the notification
  const data = {
    ...context,
    type,
  };

  // Send in-app notification
  if (preferences.inAppEnabled) {
    results.inApp = await createNotification(userId, type, title, message, data);
  }

  // Send email notification
  if (preferences.emailEnabled) {
    await sendEmailNotification(userId, type, title, message);
    results.email = true;
  }

  // Send SMS notification (future)
  if (preferences.smsEnabled) {
    await sendSmsNotification(userId, type, title, message);
    results.sms = true;
  }

  return results;
}

/**
 * Get all notification types with their defaults
 */
function getAllNotificationTypes() {
  return Object.entries(NOTIFICATION_TYPES).map(([type, defaults]) => ({
    type,
    description: getNotificationTypeDescription(type),
    defaultInApp: defaults.defaultInApp,
    defaultEmail: defaults.defaultEmail,
    defaultSms: defaults.defaultSms,
  }));
}

function getNotificationTypeDescription(type) {
  const descriptions = {
    match_created: 'New match found for your request or item',
    match_found: 'Matches found for your request',
    match_accepted: 'Lender accepted your match request',
    match_declined: 'Lender declined your match request',
    transaction_requested: 'Someone wants to borrow your item',
    transaction_accepted: 'Your borrow request was accepted',
    transaction_declined: 'Your borrow request was declined',
    pickup_confirmed: 'Pickup has been confirmed',
    return_initiated: 'Return has been initiated',
    transaction_completed: 'Transaction completed',
    transaction_disputed: 'Transaction has been disputed',
    message_received: 'New message in a transaction',
    rating_received: 'You received a new rating',
    transaction_active: 'Transaction is now active (borrowing period started)',
    return_reminder: '24-hour reminder before return due date',
    transaction_overdue: 'Item is overdue for return',
    request_expired: 'Your request has expired',
    request_expiring: '24-hour reminder before request expires',
    approval_reminder: 'Reminder to respond to pending borrow requests',
  };
  return descriptions[type] || type;
}

module.exports = {
  notifyUser,
  createNotification,
  getNotificationContent,
  getUserPreferences,
  getAllNotificationTypes,
  NOTIFICATION_TYPES,
};
