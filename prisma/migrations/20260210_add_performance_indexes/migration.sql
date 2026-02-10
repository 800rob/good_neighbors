-- Phase 2 I-06: Add performance indexes for scheduler queries and common lookups

-- Transaction indexes for scheduler service
CREATE INDEX IF NOT EXISTS "idx_transaction_status_return" ON "transactions"("status", "return_time");
CREATE INDEX IF NOT EXISTS "idx_transaction_status_reminder" ON "transactions"("status", "return_reminder_sent");
CREATE INDEX IF NOT EXISTS "idx_transaction_status_overdue" ON "transactions"("status", "overdue_notification_sent");

-- Notification index for dedup queries (userId + type + createdAt)
CREATE INDEX IF NOT EXISTS "idx_notification_user_type_created" ON "notifications"("user_id", "type", "created_at");

-- Rating index for user profile queries (ratedUserId + role)
CREATE INDEX IF NOT EXISTS "idx_rating_rated_user_role" ON "ratings"("rated_user_id", "role");
