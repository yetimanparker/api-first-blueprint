-- Fix the products policy for widget access
-- The previous policy won't work because we can't access route params in RLS
-- Instead, allow public to view active products and rely on the client filtering by contractor_id

DROP POLICY IF EXISTS "Public can view active products for specific contractor" ON products;

-- Create a simpler policy that allows viewing active products
-- The widget will filter by contractor_id in the query itself
CREATE POLICY "Widget can view active products"
  ON products
  FOR SELECT
  TO anon
  USING (is_active = true);

-- Ensure authenticated users (contractors) can still see their own products
-- This policy already exists but let's make sure it's correct