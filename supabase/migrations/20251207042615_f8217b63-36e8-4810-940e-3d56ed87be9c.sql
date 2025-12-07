-- Remove the redundant allow_addon_map_placement column from products table
-- Map placement is now controlled solely at the per-add-on level via product_addons.allow_map_placement

ALTER TABLE public.products DROP COLUMN IF EXISTS allow_addon_map_placement;