-- Create product_addon_options table
CREATE TABLE product_addon_options (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  addon_id UUID NOT NULL REFERENCES product_addons(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  description TEXT,
  price_adjustment NUMERIC NOT NULL DEFAULT 0,
  adjustment_type TEXT NOT NULL DEFAULT 'fixed' CHECK (adjustment_type IN ('fixed', 'percentage')),
  image_url TEXT,
  display_order INTEGER NOT NULL DEFAULT 0,
  is_active BOOLEAN NOT NULL DEFAULT true,
  is_default BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Add indexes
CREATE INDEX idx_addon_options_addon_id ON product_addon_options(addon_id);
CREATE INDEX idx_addon_options_active ON product_addon_options(is_active) WHERE is_active = true;

-- Enable RLS
ALTER TABLE product_addon_options ENABLE ROW LEVEL SECURITY;

-- Contractors can view options for their addons
CREATE POLICY "Contractors can view their addon options"
  ON product_addon_options FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM product_addons pa
      JOIN products p ON p.id = pa.product_id
      WHERE pa.id = product_addon_options.addon_id
      AND p.contractor_id = get_current_contractor_id()
    )
  );

-- Contractors can insert options for their addons
CREATE POLICY "Contractors can insert their addon options"
  ON product_addon_options FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM product_addons pa
      JOIN products p ON p.id = pa.product_id
      WHERE pa.id = product_addon_options.addon_id
      AND p.contractor_id = get_current_contractor_id()
    )
  );

-- Contractors can update options for their addons
CREATE POLICY "Contractors can update their addon options"
  ON product_addon_options FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM product_addons pa
      JOIN products p ON p.id = pa.product_id
      WHERE pa.id = product_addon_options.addon_id
      AND p.contractor_id = get_current_contractor_id()
    )
  );

-- Contractors can delete options for their addons
CREATE POLICY "Contractors can delete their addon options"
  ON product_addon_options FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM product_addons pa
      JOIN products p ON p.id = pa.product_id
      WHERE pa.id = product_addon_options.addon_id
      AND p.contractor_id = get_current_contractor_id()
    )
  );