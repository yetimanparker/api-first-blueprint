-- Add input_mode column to product_addons table
-- Values: 'toggle' (simple on/off), 'quantity' (use +/- controls)
ALTER TABLE public.product_addons 
ADD COLUMN input_mode text NOT NULL DEFAULT 'quantity';

-- Add a check constraint to ensure only valid values
ALTER TABLE public.product_addons 
ADD CONSTRAINT product_addons_input_mode_check 
CHECK (input_mode IN ('toggle', 'quantity'));