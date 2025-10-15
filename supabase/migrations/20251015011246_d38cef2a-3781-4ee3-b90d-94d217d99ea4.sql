-- Update handle_new_user to create multiple common categories
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public'
AS $$
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
      false,  -- Service area disabled by default
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
    
    -- Insert 4 sample products in the Landscaping category
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
      display_order
    )
    VALUES 
      (
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
        0
      ),
      (
        new_contractor_id, 
        'Soil Delivery', 
        'Quality topsoil delivery for landscaping and gardening projects', 
        'cubic_yard', 
        45.00, 
        '#8B4513', 
        'Landscaping',
        true, 
        1,
        true,
        1
      ),
      (
        new_contractor_id, 
        'Fence Installation', 
        'Professional fence installation for privacy, security, and aesthetics', 
        'linear_ft', 
        35.00, 
        '#D2691E', 
        'Fencing',
        true, 
        20,
        true,
        2
      ),
      (
        new_contractor_id, 
        'Tree Planting', 
        'Expert tree planting service with proper site preparation and care', 
        'each', 
        150.00, 
        '#2D5016', 
        'Tree Services',
        true, 
        1,
        true,
        3
      );
  END IF;

  RETURN NEW;
END;
$$;