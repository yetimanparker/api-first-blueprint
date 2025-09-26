-- Set up comprehensive contractor settings for testing
INSERT INTO contractor_settings (
  contractor_id,
  default_unit_type,
  currency_symbol,
  global_markup_percentage,
  global_tax_rate,
  decimal_precision,
  use_price_ranges,
  price_range_percentage,
  pricing_visibility,
  contact_capture_timing,
  require_email,
  require_phone,
  require_address,
  service_area_enabled,
  service_area_method,
  service_area_center_lat,
  service_area_center_lng,
  service_area_radius_miles,
  widget_theme_color,
  default_product_color
) VALUES (
  'd8d7917f-e7a5-4cdd-8498-ad690290b06d',
  'sq_ft',
  '$',
  15.0,
  8.5,
  2,
  true,
  20.0,
  'before_submit',
  'before_quote',
  true,
  true,
  true,
  true,
  'radius',
  40.7128,
  -74.0060,
  25,
  '#10B981',
  '#3B82F6'
)
ON CONFLICT (contractor_id) DO UPDATE SET
  default_unit_type = EXCLUDED.default_unit_type,
  currency_symbol = EXCLUDED.currency_symbol,
  global_markup_percentage = EXCLUDED.global_markup_percentage,
  global_tax_rate = EXCLUDED.global_tax_rate,
  decimal_precision = EXCLUDED.decimal_precision,
  use_price_ranges = EXCLUDED.use_price_ranges,
  price_range_percentage = EXCLUDED.price_range_percentage,
  pricing_visibility = EXCLUDED.pricing_visibility,
  contact_capture_timing = EXCLUDED.contact_capture_timing,
  require_email = EXCLUDED.require_email,
  require_phone = EXCLUDED.require_phone,
  require_address = EXCLUDED.require_address,
  service_area_enabled = EXCLUDED.service_area_enabled,
  service_area_method = EXCLUDED.service_area_method,
  service_area_center_lat = EXCLUDED.service_area_center_lat,
  service_area_center_lng = EXCLUDED.service_area_center_lng,
  service_area_radius_miles = EXCLUDED.service_area_radius_miles,
  widget_theme_color = EXCLUDED.widget_theme_color,
  default_product_color = EXCLUDED.default_product_color,
  updated_at = now();

-- Clear existing test products for this contractor
DELETE FROM products WHERE contractor_id = 'd8d7917f-e7a5-4cdd-8498-ad690290b06d';

-- Add comprehensive products for outdoor contractor testing
INSERT INTO products (contractor_id, name, description, unit_type, unit_price, color_hex, category, is_active, min_order_quantity, use_tiered_pricing, show_pricing_before_submit) VALUES
-- Fencing Products
('d8d7917f-e7a5-4cdd-8498-ad690290b06d', 'Chain Link Fence Installation', 'Galvanized chain link fencing with posts and hardware included', 'linear_ft', 25.50, '#8B7355', 'Fencing', true, 50, true, true),
('d8d7917f-e7a5-4cdd-8498-ad690290b06d', 'Wood Privacy Fence', 'Cedar privacy fence with 6ft panels and professional installation', 'linear_ft', 45.00, '#D2691E', 'Fencing', true, 25, false, true),
('d8d7917f-e7a5-4cdd-8498-ad690290b06d', 'Vinyl Fence Installation', 'Low-maintenance vinyl fencing in white or tan finish', 'linear_ft', 55.75, '#F5F5DC', 'Fencing', true, 20, false, true),
('d8d7917f-e7a5-4cdd-8498-ad690290b06d', 'Aluminum Decorative Fence', 'Powder-coated aluminum fence with decorative pickets', 'linear_ft', 65.00, '#C0C0C0', 'Fencing', true, 15, false, true),

-- Landscaping Products  
('d8d7917f-e7a5-4cdd-8498-ad690290b06d', 'Sod Installation', 'Premium Kentucky bluegrass sod with soil preparation', 'sq_ft', 2.25, '#228B22', 'Landscaping', true, 100, true, true),
('d8d7917f-e7a5-4cdd-8498-ad690290b06d', 'Mulch Installation', 'Organic bark mulch delivered and spread professionally', 'cubic_yard', 85.00, '#8B4513', 'Landscaping', true, 3, false, true),
('d8d7917f-e7a5-4cdd-8498-ad690290b06d', 'Paver Patio Installation', 'Interlocking concrete pavers with sand base preparation', 'sq_ft', 18.50, '#CD853F', 'Landscaping', true, 50, true, true),
('d8d7917f-e7a5-4cdd-8498-ad690290b06d', 'Retaining Wall Construction', 'Segmental block retaining wall with proper drainage', 'sq_ft', 35.00, '#696969', 'Landscaping', true, 25, false, true),

-- Roofing Products
('d8d7917f-e7a5-4cdd-8498-ad690290b06d', 'Asphalt Shingle Replacement', 'Architectural shingles with 30-year warranty', 'sq_ft', 8.75, '#2F4F4F', 'Roofing', true, 200, true, true),
('d8d7917f-e7a5-4cdd-8498-ad690290b06d', 'Metal Roof Installation', 'Standing seam metal roofing system', 'sq_ft', 12.50, '#708090', 'Roofing', true, 150, false, true),
('d8d7917f-e7a5-4cdd-8498-ad690290b06d', 'Roof Repair Service', 'Professional roof leak repair and maintenance', 'each', 350.00, '#8B0000', 'Roofing', true, 1, false, true),

-- Siding Products
('d8d7917f-e7a5-4cdd-8498-ad690290b06d', 'Vinyl Siding Installation', 'Insulated vinyl siding with house wrap', 'sq_ft', 6.25, '#F0F8FF', 'Siding', true, 100, true, true),
('d8d7917f-e7a5-4cdd-8498-ad690290b06d', 'Fiber Cement Siding', 'Durable fiber cement siding with 50-year warranty', 'sq_ft', 9.50, '#DCDCDC', 'Siding', true, 75, false, true),
('d8d7917f-e7a5-4cdd-8498-ad690290b06d', 'Wood Siding Installation', 'Cedar lap siding with professional staining', 'sq_ft', 11.75, '#DEB887', 'Siding', true, 50, false, true),

-- Lawn Care Products
('d8d7917f-e7a5-4cdd-8498-ad690290b06d', 'Lawn Mowing Service', 'Weekly lawn mowing and edging service', 'sq_ft', 0.025, '#32CD32', 'Lawn Care', true, 1000, true, true),
('d8d7917f-e7a5-4cdd-8498-ad690290b06d', 'Fertilization Program', '4-step lawn fertilization and weed control program', 'sq_ft', 0.15, '#7CFC00', 'Lawn Care', true, 500, false, true),
('d8d7917f-e7a5-4cdd-8498-ad690290b06d', 'Core Aeration Service', 'Professional lawn aeration and overseeding', 'sq_ft', 0.08, '#9ACD32', 'Lawn Care', true, 1000, false, true);