-- Fix the pickelball court product to use the correct category UUID
-- Find products where category is a string name instead of UUID
UPDATE products 
SET category = (
  SELECT id FROM product_categories 
  WHERE name = products.category 
  AND contractor_id = products.contractor_id
)
WHERE category NOT LIKE '%-%-%-%-%'  -- Not a UUID format
AND EXISTS (
  SELECT 1 FROM product_categories 
  WHERE name = products.category 
  AND contractor_id = products.contractor_id
);