-- Add variations_required column to products table
ALTER TABLE public.products ADD COLUMN variations_required boolean DEFAULT false;