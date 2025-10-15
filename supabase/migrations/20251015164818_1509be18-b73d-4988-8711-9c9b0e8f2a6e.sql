-- Add dimension fields to products table for predefined dimensional products
ALTER TABLE public.products
ADD COLUMN has_fixed_dimensions boolean NOT NULL DEFAULT false,
ADD COLUMN default_width numeric,
ADD COLUMN default_length numeric,
ADD COLUMN dimension_unit text DEFAULT 'ft',
ADD COLUMN allow_dimension_editing boolean DEFAULT false;

-- Add comment explaining the new columns
COMMENT ON COLUMN public.products.has_fixed_dimensions IS 'Whether this product has predefined dimensions (e.g., pickleball court, pool)';
COMMENT ON COLUMN public.products.default_width IS 'Default width in feet for dimensional products';
COMMENT ON COLUMN public.products.default_length IS 'Default length in feet for dimensional products';
COMMENT ON COLUMN public.products.dimension_unit IS 'Unit of measurement for dimensions (default: ft)';
COMMENT ON COLUMN public.products.allow_dimension_editing IS 'Whether customers can adjust the dimensions in the widget';