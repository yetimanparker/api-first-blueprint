-- Add minimum order quantity column to products table
ALTER TABLE public.products 
ADD COLUMN min_order_quantity numeric NOT NULL DEFAULT 1;