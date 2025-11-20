-- Update existing measurement tool products to use welcome@birdseyepro.com images
UPDATE public.products
SET photo_url = 'https://aiwwquousyzdkagporcy.supabase.co/storage/v1/object/public/product-photos/8843d0d8-2c76-44c6-8af9-248e7c2e6616/1763579686020.png'
WHERE unit_type = 'linear_ft'
  AND name = 'Linear Foot Tool';

UPDATE public.products
SET photo_url = 'https://aiwwquousyzdkagporcy.supabase.co/storage/v1/object/public/product-photos/8843d0d8-2c76-44c6-8af9-248e7c2e6616/1763578820610.png'
WHERE unit_type = 'sq_ft'
  AND name = 'Square Foot Tool';

UPDATE public.products
SET photo_url = 'https://aiwwquousyzdkagporcy.supabase.co/storage/v1/object/public/product-photos/8843d0d8-2c76-44c6-8af9-248e7c2e6616/1763579929368.png'
WHERE unit_type = 'cubic_yard'
  AND name = 'Cubic Yard Tool';

-- Update handle_new_user to use the same image URLs for all future contractors
CREATE OR REPLACE FUNCTION public.handle_new_user()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  new_contractor_id uuid;
  
  -- Category IDs
  landscaping_category_id uuid;
  hardscaping_category_id uuid;
  concrete_category_id uuid;
  fencing_category_id uuid;
  tree_services_category_id uuid;
  lawn_care_category_id uuid;
  irrigation_category_id uuid;
  drainage_category_id uuid;
  lighting_category_id uuid;
  pressure_washing_category_id uuid;
  gutters_category_id uuid;
  additional_services_category_id uuid;
  measurement_tools_category_id uuid;
  
  -- Subcategory IDs for sample products
  soil_subcategory_id uuid;
  wood_fence_subcategory_id uuid;
  
  -- Sample product IDs
  sod_product_id uuid;
  topsoil_product_id uuid;
  fence_product_id uuid;
  tree_product_id uuid;
  linear_tool_id uuid;
  square_tool_id uuid;
  cubic_tool_id uuid;
BEGIN
  -- Create profile entry
  INSERT INTO public.profiles (user_id, first_name, last_name)
  VALUES (
    NEW.id,
    NEW.raw_user_meta_data ->> 'first_name',
    NEW.raw_user_meta_data ->> 'last_name'
  );

  -- Create contractor entry if business_name is provided
  IF NEW.raw_user_meta_data ->> 'business_name' IS NOT NULL THEN
    INSERT INTO public.contractors (
      user_id, 
      business_name, 
      email, 
      brand_color, 
      secondary_color
    )
    VALUES (
      NEW.id,
      NEW.raw_user_meta_data ->> 'business_name',
      NEW.email,
      '#3B82F6',
      '#64748B'
    )
    RETURNING id INTO new_contractor_id;
    
    -- Create default contractor settings
    INSERT INTO public.contractor_settings (
      contractor_id,
      service_area_enabled,
      require_phone,
      require_address,
      require_email,
      contact_capture_timing,
      pricing_visibility,
      auto_activate_products
    )
    VALUES (
      new_contractor_id,
      false,
      true,
      true,
      true,
      'before_quote',
      'before_submit',
      true
    );
    
    -- ========================================
    -- CREATE CATEGORIES
    -- ========================================
    
    -- 1. Landscaping
    INSERT INTO public.product_categories (contractor_id, name, color_hex, display_order, is_active)
    VALUES (new_contractor_id, 'Landscaping', '#228B22', 0, true)
    RETURNING id INTO landscaping_category_id;
    
    -- 2. Hardscaping
    INSERT INTO public.product_categories (contractor_id, name, color_hex, display_order, is_active)
    VALUES (new_contractor_id, 'Hardscaping', '#8B4513', 1, true)
    RETURNING id INTO hardscaping_category_id;
    
    -- 3. Concrete
    INSERT INTO public.product_categories (contractor_id, name, color_hex, display_order, is_active)
    VALUES (new_contractor_id, 'Concrete', '#808080', 2, true)
    RETURNING id INTO concrete_category_id;
    
    -- 4. Fencing
    INSERT INTO public.product_categories (contractor_id, name, color_hex, display_order, is_active)
    VALUES (new_contractor_id, 'Fencing', '#D2691E', 3, true)
    RETURNING id INTO fencing_category_id;
    
    -- 5. Tree Services
    INSERT INTO public.product_categories (contractor_id, name, color_hex, display_order, is_active)
    VALUES (new_contractor_id, 'Tree Services', '#2D5016', 4, true)
    RETURNING id INTO tree_services_category_id;
    
    -- 6. Lawn Care & Maintenance
    INSERT INTO public.product_categories (contractor_id, name, color_hex, display_order, is_active)
    VALUES (new_contractor_id, 'Lawn Care & Maintenance', '#32CD32', 5, true)
    RETURNING id INTO lawn_care_category_id;
    
    -- 7. Irrigation
    INSERT INTO public.product_categories (contractor_id, name, color_hex, display_order, is_active)
    VALUES (new_contractor_id, 'Irrigation', '#4169E1', 6, true)
    RETURNING id INTO irrigation_category_id;
    
    -- 8. Drainage Solutions
    INSERT INTO public.product_categories (contractor_id, name, color_hex, display_order, is_active)
    VALUES (new_contractor_id, 'Drainage Solutions', '#1E90FF', 7, true)
    RETURNING id INTO drainage_category_id;
    
    -- 9. Outdoor Lighting
    INSERT INTO public.product_categories (contractor_id, name, color_hex, display_order, is_active)
    VALUES (new_contractor_id, 'Outdoor Lighting', '#FFD700', 8, true)
    RETURNING id INTO lighting_category_id;
    
    -- 10. Pressure Washing
    INSERT INTO public.product_categories (contractor_id, name, color_hex, display_order, is_active)
    VALUES (new_contractor_id, 'Pressure Washing', '#00CED1', 9, true)
    RETURNING id INTO pressure_washing_category_id;
    
    -- 11. Gutters & Downspouts
    INSERT INTO public.product_categories (contractor_id, name, color_hex, display_order, is_active)
    VALUES (new_contractor_id, 'Gutters & Downspouts', '#696969', 10, true)
    RETURNING id INTO gutters_category_id;
    
    -- 12. Additional Services
    INSERT INTO public.product_categories (contractor_id, name, color_hex, display_order, is_active)
    VALUES (new_contractor_id, 'Additional Services', '#9370DB', 11, true)
    RETURNING id INTO additional_services_category_id;
    
    -- 13. Measurement Tools
    INSERT INTO public.product_categories (contractor_id, name, color_hex, display_order, is_active)
    VALUES (new_contractor_id, 'Measurement Tools', '#FF6B6B', 12, true)
    RETURNING id INTO measurement_tools_category_id;
    
    -- ========================================
    -- CREATE SUBCATEGORIES
    -- ========================================
    
    -- Landscaping subcategories
    INSERT INTO public.product_subcategories (category_id, name, display_order, is_active)
    VALUES 
      (landscaping_category_id, 'Soil & Materials', 0, true),
      (landscaping_category_id, 'Plants & Shrubs', 1, true),
      (landscaping_category_id, 'Turf & Sod', 2, true),
      (landscaping_category_id, 'Garden Beds', 3, true),
      (landscaping_category_id, 'Landscape Design', 4, true);
    
    -- Store Soil subcategory ID for sample product
    SELECT id INTO soil_subcategory_id FROM public.product_subcategories 
    WHERE category_id = landscaping_category_id AND name = 'Soil & Materials';
    
    -- Hardscaping subcategories
    INSERT INTO public.product_subcategories (category_id, name, display_order, is_active)
    VALUES 
      (hardscaping_category_id, 'Pavers & Walkways', 0, true),
      (hardscaping_category_id, 'Retaining Walls', 1, true),
      (hardscaping_category_id, 'Patios & Decks', 2, true),
      (hardscaping_category_id, 'Stone Work', 3, true),
      (hardscaping_category_id, 'Outdoor Kitchens', 4, true);
    
    -- Concrete subcategories
    INSERT INTO public.product_subcategories (category_id, name, display_order, is_active)
    VALUES 
      (concrete_category_id, 'Driveways', 0, true),
      (concrete_category_id, 'Sidewalks & Walkways', 1, true),
      (concrete_category_id, 'Patios', 2, true),
      (concrete_category_id, 'Foundations', 3, true),
      (concrete_category_id, 'Stamped/Decorative', 4, true);
    
    -- Fencing subcategories
    INSERT INTO public.product_subcategories (category_id, name, display_order, is_active)
    VALUES 
      (fencing_category_id, 'Wood Fence', 0, true),
      (fencing_category_id, 'Vinyl Fence', 1, true),
      (fencing_category_id, 'Chain Link', 2, true),
      (fencing_category_id, 'Aluminum Fence', 3, true),
      (fencing_category_id, 'Gate Installation', 4, true);
    
    -- Store Wood Fence subcategory ID for sample product
    SELECT id INTO wood_fence_subcategory_id FROM public.product_subcategories 
    WHERE category_id = fencing_category_id AND name = 'Wood Fence';
    
    -- Tree Services subcategories
    INSERT INTO public.product_subcategories (category_id, name, display_order, is_active)
    VALUES 
      (tree_services_category_id, 'Tree Planting', 0, true),
      (tree_services_category_id, 'Tree Removal', 1, true),
      (tree_services_category_id, 'Stump Grinding', 2, true);
    
    -- Lawn Care & Maintenance subcategories
    INSERT INTO public.product_subcategories (category_id, name, display_order, is_active)
    VALUES 
      (lawn_care_category_id, 'Mowing & Trimming', 0, true),
      (lawn_care_category_id, 'Fertilization & Weed Control', 1, true),
      (lawn_care_category_id, 'Aeration & Overseeding', 2, true),
      (lawn_care_category_id, 'Seasonal Cleanup', 3, true);
    
    -- Irrigation subcategories
    INSERT INTO public.product_subcategories (category_id, name, display_order, is_active)
    VALUES 
      (irrigation_category_id, 'Sprinkler Systems', 0, true),
      (irrigation_category_id, 'Drip Irrigation', 1, true),
      (irrigation_category_id, 'Backflow Testing', 2, true),
      (irrigation_category_id, 'System Repairs', 3, true);
    
    -- Drainage Solutions subcategories
    INSERT INTO public.product_subcategories (category_id, name, display_order, is_active)
    VALUES 
      (drainage_category_id, 'French Drains', 0, true),
      (drainage_category_id, 'Catch Basins', 1, true),
      (drainage_category_id, 'Grading & Erosion Control', 2, true),
      (drainage_category_id, 'Dry Wells', 3, true);
    
    -- Outdoor Lighting subcategories
    INSERT INTO public.product_subcategories (category_id, name, display_order, is_active)
    VALUES 
      (lighting_category_id, 'Path & Walkway Lighting', 0, true),
      (lighting_category_id, 'Accent Lighting', 1, true),
      (lighting_category_id, 'Security Lighting', 2, true),
      (lighting_category_id, 'Low Voltage Systems', 3, true);
    
    -- Pressure Washing subcategories
    INSERT INTO public.product_subcategories (category_id, name, display_order, is_active)
    VALUES 
      (pressure_washing_category_id, 'Driveways & Sidewalks', 0, true),
      (pressure_washing_category_id, 'Decks & Patios', 1, true),
      (pressure_washing_category_id, 'Siding & Exterior Walls', 2, true),
      (pressure_washing_category_id, 'Roof Cleaning', 3, true);
    
    -- Gutters & Downspouts subcategories
    INSERT INTO public.product_subcategories (category_id, name, display_order, is_active)
    VALUES 
      (gutters_category_id, 'Gutter Installation', 0, true),
      (gutters_category_id, 'Gutter Cleaning & Repair', 1, true),
      (gutters_category_id, 'Downspout Installation', 2, true),
      (gutters_category_id, 'Gutter Guards', 3, true);
    
    -- Additional Services subcategories
    INSERT INTO public.product_subcategories (category_id, name, display_order, is_active)
    VALUES 
      (additional_services_category_id, 'Snow Removal', 0, true),
      (additional_services_category_id, 'Outdoor Structures', 1, true),
      (additional_services_category_id, 'Water Features', 2, true),
      (additional_services_category_id, 'Masonry & Brickwork', 3, true);
    
    -- ========================================
    -- CREATE SAMPLE PRODUCTS
    -- ========================================
    
    -- Product 1: Sod Installation with Compost add-on
    INSERT INTO public.products (
      contractor_id, 
      name, 
      description, 
      unit_type, 
      unit_price, 
      color_hex, 
      category, 
      is_active, 
      min_order_quantity,
      show_pricing_before_submit,
      display_order,
      photo_url
    )
    VALUES (
      new_contractor_id, 
      'Sod Installation', 
      'Premium sod installation service for residential and commercial properties', 
      'sq_ft', 
      2.50, 
      '#228B22', 
      'Landscaping',
      true, 
      100,
      true,
      0,
      'https://aiwwquousyzdkagporcy.supabase.co/storage/v1/object/public/product-photos/defaults/sod.jpg'
    )
    RETURNING id INTO sod_product_id;
    
    -- Add Compost add-on for Sod Installation
    INSERT INTO public.product_addons (
      product_id, 
      name, 
      description, 
      price_type, 
      price_value,
      calculation_type, 
      display_order, 
      is_active
    )
    VALUES (
      sod_product_id, 
      'Compost', 
      'Organic compost for soil enrichment', 
      'fixed', 
      1.00,
      'per_unit', 
      0, 
      true
    );
    
    -- Product 2: Premium Topsoil Mix with Delivery add-on (linked to Soil subcategory)
    INSERT INTO public.products (
      contractor_id, 
      name, 
      description, 
      unit_type, 
      unit_price, 
      color_hex, 
      category,
      subcategory,
      is_active, 
      min_order_quantity,
      show_pricing_before_submit,
      display_order,
      photo_url
    )
    VALUES (
      new_contractor_id, 
      'Premium Topsoil Mix', 
      'High-quality topsoil blend perfect for landscaping and gardening projects', 
      'cubic_yard', 
      45.00, 
      '#8B4513', 
      'Landscaping',
      'Soil & Materials',
      true, 
      1,
      true,
      1,
      'https://aiwwquousyzdkagporcy.supabase.co/storage/v1/object/public/product-photos/defaults/topsoil.jpg'
    )
    RETURNING id INTO topsoil_product_id;
    
    -- Add Delivery add-on for Premium Topsoil Mix
    INSERT INTO public.product_addons (
      product_id, 
      name, 
      description, 
      price_type, 
      price_value,
      calculation_type, 
      display_order, 
      is_active
    )
    VALUES (
      topsoil_product_id, 
      'Delivery', 
      'Delivery service for topsoil orders', 
      'fixed', 
      30.00,
      'per_unit', 
      0, 
      true
    );
    
    -- Product 3: Cedar Fence with variations and Stain add-on (linked to Wood Fence subcategory)
    INSERT INTO public.products (
      contractor_id, 
      name, 
      description, 
      unit_type, 
      unit_price, 
      color_hex, 
      category,
      subcategory,
      is_active, 
      min_order_quantity,
      show_pricing_before_submit,
      base_height,
      base_height_unit,
      use_height_in_calculation,
      display_order,
      photo_url
    )
    VALUES (
      new_contractor_id, 
      'Cedar Fence', 
      'Professional cedar fence installation for privacy, security, and aesthetics', 
      'linear_ft', 
      35.00, 
      '#D2691E', 
      'Fencing',
      'Wood Fence',
      true, 
      20,
      true,
      6,
      'ft',
      true,
      2,
      'https://aiwwquousyzdkagporcy.supabase.co/storage/v1/object/public/product-photos/defaults/fence.jpg'
    )
    RETURNING id INTO fence_product_id;
    
    -- Add variations for Cedar Fence
    INSERT INTO public.product_variations (
      product_id, 
      name, 
      description,
      adjustment_type, 
      price_adjustment,
      height_value,
      unit_of_measurement,
      affects_area_calculation,
      is_required,
      is_default,
      display_order,
      is_active
    )
    VALUES 
      (fence_product_id, '6ft cedar fence', '6 foot height cedar fence', 'fixed', 0, 6, 'ft', true, true, true, 0, true),
      (fence_product_id, '8ft cedar fence', '8 foot height cedar fence', 'fixed', 2, 8, 'ft', true, true, false, 1, true);
    
    -- Add Stain add-on for Cedar Fence (area calculation type)
    INSERT INTO public.product_addons (
      product_id, 
      name, 
      description,
      price_type, 
      price_value,
      calculation_type,
      display_order, 
      is_active
    )
    VALUES (
      fence_product_id, 
      'Stain', 
      'Professional staining service based on fence area',
      'fixed', 
      1.00,
      'area_calculation',
      0, 
      true
    );
    
    -- Product 4: Oak Tree with variations and Installation add-on
    INSERT INTO public.products (
      contractor_id, 
      name, 
      description, 
      unit_type, 
      unit_price, 
      color_hex, 
      category,
      is_active, 
      min_order_quantity,
      show_pricing_before_submit,
      display_order,
      photo_url
    )
    VALUES (
      new_contractor_id, 
      'Oak Tree', 
      'High-quality oak trees with expert planting service and proper site preparation', 
      'each', 
      150.00, 
      '#2D5016', 
      'Tree Services',
      true, 
      1,
      true,
      3,
      'https://aiwwquousyzdkagporcy.supabase.co/storage/v1/object/public/product-photos/defaults/tree.jpg'
    )
    RETURNING id INTO tree_product_id;
    
    -- Add variations for Oak Tree
    INSERT INTO public.product_variations (
      product_id, 
      name, 
      description,
      adjustment_type, 
      price_adjustment,
      is_required,
      is_default,
      display_order,
      is_active
    )
    VALUES 
      (tree_product_id, '3-4 ft', 'Small oak tree (3-4 feet tall)', 'fixed', 0, true, true, 0, true),
      (tree_product_id, '5-6 ft', 'Medium oak tree (5-6 feet tall)', 'fixed', 50, true, false, 1, true),
      (tree_product_id, '7-8 ft', 'Large oak tree (7-8 feet tall)', 'fixed', 200, false, false, 2, true);
    
    -- Add Installation add-on for Oak Tree (percentage of total)
    INSERT INTO public.product_addons (
      product_id, 
      name, 
      description,
      price_type, 
      price_value,
      calculation_type,
      display_order, 
      is_active
    )
    VALUES (
      tree_product_id, 
      'Installation', 
      'Professional installation service (25% of tree cost)',
      'percentage', 
      25,
      'total',
      0, 
      true
    );
    
    -- ========================================
    -- CREATE MEASUREMENT TOOLS
    -- ========================================
    
    -- Tool 1: Linear Foot Tool
    INSERT INTO public.products (
      contractor_id,
      name,
      unit_type,
      unit_price,
      color_hex,
      category,
      is_active,
      min_order_quantity,
      show_pricing_before_submit,
      display_order,
      photo_url
    )
    VALUES (
      new_contractor_id,
      'Linear Foot Tool',
      'linear_ft',
      0.00,
      '#FF6B6B',
      'Measurement Tools',
      true,
      1,
      true,
      4,
      'https://aiwwquousyzdkagporcy.supabase.co/storage/v1/object/public/product-photos/8843d0d8-2c76-44c6-8af9-248e7c2e6616/1763579686020.png'
    )
    RETURNING id INTO linear_tool_id;
    
    -- Tool 2: Square Foot Tool
    INSERT INTO public.products (
      contractor_id,
      name,
      unit_type,
      unit_price,
      color_hex,
      category,
      is_active,
      min_order_quantity,
      show_pricing_before_submit,
      display_order,
      photo_url
    )
    VALUES (
      new_contractor_id,
      'Square Foot Tool',
      'sq_ft',
      0.00,
      '#FF6B6B',
      'Measurement Tools',
      true,
      1,
      true,
      5,
      'https://aiwwquousyzdkagporcy.supabase.co/storage/v1/object/public/product-photos/8843d0d8-2c76-44c6-8af9-248e7c2e6616/1763578820610.png'
    )
    RETURNING id INTO square_tool_id;
    
    -- Tool 3: Cubic Yard Tool
    INSERT INTO public.products (
      contractor_id,
      name,
      unit_type,
      unit_price,
      color_hex,
      category,
      is_active,
      min_order_quantity,
      show_pricing_before_submit,
      display_order,
      photo_url
    )
    VALUES (
      new_contractor_id,
      'Cubic Yard Tool',
      'cubic_yard',
      0.00,
      '#FF6B6B',
      'Measurement Tools',
      true,
      1,
      true,
      6,
      'https://aiwwquousyzdkagporcy.supabase.co/storage/v1/object/public/product-photos/8843d0d8-2c76-44c6-8af9-248e7c2e6616/1763579929368.png'
    )
    RETURNING id INTO cubic_tool_id;
    
  END IF;

  RETURN NEW;
END;
$function$;