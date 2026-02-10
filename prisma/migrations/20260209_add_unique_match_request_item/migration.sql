-- CreateIndex
CREATE UNIQUE INDEX "uq_match_request_item" ON "matches"("request_id", "item_id");
