-- Drop the existing valid_unit_type constraint
ALTER TABLE public.products DROP CONSTRAINT IF EXISTS valid_unit_type;

-- Add new constraint that includes all unit types used in the ProductForm
ALTER TABLE public.products ADD CONSTRAINT valid_unit_type 
CHECK (unit_type IN ('sq_ft', 'linear_ft', 'cubic_yard', 'each', 'hour', 'pound', 'ton', 'pallet'));