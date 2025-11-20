-- Add allow_map_placement column to product_addons table
-- This enables per-addon control for map placement in the widget
ALTER TABLE public.product_addons 
ADD COLUMN allow_map_placement boolean NOT NULL DEFAULT false;

COMMENT ON COLUMN public.product_addons.allow_map_placement IS 'If true, this add-on can be placed as individual locations on the map in the widget (requires product-level allow_addon_map_placement to also be true)';
