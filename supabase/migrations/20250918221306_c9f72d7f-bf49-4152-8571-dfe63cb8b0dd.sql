-- Create a sequence for quote numbers starting from 1000
CREATE SEQUENCE IF NOT EXISTS quote_number_seq START WITH 1000 INCREMENT BY 1;

-- Create function to generate sequential quote numbers
CREATE OR REPLACE FUNCTION public.generate_quote_number()
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
BEGIN
  RETURN 'Q-' || nextval('quote_number_seq');
END;
$function$;