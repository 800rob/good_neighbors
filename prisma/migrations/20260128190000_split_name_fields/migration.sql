-- Step 1: Add new columns as nullable first
ALTER TABLE "users" ADD COLUMN "first_name" TEXT;
ALTER TABLE "users" ADD COLUMN "middle_name" TEXT;
ALTER TABLE "users" ADD COLUMN "last_name" TEXT;

-- Step 2: Migrate existing data from full_name to first_name/last_name
-- Split on first space for first name, rest goes to last name
UPDATE "users" SET
  "first_name" = CASE
    WHEN position(' ' in "full_name") > 0
    THEN split_part("full_name", ' ', 1)
    ELSE "full_name"
  END,
  "last_name" = CASE
    WHEN position(' ' in "full_name") > 0
    THEN substring("full_name" from position(' ' in "full_name") + 1)
    ELSE 'Unknown'
  END
WHERE "full_name" IS NOT NULL;

-- Handle any null values with defaults
UPDATE "users" SET "first_name" = 'Unknown' WHERE "first_name" IS NULL;
UPDATE "users" SET "last_name" = 'Unknown' WHERE "last_name" IS NULL;

-- Step 3: Make first_name and last_name required (NOT NULL)
ALTER TABLE "users" ALTER COLUMN "first_name" SET NOT NULL;
ALTER TABLE "users" ALTER COLUMN "last_name" SET NOT NULL;

-- Step 4: Drop the old full_name column
ALTER TABLE "users" DROP COLUMN "full_name";
