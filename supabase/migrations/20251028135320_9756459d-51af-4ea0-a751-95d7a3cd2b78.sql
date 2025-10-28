-- Remove public SELECT policy on contractor_settings
DROP POLICY IF EXISTS "Public users can view contractor settings for widget" ON public.contractor_settings;

-- The contractor_settings table now has NO public access
-- Only authenticated contractors can view their own settings
-- Widget access is through the secure edge function: get-contractor-widget-settings