-- Add new fields to customers table for enhanced CRM functionality
ALTER TABLE public.customers 
ADD COLUMN status text DEFAULT 'lead' CHECK (status IN ('lead', 'contacted', 'quoted', 'negotiating', 'converted', 'lost', 'inactive')),
ADD COLUMN lead_source text,
ADD COLUMN last_activity_at timestamp with time zone DEFAULT now();

-- Update existing customers to have default status
UPDATE public.customers SET 
  status = 'lead',
  last_activity_at = created_at 
WHERE status IS NULL;

-- Create trigger to update last_activity_at when customer record is updated
CREATE OR REPLACE FUNCTION public.update_customer_activity()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public'
AS $function$
BEGIN
  NEW.last_activity_at = now();
  RETURN NEW;
END;
$function$;

-- Create trigger for customers table
CREATE TRIGGER update_customer_activity_trigger
  BEFORE UPDATE ON public.customers
  FOR EACH ROW
  EXECUTE FUNCTION public.update_customer_activity();