-- Add use_tiered_pricing column to products table
ALTER TABLE public.products 
ADD COLUMN use_tiered_pricing boolean NOT NULL DEFAULT false;

-- Create product_pricing_tiers table
CREATE TABLE public.product_pricing_tiers (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  product_id uuid NOT NULL REFERENCES public.products(id) ON DELETE CASCADE,
  contractor_id uuid NOT NULL,
  tier_name text NOT NULL,
  min_quantity numeric NOT NULL CHECK (min_quantity > 0),
  max_quantity numeric CHECK (max_quantity IS NULL OR max_quantity > min_quantity),
  tier_price numeric NOT NULL CHECK (tier_price >= 0),
  is_active boolean NOT NULL DEFAULT true,
  display_order integer NOT NULL DEFAULT 0,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  UNIQUE(product_id, min_quantity),
  UNIQUE(product_id, max_quantity) WHERE max_quantity IS NOT NULL
);

-- Enable RLS on product_pricing_tiers
ALTER TABLE public.product_pricing_tiers ENABLE ROW LEVEL SECURITY;

-- Create RLS policies for product_pricing_tiers
CREATE POLICY "Contractors can view their own product pricing tiers" 
ON public.product_pricing_tiers 
FOR SELECT 
USING (contractor_id = get_current_contractor_id());

CREATE POLICY "Contractors can insert their own product pricing tiers" 
ON public.product_pricing_tiers 
FOR INSERT 
WITH CHECK (contractor_id = get_current_contractor_id());

CREATE POLICY "Contractors can update their own product pricing tiers" 
ON public.product_pricing_tiers 
FOR UPDATE 
USING (contractor_id = get_current_contractor_id());

CREATE POLICY "Contractors can delete their own product pricing tiers" 
ON public.product_pricing_tiers 
FOR DELETE 
USING (contractor_id = get_current_contractor_id());

-- Create trigger for automatic timestamp updates
CREATE TRIGGER update_product_pricing_tiers_updated_at
BEFORE UPDATE ON public.product_pricing_tiers
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();