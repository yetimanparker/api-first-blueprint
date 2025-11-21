-- Add parent_quote_item_id column to track add-on relationships
ALTER TABLE quote_items 
ADD COLUMN parent_quote_item_id uuid REFERENCES quote_items(id) ON DELETE CASCADE;

-- Add index for performance when querying parent-child relationships
CREATE INDEX idx_quote_items_parent_id ON quote_items(parent_quote_item_id);

-- Add comment for documentation
COMMENT ON COLUMN quote_items.parent_quote_item_id IS 'Links map-placed add-ons to their parent product item. NULL for main products and traditional add-ons.';