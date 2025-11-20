-- Add show_in_widget_selector column to products table
ALTER TABLE public.products 
ADD COLUMN show_in_widget_selector boolean NOT NULL DEFAULT true;

-- Add comment for documentation
COMMENT ON COLUMN public.products.show_in_widget_selector IS 'Controls whether product appears in widget main product selector. When false, product can only be accessed as an add-on.';