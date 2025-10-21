-- Add RLS policy to allow widget (unauthenticated users) to view product addons
CREATE POLICY "Widget can view product addons for active products"
ON product_addons
FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM products
    WHERE products.id = product_addons.product_id
    AND products.is_active = true
  )
);

-- Add RLS policy to allow widget (unauthenticated users) to view product variations
CREATE POLICY "Widget can view product variations for active products"
ON product_variations
FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM products
    WHERE products.id = product_variations.product_id
    AND products.is_active = true
  )
);

-- Add RLS policy to allow widget to view pricing tiers for active products
CREATE POLICY "Widget can view pricing tiers for active products"
ON product_pricing_tiers
FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM products
    WHERE products.id = product_pricing_tiers.product_id
    AND products.is_active = true
  )
);