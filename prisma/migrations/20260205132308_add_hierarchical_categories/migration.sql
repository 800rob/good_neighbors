-- CreateEnum
CREATE TYPE "ListingType" AS ENUM ('item', 'service');

-- AlterTable
ALTER TABLE "items" ADD COLUMN     "category_tier1" TEXT,
ADD COLUMN     "category_tier2" TEXT,
ADD COLUMN     "category_tier3" TEXT,
ADD COLUMN     "custom_item_name" TEXT,
ADD COLUMN     "is_other" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "listing_type" "ListingType";

-- AlterTable
ALTER TABLE "requests" ADD COLUMN     "category_tier1" TEXT,
ADD COLUMN     "category_tier2" TEXT,
ADD COLUMN     "category_tier3" TEXT,
ADD COLUMN     "custom_need" TEXT,
ADD COLUMN     "is_other" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "listing_type" "ListingType";

-- CreateIndex
CREATE INDEX "idx_item_type_tier1" ON "items"("listing_type", "category_tier1");

-- CreateIndex
CREATE INDEX "idx_item_type_tier1_tier2" ON "items"("listing_type", "category_tier1", "category_tier2");

-- CreateIndex
CREATE INDEX "idx_request_type_tier1" ON "requests"("listing_type", "category_tier1");

-- CreateIndex
CREATE INDEX "idx_request_type_tier1_tier2" ON "requests"("listing_type", "category_tier1", "category_tier2");
