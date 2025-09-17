-- Add price range and global product settings to contractor_settings table
ALTER TABLE public.contractor_settings 
ADD COLUMN use_price_ranges boolean NOT NULL DEFAULT false,
ADD COLUMN price_range_percentage numeric NOT NULL DEFAULT 15,
ADD COLUMN price_range_display_format text NOT NULL DEFAULT 'percentage',
ADD COLUMN default_unit_type text NOT NULL DEFAULT 'sq_ft',
ADD COLUMN default_product_color text NOT NULL DEFAULT '#3B82F6',
ADD COLUMN auto_activate_products boolean NOT NULL DEFAULT true,
ADD COLUMN require_product_photos boolean NOT NULL DEFAULT false,
ADD COLUMN global_tax_rate numeric NOT NULL DEFAULT 0,
ADD COLUMN global_markup_percentage numeric NOT NULL DEFAULT 0,
ADD COLUMN currency_symbol text NOT NULL DEFAULT '$',
ADD COLUMN decimal_precision integer NOT NULL DEFAULT 2;

-- Create product_categories table
CREATE TABLE public.product_categories (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  contractor_id uuid REFERENCES public.contractors(id) NOT NULL,
  name text NOT NULL,
  display_order integer NOT NULL DEFAULT 0,
  color_hex text NOT NULL DEFAULT '#3B82F6',
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

-- Create product_subcategories table  
CREATE TABLE public.product_subcategories (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  category_id uuid REFERENCES public.product_categories(id) ON DELETE CASCADE NOT NULL,
  name text NOT NULL,
  display_order integer NOT NULL DEFAULT 0,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

-- Enable RLS on new tables
ALTER TABLE public.product_categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.product_subcategories ENABLE ROW LEVEL SECURITY;

-- Create RLS policies for product_categories
CREATE POLICY "Contractors can view their own categories" 
ON public.product_categories 
FOR SELECT 
USING (contractor_id = get_current_contractor_id());

CREATE POLICY "Contractors can insert their own categories" 
ON public.product_categories 
FOR INSERT 
WITH CHECK (contractor_id = get_current_contractor_id());

CREATE POLICY "Contractors can update their own categories" 
ON public.product_categories 
FOR UPDATE 
USING (contractor_id = get_current_contractor_id());

CREATE POLICY "Contractors can delete their own categories" 
ON public.product_categories 
FOR DELETE 
USING (contractor_id = get_current_contractor_id());

-- Create RLS policies for product_subcategories
CREATE POLICY "Contractors can view their own subcategories" 
ON public.product_subcategories 
FOR SELECT 
USING (EXISTS (
  SELECT 1 FROM public.product_categories 
  WHERE product_categories.id = product_subcategories.category_id 
  AND product_categories.contractor_id = get_current_contractor_id()
));

CREATE POLICY "Contractors can insert their own subcategories" 
ON public.product_subcategories 
FOR INSERT 
WITH CHECK (EXISTS (
  SELECT 1 FROM public.product_categories 
  WHERE product_categories.id = product_subcategories.category_id 
  AND product_categories.contractor_id = get_current_contractor_id()
));

CREATE POLICY "Contractors can update their own subcategories" 
ON public.product_subcategories 
FOR UPDATE 
USING (EXISTS (
  SELECT 1 FROM public.product_categories 
  WHERE product_categories.id = product_subcategories.category_id 
  AND product_categories.contractor_id = get_current_contractor_id()
));

CREATE POLICY "Contractors can delete their own subcategories" 
ON public.product_subcategories 
FOR DELETE 
USING (EXISTS (
  SELECT 1 FROM public.product_categories 
  WHERE product_categories.id = product_subcategories.category_id 
  AND product_categories.contractor_id = get_current_contractor_id()
));

-- Add triggers for updated_at columns
CREATE TRIGGER update_product_categories_updated_at
BEFORE UPDATE ON public.product_categories
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_product_subcategories_updated_at
BEFORE UPDATE ON public.product_subcategories
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- Insert default categories for existing contractors
INSERT INTO public.product_categories (contractor_id, name, display_order, color_hex)
SELECT 
  c.id,
  category_name,
  category_order,
  category_color
FROM public.contractors c
CROSS JOIN (
  VALUES 
    ('Fencing', 1, '#10B981'),
    ('Flooring', 2, '#3B82F6'), 
    ('Roofing', 3, '#EF4444'),
    ('Siding', 4, '#F59E0B'),
    ('Landscaping', 5, '#22C55E'),
    ('Painting', 6, '#8B5CF6'),
    ('Electrical', 7, '#F97316'),
    ('Plumbing', 8, '#06B6D4'),
    ('HVAC', 9, '#84CC16'),
    ('General Contracting', 10, '#6B7280')
) AS defaults(category_name, category_order, category_color);

-- Insert default subcategories
INSERT INTO public.product_subcategories (category_id, name, display_order)
SELECT 
  pc.id,
  sub_name,
  sub_order
FROM public.product_categories pc
CROSS JOIN (
  VALUES 
    ('Fencing', 'Wood Fence', 1),
    ('Fencing', 'Chain Link', 2),
    ('Fencing', 'Vinyl Fence', 3),
    ('Fencing', 'Metal Fence', 4),
    ('Flooring', 'Hardwood', 1),
    ('Flooring', 'Laminate', 2),
    ('Flooring', 'Tile', 3),
    ('Flooring', 'Carpet', 4),
    ('Roofing', 'Shingle', 1),
    ('Roofing', 'Metal', 2),
    ('Roofing', 'Tile', 3),
    ('Roofing', 'Flat', 4)
) AS subs(parent_name, sub_name, sub_order)
WHERE pc.name = subs.parent_name;