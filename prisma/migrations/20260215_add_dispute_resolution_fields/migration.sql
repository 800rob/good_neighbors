-- AlterTable
ALTER TABLE "transactions" ADD COLUMN "dispute_category" TEXT;
ALTER TABLE "transactions" ADD COLUMN "dispute_filed_by" UUID;
ALTER TABLE "transactions" ADD COLUMN "dispute_filed_at" TIMESTAMP(3);
ALTER TABLE "transactions" ADD COLUMN "dispute_response" TEXT;
ALTER TABLE "transactions" ADD COLUMN "dispute_responded_at" TIMESTAMP(3);
ALTER TABLE "transactions" ADD COLUMN "dispute_resolution" TEXT;
ALTER TABLE "transactions" ADD COLUMN "dispute_resolved_at" TIMESTAMP(3);
ALTER TABLE "transactions" ADD COLUMN "dispute_resolution_notes" TEXT;
