-- Add RLS policy for public access to defaults folder in product-photos bucket
CREATE POLICY "Public access to default product images"
ON storage.objects
FOR SELECT
USING (bucket_id = 'product-photos' AND name LIKE 'defaults/%');

-- Update handle_new_user function to include photo URLs for sample products
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  new_contractor_id uuid;
  landscaping_category_id uuid;
  hardscaping_category_id uuid;
  irrigation_category_id uuid;
  fencing_category_id uuid;
  lawn_care_category_id uuid;
  tree_services_category_id uuid;
  lighting_category_id uuid;
  drainage_category_id uuid;
  sod_product_id uuid;
  topsoil_product_id uuid;
  fence_product_id uuid;
  tree_product_id uuid;
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
    
    -- Create common categories
    INSERT INTO public.product_categories (contractor_id, name, color_hex, display_order, is_active)
    VALUES 
      (new_contractor_id, 'Landscaping', '#228B22', 0, true)
    RETURNING id INTO landscaping_category_id;
    
    INSERT INTO public.product_categories (contractor_id, name, color_hex, display_order, is_active)
    VALUES 
      (new_contractor_id, 'Hardscaping', '#8B4513', 1, true)
    RETURNING id INTO hardscaping_category_id;
    
    INSERT INTO public.product_categories (contractor_id, name, color_hex, display_order, is_active)
    VALUES 
      (new_contractor_id, 'Irrigation', '#4169E1', 2, true)
    RETURNING id INTO irrigation_category_id;
    
    INSERT INTO public.product_categories (contractor_id, name, color_hex, display_order, is_active)
    VALUES 
      (new_contractor_id, 'Fencing', '#D2691E', 3, true)
    RETURNING id INTO fencing_category_id;
    
    INSERT INTO public.product_categories (contractor_id, name, color_hex, display_order, is_active)
    VALUES 
      (new_contractor_id, 'Lawn Care', '#32CD32', 4, true)
    RETURNING id INTO lawn_care_category_id;
    
    INSERT INTO public.product_categories (contractor_id, name, color_hex, display_order, is_active)
    VALUES 
      (new_contractor_id, 'Tree Services', '#2D5016', 5, true)
    RETURNING id INTO tree_services_category_id;
    
    INSERT INTO public.product_categories (contractor_id, name, color_hex, display_order, is_active)
    VALUES 
      (new_contractor_id, 'Outdoor Lighting', '#FFD700', 6, true)
    RETURNING id INTO lighting_category_id;
    
    INSERT INTO public.product_categories (contractor_id, name, color_hex, display_order, is_active)
    VALUES 
      (new_contractor_id, 'Drainage Solutions', '#1E90FF', 7, true)
    RETURNING id INTO drainage_category_id;
    
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
    
    -- Product 2: Premium Topsoil Mix with Delivery add-on
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
      'Soil',
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
    
    -- Product 3: Cedar Fence with variations and Stain add-on
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
    
  END IF;

  RETURN NEW;
END;
$function$;