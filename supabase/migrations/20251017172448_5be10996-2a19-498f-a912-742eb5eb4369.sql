-- Add required and default variation support
ALTER TABLE product_variations 
ADD COLUMN IF NOT EXISTS is_required BOOLEAN DEFAULT false,
ADD COLUMN IF NOT EXISTS is_default BOOLEAN DEFAULT false;

-- Add unique constraint: only one default variation per product
DROP INDEX IF EXISTS idx_unique_default_variation;
CREATE UNIQUE INDEX idx_unique_default_variation 
ON product_variations (product_id) 
WHERE is_default = true;

-- Add comments for clarity
COMMENT ON COLUMN product_variations.is_required IS 'If true, this variation must be selected before adding to quote';
COMMENT ON COLUMN product_variations.is_default IS 'If true, this variation is pre-selected as default (only one per product)';