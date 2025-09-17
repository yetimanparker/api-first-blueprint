-- Add category and subcategory columns to products table
ALTER TABLE public.products 
ADD COLUMN category text,
ADD COLUMN subcategory text;

-- Add indexes for better filtering performance
CREATE INDEX idx_products_category ON public.products(category);
CREATE INDEX idx_products_subcategory ON public.products(subcategory);
CREATE INDEX idx_products_category_subcategory ON public.products(category, subcategory);