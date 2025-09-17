-- Add product variations support
CREATE TABLE public.product_variations (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  product_id UUID NOT NULL REFERENCES public.products(id) ON DELETE CASCADE,
  name TEXT NOT NULL, -- e.g., "4 inch height", "6 inch height"
  description TEXT,
  price_adjustment NUMERIC NOT NULL DEFAULT 0, -- difference from base price
  adjustment_type TEXT NOT NULL DEFAULT 'fixed' CHECK (adjustment_type IN ('fixed', 'percentage')),
  display_order INTEGER DEFAULT 0,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Add photo support to products table
ALTER TABLE public.products ADD COLUMN photo_url TEXT;

-- Enhance product_addons with advanced calculation types
ALTER TABLE public.product_addons ADD COLUMN calculation_type TEXT NOT NULL DEFAULT 'total' CHECK (calculation_type IN ('total', 'per_unit', 'area_calculation'));
ALTER TABLE public.product_addons ADD COLUMN calculation_formula TEXT; -- e.g., "height * linear_ft" for stain calculation

-- Enable RLS on product_variations
ALTER TABLE public.product_variations ENABLE ROW LEVEL SECURITY;

-- Create RLS policies for product_variations
CREATE POLICY "Contractors can view their own product variations" 
ON public.product_variations 
FOR SELECT 
USING (EXISTS (
  SELECT 1 FROM public.products 
  WHERE products.id = product_variations.product_id 
  AND products.contractor_id = get_current_contractor_id()
));

CREATE POLICY "Contractors can insert their own product variations" 
ON public.product_variations 
FOR INSERT 
WITH CHECK (EXISTS (
  SELECT 1 FROM public.products 
  WHERE products.id = product_variations.product_id 
  AND products.contractor_id = get_current_contractor_id()
));

CREATE POLICY "Contractors can update their own product variations" 
ON public.product_variations 
FOR UPDATE 
USING (EXISTS (
  SELECT 1 FROM public.products 
  WHERE products.id = product_variations.product_id 
  AND products.contractor_id = get_current_contractor_id()
));

CREATE POLICY "Contractors can delete their own product variations" 
ON public.product_variations 
FOR DELETE 
USING (EXISTS (
  SELECT 1 FROM public.products 
  WHERE products.id = product_variations.product_id 
  AND products.contractor_id = get_current_contractor_id()
));

-- Create trigger for automatic timestamp updates on product_variations
CREATE TRIGGER update_product_variations_updated_at
BEFORE UPDATE ON public.product_variations
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();