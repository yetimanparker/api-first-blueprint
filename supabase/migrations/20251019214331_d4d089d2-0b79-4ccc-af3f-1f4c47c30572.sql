-- Clean up corrupted categories and subcategories created by bulk upload

-- Step 1: Update products that reference corrupted categories to use correct ones
-- Update products with corrupted Landscaping category to use correct Landscaping category
UPDATE products 
SET category = '17065070-8eb3-49c1-af36-10f40708c11d'
WHERE category = '332e156f-4765-4bbf-a7fa-7b59a4037dbd';

-- Update products with corrupted Fencing category to use correct Fencing category
UPDATE products 
SET category = 'c4222704-1793-44f8-a273-26a10b1b430b'
WHERE category = '32cedecf-ff4b-45d5-bdcf-8475300712f8';

-- Step 2: Update products that reference corrupted subcategories to use correct ones
-- Update Sod subcategory
UPDATE products 
SET subcategory = 'c0abe10f-5cda-42a0-93c4-c1eab7a618f4'
WHERE subcategory = '804212eb-f118-43f1-a185-d64fe259cc0e';

-- Update Soil subcategory
UPDATE products 
SET subcategory = 'bca85cc8-bb93-4ae4-98b0-5b7e72a57177'
WHERE subcategory = '25a83241-f3bc-4566-9c8d-d8dc585a879c';

-- Update Wood Fence subcategory
UPDATE products 
SET subcategory = '9a6ad400-fb63-4720-bb95-d4115ebe9490'
WHERE subcategory = 'e4e05952-f318-43f5-a2a4-8d1163a71a77';

-- Update Trees subcategory
UPDATE products 
SET subcategory = '02ada0f1-a2e8-42e1-8edb-bc9a5ed61ea0'
WHERE subcategory = '93e0daed-136f-464d-9fb3-992850757cf9';

-- Step 3: Delete corrupted subcategories (now safe since no products reference them)
DELETE FROM product_subcategories 
WHERE id IN (
  '804212eb-f118-43f1-a185-d64fe259cc0e',
  '25a83241-f3bc-4566-9c8d-d8dc585a879c',
  'e4e05952-f318-43f5-a2a4-8d1163a71a77',
  '93e0daed-136f-464d-9fb3-992850757cf9'
);

-- Step 4: Delete corrupted categories (now safe since no products reference them)
DELETE FROM product_categories 
WHERE id IN (
  '332e156f-4765-4bbf-a7fa-7b59a4037dbd',
  '32cedecf-ff4b-45d5-bdcf-8475300712f8'
);