-- Add map placement capability flag to products table
ALTER TABLE products 
ADD COLUMN allow_addon_map_placement boolean DEFAULT false;

-- Add comment for documentation
COMMENT ON COLUMN products.allow_addon_map_placement IS 'When true, add-ons for this product can be individually placed on the map at specific coordinates';
