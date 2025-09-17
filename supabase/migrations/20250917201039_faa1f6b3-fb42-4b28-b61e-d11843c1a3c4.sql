-- Update the handle_new_user function to also create contractor profile
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
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
    );
  END IF;

  RETURN NEW;
END;
$$;