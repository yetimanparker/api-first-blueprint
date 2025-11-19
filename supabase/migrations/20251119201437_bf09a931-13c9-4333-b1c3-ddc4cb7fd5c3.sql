-- Add linked_product_id column to product_addons table
ALTER TABLE public.product_addons
ADD COLUMN linked_product_id uuid REFERENCES public.products(id) ON DELETE SET NULL;

-- Add index for better query performance
CREATE INDEX idx_product_addons_linked_product ON public.product_addons(linked_product_id);

-- Add comment to document the column
COMMENT ON COLUMN public.product_addons.linked_product_id IS 'Optional reference to a product that this add-on is linked to. When set, the add-on pulls details from the linked product.';