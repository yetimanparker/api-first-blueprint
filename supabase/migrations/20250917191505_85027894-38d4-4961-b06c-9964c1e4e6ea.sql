-- Add cubic foot support and pricing visibility to products table
ALTER TABLE public.products 
ADD COLUMN show_pricing_before_submit BOOLEAN NOT NULL DEFAULT true;

-- Update unit_type enum to include cubic feet
ALTER TABLE public.products 
ALTER COLUMN unit_type TYPE text;

-- Add check constraint for valid unit types
ALTER TABLE public.products 
ADD CONSTRAINT valid_unit_type CHECK (unit_type IN ('sq_ft', 'linear_ft', 'cu_ft', 'each'));

-- Create product_addons table
CREATE TABLE public.product_addons (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  product_id UUID NOT NULL REFERENCES public.products(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  description TEXT,
  price_type TEXT NOT NULL CHECK (price_type IN ('fixed', 'percentage')),
  price_value NUMERIC NOT NULL CHECK (price_value >= 0),
  display_order INTEGER DEFAULT 0,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS on product_addons
ALTER TABLE public.product_addons ENABLE ROW LEVEL SECURITY;

-- Create RLS policies for product_addons
CREATE POLICY "Contractors can view their own product addons" 
ON public.product_addons 
FOR SELECT 
USING (EXISTS (
  SELECT 1 FROM public.products 
  WHERE products.id = product_addons.product_id 
  AND products.contractor_id = get_current_contractor_id()
));

CREATE POLICY "Contractors can insert their own product addons" 
ON public.product_addons 
FOR INSERT 
WITH CHECK (EXISTS (
  SELECT 1 FROM public.products 
  WHERE products.id = product_addons.product_id 
  AND products.contractor_id = get_current_contractor_id()
));

CREATE POLICY "Contractors can update their own product addons" 
ON public.product_addons 
FOR UPDATE 
USING (EXISTS (
  SELECT 1 FROM public.products 
  WHERE products.id = product_addons.product_id 
  AND products.contractor_id = get_current_contractor_id()
));

CREATE POLICY "Contractors can delete their own product addons" 
ON public.product_addons 
FOR DELETE 
USING (EXISTS (
  SELECT 1 FROM public.products 
  WHERE products.id = product_addons.product_id 
  AND products.contractor_id = get_current_contractor_id()
));

-- Create contractor_settings table
CREATE TABLE public.contractor_settings (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  contractor_id UUID NOT NULL REFERENCES public.contractors(id) ON DELETE CASCADE UNIQUE,
  pricing_visibility TEXT NOT NULL DEFAULT 'before_submit' CHECK (pricing_visibility IN ('before_submit', 'after_submit')),
  contact_capture_timing TEXT NOT NULL DEFAULT 'before_quote' CHECK (contact_capture_timing IN ('before_quote', 'on_submit', 'optional')),
  require_phone BOOLEAN NOT NULL DEFAULT true,
  require_address BOOLEAN NOT NULL DEFAULT true,
  require_email BOOLEAN NOT NULL DEFAULT true,
  widget_theme_color TEXT DEFAULT '#3B82F6',
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS on contractor_settings
ALTER TABLE public.contractor_settings ENABLE ROW LEVEL SECURITY;

-- Create RLS policies for contractor_settings
CREATE POLICY "Contractors can view their own settings" 
ON public.contractor_settings 
FOR SELECT 
USING (contractor_id = get_current_contractor_id());

CREATE POLICY "Contractors can insert their own settings" 
ON public.contractor_settings 
FOR INSERT 
WITH CHECK (contractor_id = get_current_contractor_id());

CREATE POLICY "Contractors can update their own settings" 
ON public.contractor_settings 
FOR UPDATE 
USING (contractor_id = get_current_contractor_id());

-- Add trigger for updated_at on product_addons
CREATE TRIGGER update_product_addons_updated_at
BEFORE UPDATE ON public.product_addons
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- Add trigger for updated_at on contractor_settings
CREATE TRIGGER update_contractor_settings_updated_at
BEFORE UPDATE ON public.contractor_settings
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- Create indexes for better performance
CREATE INDEX idx_product_addons_product_id ON public.product_addons(product_id);
CREATE INDEX idx_product_addons_display_order ON public.product_addons(product_id, display_order);
CREATE INDEX idx_contractor_settings_contractor_id ON public.contractor_settings(contractor_id);