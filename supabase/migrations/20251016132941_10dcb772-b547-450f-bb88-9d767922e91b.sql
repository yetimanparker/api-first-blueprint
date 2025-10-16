-- Add base height columns to products table for area calculation
ALTER TABLE products 
ADD COLUMN base_height numeric,
ADD COLUMN base_height_unit text DEFAULT 'ft',
ADD COLUMN use_height_in_calculation boolean DEFAULT false;

COMMENT ON COLUMN products.base_height IS 'Default height for base product - multiplies linear measurements to calculate area';
COMMENT ON COLUMN products.base_height_unit IS 'Unit of measurement for base height (ft, inches, m, cm)';
COMMENT ON COLUMN products.use_height_in_calculation IS 'When true, linear measurements will be multiplied by base_height to calculate billable area';