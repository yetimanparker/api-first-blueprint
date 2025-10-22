-- Add show_markup_in_widget column to contractor_settings
ALTER TABLE contractor_settings 
ADD COLUMN IF NOT EXISTS show_markup_in_widget BOOLEAN DEFAULT false;