-- CreateEnum
CREATE TYPE "Category" AS ENUM ('tools', 'outdoor_recreation', 'party_events', 'lawn_garden', 'vehicles_transport', 'workspace', 'specialized_equipment', 'services', 'other');

-- CreateEnum
CREATE TYPE "ItemCondition" AS ENUM ('new', 'excellent', 'good', 'fair', 'poor');

-- CreateEnum
CREATE TYPE "PricingType" AS ENUM ('free', 'hourly', 'daily', 'weekly', 'monthly');

-- CreateEnum
CREATE TYPE "ProtectionPreference" AS ENUM ('waiver_ok', 'insurance_required', 'deposit_required', 'let_me_decide');

-- CreateEnum
CREATE TYPE "RequestStatus" AS ENUM ('open', 'matched', 'accepted', 'cancelled', 'expired');

-- CreateEnum
CREATE TYPE "MatchResponse" AS ENUM ('pending', 'accepted', 'declined', 'ignored');

-- CreateEnum
CREATE TYPE "TransactionStatus" AS ENUM ('requested', 'accepted', 'pickup_confirmed', 'active', 'return_initiated', 'return_confirmed', 'completed', 'disputed', 'cancelled');

-- CreateEnum
CREATE TYPE "ProtectionType" AS ENUM ('waiver', 'insurance', 'deposit');

-- CreateEnum
CREATE TYPE "PaymentStatus" AS ENUM ('pending', 'authorized', 'captured', 'refunded', 'partial_refund');

-- CreateEnum
CREATE TYPE "PhotoType" AS ENUM ('pickup_full_view', 'pickup_damage', 'pickup_serial', 'return_full_view', 'return_damage', 'return_serial');

-- CreateEnum
CREATE TYPE "RatingRole" AS ENUM ('lender', 'borrower');

-- CreateTable
CREATE TABLE "users" (
    "id" UUID NOT NULL,
    "email" TEXT NOT NULL,
    "password_hash" TEXT NOT NULL,
    "full_name" TEXT NOT NULL,
    "phone_number" TEXT,
    "profile_photo_url" TEXT,
    "address" TEXT,
    "latitude" DECIMAL(10,8),
    "longitude" DECIMAL(11,8),
    "neighborhood" TEXT,
    "is_verified" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "items" (
    "id" UUID NOT NULL,
    "owner_id" UUID NOT NULL,
    "category" "Category" NOT NULL,
    "subcategory" TEXT,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "condition" "ItemCondition" NOT NULL,
    "replacement_value" DECIMAL(10,2) NOT NULL,
    "pricing_type" "PricingType" NOT NULL,
    "price_amount" DECIMAL(10,2),
    "late_fee_amount" DECIMAL(10,2),
    "protection_preference" "ProtectionPreference" NOT NULL,
    "deposit_percentage" INTEGER NOT NULL DEFAULT 0,
    "is_available" BOOLEAN NOT NULL DEFAULT true,
    "photo_urls" JSONB NOT NULL DEFAULT '[]',
    "special_instructions" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "items_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "requests" (
    "id" UUID NOT NULL,
    "requester_id" UUID NOT NULL,
    "category" "Category" NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "needed_from" TIMESTAMP(3) NOT NULL,
    "needed_until" TIMESTAMP(3) NOT NULL,
    "max_budget" DECIMAL(10,2),
    "max_distance_miles" DECIMAL(5,2) NOT NULL DEFAULT 10,
    "latitude" DECIMAL(10,8) NOT NULL,
    "longitude" DECIMAL(11,8) NOT NULL,
    "status" "RequestStatus" NOT NULL DEFAULT 'open',
    "expires_at" TIMESTAMP(3) NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "requests_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "matches" (
    "id" UUID NOT NULL,
    "request_id" UUID NOT NULL,
    "item_id" UUID NOT NULL,
    "distance_miles" DECIMAL(6,2) NOT NULL,
    "match_score" INTEGER NOT NULL,
    "lender_notified" BOOLEAN NOT NULL DEFAULT false,
    "lender_response" "MatchResponse" NOT NULL DEFAULT 'pending',
    "responded_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "matches_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "transactions" (
    "id" UUID NOT NULL,
    "request_id" UUID,
    "item_id" UUID NOT NULL,
    "borrower_id" UUID NOT NULL,
    "lender_id" UUID NOT NULL,
    "status" "TransactionStatus" NOT NULL DEFAULT 'requested',
    "pickup_time" TIMESTAMP(3) NOT NULL,
    "return_time" TIMESTAMP(3) NOT NULL,
    "actual_pickup_time" TIMESTAMP(3),
    "actual_return_time" TIMESTAMP(3),
    "rental_fee" DECIMAL(10,2) NOT NULL,
    "platform_fee" DECIMAL(10,2) NOT NULL,
    "protection_type" "ProtectionType" NOT NULL,
    "deposit_amount" DECIMAL(10,2),
    "insurance_fee" DECIMAL(10,2),
    "total_charged" DECIMAL(10,2) NOT NULL,
    "late_fee_charged" DECIMAL(10,2),
    "payment_status" "PaymentStatus" NOT NULL DEFAULT 'pending',
    "payment_intent_id" TEXT,
    "dispute_reason" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "transactions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "photos" (
    "id" UUID NOT NULL,
    "transaction_id" UUID NOT NULL,
    "uploaded_by" UUID NOT NULL,
    "photo_type" "PhotoType" NOT NULL,
    "file_url" TEXT NOT NULL,
    "metadata" JSONB NOT NULL DEFAULT '{}',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "photos_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "messages" (
    "id" UUID NOT NULL,
    "transaction_id" UUID NOT NULL,
    "sender_id" UUID NOT NULL,
    "recipient_id" UUID NOT NULL,
    "message_text" TEXT NOT NULL,
    "photo_url" TEXT,
    "is_read" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "messages_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ratings" (
    "id" UUID NOT NULL,
    "transaction_id" UUID NOT NULL,
    "rater_id" UUID NOT NULL,
    "rated_user_id" UUID NOT NULL,
    "role" "RatingRole" NOT NULL,
    "overall_rating" INTEGER NOT NULL,
    "on_time_rating" INTEGER,
    "communication_rating" INTEGER,
    "condition_rating" INTEGER,
    "item_as_described_rating" INTEGER,
    "review_text" TEXT,
    "would_transact_again" BOOLEAN NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ratings_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "users_email_key" ON "users"("email");

-- CreateIndex
CREATE UNIQUE INDEX "users_phone_number_key" ON "users"("phone_number");

-- CreateIndex
CREATE INDEX "idx_user_location" ON "users"("latitude", "longitude");

-- CreateIndex
CREATE INDEX "idx_user_neighborhood" ON "users"("neighborhood");

-- CreateIndex
CREATE INDEX "idx_item_owner" ON "items"("owner_id");

-- CreateIndex
CREATE INDEX "idx_item_category" ON "items"("category");

-- CreateIndex
CREATE INDEX "idx_item_available" ON "items"("is_available");

-- CreateIndex
CREATE INDEX "idx_item_owner_available" ON "items"("owner_id", "is_available");

-- CreateIndex
CREATE INDEX "idx_request_requester" ON "requests"("requester_id");

-- CreateIndex
CREATE INDEX "idx_request_status" ON "requests"("status");

-- CreateIndex
CREATE INDEX "idx_request_category" ON "requests"("category");

-- CreateIndex
CREATE INDEX "idx_request_expires" ON "requests"("expires_at");

-- CreateIndex
CREATE INDEX "idx_request_location_status" ON "requests"("latitude", "longitude", "status");

-- CreateIndex
CREATE INDEX "idx_match_request" ON "matches"("request_id");

-- CreateIndex
CREATE INDEX "idx_match_item" ON "matches"("item_id");

-- CreateIndex
CREATE INDEX "idx_match_response" ON "matches"("lender_response");

-- CreateIndex
CREATE INDEX "idx_transaction_borrower" ON "transactions"("borrower_id");

-- CreateIndex
CREATE INDEX "idx_transaction_lender" ON "transactions"("lender_id");

-- CreateIndex
CREATE INDEX "idx_transaction_item" ON "transactions"("item_id");

-- CreateIndex
CREATE INDEX "idx_transaction_status" ON "transactions"("status");

-- CreateIndex
CREATE INDEX "idx_transaction_pickup" ON "transactions"("pickup_time");

-- CreateIndex
CREATE INDEX "idx_transaction_status_created" ON "transactions"("status", "created_at");

-- CreateIndex
CREATE INDEX "idx_transaction_borrower_status" ON "transactions"("borrower_id", "status");

-- CreateIndex
CREATE INDEX "idx_transaction_lender_status" ON "transactions"("lender_id", "status");

-- CreateIndex
CREATE INDEX "idx_photo_transaction" ON "photos"("transaction_id");

-- CreateIndex
CREATE INDEX "idx_photo_type" ON "photos"("photo_type");

-- CreateIndex
CREATE INDEX "idx_message_transaction" ON "messages"("transaction_id");

-- CreateIndex
CREATE INDEX "idx_message_sender" ON "messages"("sender_id");

-- CreateIndex
CREATE INDEX "idx_message_recipient" ON "messages"("recipient_id");

-- CreateIndex
CREATE INDEX "idx_message_created" ON "messages"("created_at");

-- CreateIndex
CREATE INDEX "idx_rating_transaction" ON "ratings"("transaction_id");

-- CreateIndex
CREATE INDEX "idx_rating_rated_user" ON "ratings"("rated_user_id");

-- CreateIndex
CREATE UNIQUE INDEX "ratings_transaction_id_rater_id_key" ON "ratings"("transaction_id", "rater_id");

-- AddForeignKey
ALTER TABLE "items" ADD CONSTRAINT "items_owner_id_fkey" FOREIGN KEY ("owner_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "requests" ADD CONSTRAINT "requests_requester_id_fkey" FOREIGN KEY ("requester_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "matches" ADD CONSTRAINT "matches_request_id_fkey" FOREIGN KEY ("request_id") REFERENCES "requests"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "matches" ADD CONSTRAINT "matches_item_id_fkey" FOREIGN KEY ("item_id") REFERENCES "items"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "transactions" ADD CONSTRAINT "transactions_request_id_fkey" FOREIGN KEY ("request_id") REFERENCES "requests"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "transactions" ADD CONSTRAINT "transactions_item_id_fkey" FOREIGN KEY ("item_id") REFERENCES "items"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "transactions" ADD CONSTRAINT "transactions_borrower_id_fkey" FOREIGN KEY ("borrower_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "transactions" ADD CONSTRAINT "transactions_lender_id_fkey" FOREIGN KEY ("lender_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "photos" ADD CONSTRAINT "photos_transaction_id_fkey" FOREIGN KEY ("transaction_id") REFERENCES "transactions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "photos" ADD CONSTRAINT "photos_uploaded_by_fkey" FOREIGN KEY ("uploaded_by") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "messages" ADD CONSTRAINT "messages_transaction_id_fkey" FOREIGN KEY ("transaction_id") REFERENCES "transactions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "messages" ADD CONSTRAINT "messages_sender_id_fkey" FOREIGN KEY ("sender_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "messages" ADD CONSTRAINT "messages_recipient_id_fkey" FOREIGN KEY ("recipient_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ratings" ADD CONSTRAINT "ratings_transaction_id_fkey" FOREIGN KEY ("transaction_id") REFERENCES "transactions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ratings" ADD CONSTRAINT "ratings_rater_id_fkey" FOREIGN KEY ("rater_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ratings" ADD CONSTRAINT "ratings_rated_user_id_fkey" FOREIGN KEY ("rated_user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
