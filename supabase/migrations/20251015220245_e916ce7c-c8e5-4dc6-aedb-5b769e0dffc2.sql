-- First, delete the dimensional products that don't work
DELETE FROM products WHERE has_fixed_dimensions = true;

-- Drop the overly permissive policies
DROP POLICY IF EXISTS "Authenticated users can view products" ON products;
DROP POLICY IF EXISTS "Public users can view active products for widget" ON products;

-- Create a new secure policy for widget access
-- The widget must pass contractor_id as a query parameter or in the request
CREATE POLICY "Public can view active products for specific contractor"
  ON products
  FOR SELECT
  TO public
  USING (
    is_active = true 
    AND contractor_id::text = current_setting('request.path', true)
  );

-- Ensure other tables also have proper isolation
-- Check customers table
DROP POLICY IF EXISTS "Public can view customers" ON customers;

-- Check quotes table  
DROP POLICY IF EXISTS "Public can view quotes" ON quotes;

-- Check contractor_settings - this one is OK as widgets need settings
-- but let's make sure it's properly scoped