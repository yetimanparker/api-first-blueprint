-- Allow anonymous users to insert customers via widget
CREATE POLICY "Anonymous users can create customers via widget"
ON public.customers
FOR INSERT
TO anon
WITH CHECK (
  contractor_id IS NOT NULL
  AND EXISTS (
    SELECT 1 FROM public.contractors 
    WHERE id = contractor_id
  )
);

-- Allow anonymous users to insert quotes via widget
CREATE POLICY "Anonymous users can create quotes via widget"
ON public.quotes
FOR INSERT
TO anon
WITH CHECK (
  contractor_id IS NOT NULL
  AND customer_id IS NOT NULL
  AND EXISTS (
    SELECT 1 FROM public.contractors 
    WHERE id = contractor_id
  )
  AND EXISTS (
    SELECT 1 FROM public.customers 
    WHERE id = customer_id
  )
);

-- Allow anonymous users to insert quote items via widget
CREATE POLICY "Anonymous users can create quote items via widget"
ON public.quote_items
FOR INSERT
TO anon
WITH CHECK (
  quote_id IS NOT NULL
  AND product_id IS NOT NULL
  AND EXISTS (
    SELECT 1 FROM public.quotes 
    WHERE id = quote_id
  )
);