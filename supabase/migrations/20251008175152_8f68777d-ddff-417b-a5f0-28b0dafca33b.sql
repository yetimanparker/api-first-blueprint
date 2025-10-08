-- Add separate lower and upper percentage columns for price ranges
ALTER TABLE contractor_settings 
  ADD COLUMN IF NOT EXISTS price_range_lower_percentage numeric DEFAULT 10,
  ADD COLUMN IF NOT EXISTS price_range_upper_percentage numeric DEFAULT 20;

-- Migrate existing data: use the current percentage for both bounds
UPDATE contractor_settings 
SET 
  price_range_lower_percentage = COALESCE(price_range_lower_percentage, price_range_percentage),
  price_range_upper_percentage = COALESCE(price_range_upper_percentage, price_range_percentage)
WHERE price_range_lower_percentage IS NULL OR price_range_upper_percentage IS NULL;

-- Set NOT NULL constraints after data migration
ALTER TABLE contractor_settings 
  ALTER COLUMN price_range_lower_percentage SET NOT NULL,
  ALTER COLUMN price_range_upper_percentage SET NOT NULL;

-- Add check constraints for reasonable values
ALTER TABLE contractor_settings
  ADD CONSTRAINT price_range_lower_percentage_check CHECK (price_range_lower_percentage >= 0 AND price_range_lower_percentage <= 50);

ALTER TABLE contractor_settings
  ADD CONSTRAINT price_range_upper_percentage_check CHECK (price_range_upper_percentage >= 0 AND price_range_upper_percentage <= 100);