-- AlterTable
ALTER TABLE "transactions" ADD COLUMN     "overdue_notification_sent" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "return_reminder_sent" BOOLEAN NOT NULL DEFAULT false;
