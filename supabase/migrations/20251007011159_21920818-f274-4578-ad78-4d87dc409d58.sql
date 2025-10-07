-- Remove the anonymous RLS policies that are causing conflicts
DROP POLICY IF EXISTS "Anonymous users can create customers via widget" ON public.customers;
DROP POLICY IF EXISTS "Anonymous users can create quotes via widget" ON public.quotes;
DROP POLICY IF EXISTS "Anonymous users can create quote items via widget" ON public.quote_items;