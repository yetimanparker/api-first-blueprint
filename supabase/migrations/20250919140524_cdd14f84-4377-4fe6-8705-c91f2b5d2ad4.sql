-- Add service area columns to contractor_settings table
ALTER TABLE contractor_settings 
ADD COLUMN service_area_enabled boolean DEFAULT false,
ADD COLUMN service_area_method text DEFAULT 'radius',
ADD COLUMN service_area_radius_miles integer DEFAULT 50,
ADD COLUMN service_area_center_lat numeric,
ADD COLUMN service_area_center_lng numeric,
ADD COLUMN service_area_zip_codes text[];

-- Add check constraint for service area method
ALTER TABLE contractor_settings 
ADD CONSTRAINT contractor_settings_service_area_method_check 
CHECK (service_area_method IN ('radius', 'zipcodes'));

-- Create function to update contractor coordinates from business address
CREATE OR REPLACE FUNCTION public.update_contractor_coordinates()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  -- This trigger could be enhanced later to auto-geocode addresses
  -- For now, coordinates will be set manually via the UI
  RETURN NEW;
END;
$$;