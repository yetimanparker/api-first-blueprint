
-- Update products with Concrete subcategory to have Concrete category
-- for bob@poolelandscapesupply.com contractor

UPDATE products p
SET category = (
  SELECT cat.id::text
  FROM contractors c
  JOIN product_categories cat ON cat.contractor_id = c.id
  WHERE c.email = 'bob@poolelandscapesupply.com'
  AND cat.name = 'Concrete'
  LIMIT 1
)
WHERE p.contractor_id = (
  SELECT id 
  FROM contractors 
  WHERE email = 'bob@poolelandscapesupply.com'
)
AND p.subcategory = (
  SELECT sub.id::text
  FROM contractors c
  JOIN product_categories cat ON cat.contractor_id = c.id
  JOIN product_subcategories sub ON sub.category_id = cat.id
  WHERE c.email = 'bob@poolelandscapesupply.com'
  AND sub.name = 'Concrete'
  LIMIT 1
)
AND p.category != (
  SELECT cat.id::text
  FROM contractors c
  JOIN product_categories cat ON cat.contractor_id = c.id
  WHERE c.email = 'bob@poolelandscapesupply.com'
  AND cat.name = 'Concrete'
  LIMIT 1
);
