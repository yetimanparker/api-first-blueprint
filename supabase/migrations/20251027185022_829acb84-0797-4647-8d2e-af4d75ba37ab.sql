-- Update minimum order quantity for ton products to 0.5 for Bob's account
UPDATE products
SET min_order_quantity = 0.5
WHERE contractor_id = '3135d50a-43dc-49f5-978e-4a130f1fed6f'
AND unit_type = 'ton';

-- Update minimum order quantity for cubic_yard products to 0.5 for Bob's account
UPDATE products
SET min_order_quantity = 0.5
WHERE contractor_id = '3135d50a-43dc-49f5-978e-4a130f1fed6f'
AND unit_type = 'cubic_yard';