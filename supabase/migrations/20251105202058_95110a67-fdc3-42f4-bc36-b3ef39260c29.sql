-- Add clarifying questions fields to contractor_settings
ALTER TABLE public.contractor_settings
ADD COLUMN clarifying_questions_enabled boolean NOT NULL DEFAULT false,
ADD COLUMN clarifying_questions jsonb DEFAULT '[]'::jsonb;

-- Add clarifying answers field to quotes table
ALTER TABLE public.quotes
ADD COLUMN clarifying_answers jsonb DEFAULT '{}'::jsonb;

-- Add helpful comment
COMMENT ON COLUMN public.contractor_settings.clarifying_questions IS 'Array of question objects with id, question text, and required flag';
COMMENT ON COLUMN public.contractor_settings.clarifying_questions_enabled IS 'Toggle to enable/disable clarifying questions dialog in widget';
COMMENT ON COLUMN public.quotes.clarifying_answers IS 'Customer responses to clarifying questions, stored as key-value pairs';