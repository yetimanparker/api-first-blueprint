-- Add first_viewed_at column to quotes table to track when contractors first view a quote
ALTER TABLE public.quotes
ADD COLUMN first_viewed_at timestamp with time zone DEFAULT NULL;

-- Add an index for better query performance on unviewed quotes
CREATE INDEX idx_quotes_first_viewed_at ON public.quotes(contractor_id, first_viewed_at) WHERE first_viewed_at IS NULL;