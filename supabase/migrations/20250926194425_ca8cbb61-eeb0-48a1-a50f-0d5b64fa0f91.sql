-- Add public access policy for widget functionality
-- This allows anonymous users to view active products for the widget
CREATE POLICY "Public users can view active products for widget" 
ON public.products 
FOR SELECT 
TO anon 
USING (is_active = true);

-- Also ensure we have proper policies for authenticated users
-- (This should already exist, but let's make sure)
CREATE POLICY "Authenticated users can view products" 
ON public.products 
FOR SELECT 
TO authenticated 
USING (true);