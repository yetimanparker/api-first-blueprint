-- Add height and measurement fields to product_variations table
ALTER TABLE public.product_variations 
ADD COLUMN height_value numeric DEFAULT NULL,
ADD COLUMN unit_of_measurement text DEFAULT 'ft',
ADD COLUMN affects_area_calculation boolean DEFAULT false;

-- Add comment to clarify the purpose of these fields
COMMENT ON COLUMN public.product_variations.height_value IS 'Height value for the variation (e.g., 6, 8 for fence heights)';
COMMENT ON COLUMN public.product_variations.unit_of_measurement IS 'Unit of measurement for height (ft, inches, m, etc.)';
COMMENT ON COLUMN public.product_variations.affects_area_calculation IS 'Whether this variation affects area calculations for add-ons';