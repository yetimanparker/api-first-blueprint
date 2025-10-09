-- Allow public users to view contractor settings for widget
CREATE POLICY "Public users can view contractor settings for widget"
ON public.contractor_settings
FOR SELECT
USING (true);