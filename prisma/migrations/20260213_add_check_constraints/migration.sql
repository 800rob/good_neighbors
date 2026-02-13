-- Add CHECK constraints for data integrity
ALTER TABLE "transactions"
  ADD CONSTRAINT check_return_after_pickup CHECK (return_time > pickup_time),
  ADD CONSTRAINT check_rental_fee_non_negative CHECK (rental_fee >= 0),
  ADD CONSTRAINT check_platform_fee_non_negative CHECK (platform_fee >= 0),
  ADD CONSTRAINT check_total_charged_non_negative CHECK (total_charged >= 0),
  ADD CONSTRAINT check_deposit_non_negative CHECK (deposit_amount IS NULL OR deposit_amount >= 0),
  ADD CONSTRAINT check_insurance_non_negative CHECK (insurance_fee IS NULL OR insurance_fee >= 0),
  ADD CONSTRAINT check_late_fee_non_negative CHECK (late_fee_charged IS NULL OR late_fee_charged >= 0);

-- Item price constraints
ALTER TABLE "items"
  ADD CONSTRAINT check_price_non_negative CHECK (price_amount IS NULL OR price_amount >= 0),
  ADD CONSTRAINT check_late_fee_amount_non_negative CHECK (late_fee_amount IS NULL OR late_fee_amount >= 0),
  ADD CONSTRAINT check_replacement_value_non_negative CHECK (replacement_value >= 0);

-- Rating range constraints
ALTER TABLE "ratings"
  ADD CONSTRAINT check_overall_rating_range CHECK (overall_rating >= 1 AND overall_rating <= 5),
  ADD CONSTRAINT check_on_time_rating_range CHECK (on_time_rating IS NULL OR (on_time_rating >= 1 AND on_time_rating <= 5)),
  ADD CONSTRAINT check_communication_rating_range CHECK (communication_rating IS NULL OR (communication_rating >= 1 AND communication_rating <= 5)),
  ADD CONSTRAINT check_condition_rating_range CHECK (condition_rating IS NULL OR (condition_rating >= 1 AND condition_rating <= 5)),
  ADD CONSTRAINT check_item_as_described_rating_range CHECK (item_as_described_rating IS NULL OR (item_as_described_rating >= 1 AND item_as_described_rating <= 5));
