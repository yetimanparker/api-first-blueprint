-- Create customer notes/interactions table
CREATE TABLE public.customer_notes (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  customer_id UUID NOT NULL,
  contractor_id UUID NOT NULL,
  note_text TEXT NOT NULL,
  note_type TEXT NOT NULL DEFAULT 'general', -- 'general', 'phone_call', 'email', 'meeting', 'follow_up'
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create tasks/activities table  
CREATE TABLE public.tasks (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  contractor_id UUID NOT NULL,
  customer_id UUID,
  quote_id UUID,
  title TEXT NOT NULL,
  description TEXT,
  task_type TEXT NOT NULL DEFAULT 'follow_up', -- 'follow_up', 'call', 'email', 'meeting', 'site_visit'
  status TEXT NOT NULL DEFAULT 'pending', -- 'pending', 'in_progress', 'completed', 'cancelled'
  priority TEXT NOT NULL DEFAULT 'medium', -- 'low', 'medium', 'high', 'urgent'
  due_date TIMESTAMP WITH TIME ZONE,
  completed_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create quote status history table
CREATE TABLE public.quote_status_history (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  quote_id UUID NOT NULL,
  old_status TEXT,
  new_status TEXT NOT NULL,
  changed_by UUID NOT NULL,
  notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Add quote access tokens for secure editing links
ALTER TABLE public.quotes ADD COLUMN access_token TEXT;
ALTER TABLE public.quotes ADD COLUMN version_number INTEGER DEFAULT 1;
ALTER TABLE public.quotes ADD COLUMN parent_quote_id UUID;

-- Create index for quick token lookups
CREATE INDEX idx_quotes_access_token ON public.quotes(access_token);

-- Enable RLS on new tables
ALTER TABLE public.customer_notes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tasks ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.quote_status_history ENABLE ROW LEVEL SECURITY;

-- RLS policies for customer_notes
CREATE POLICY "Contractors can view their customer notes" 
ON public.customer_notes 
FOR SELECT 
USING (contractor_id = get_current_contractor_id());

CREATE POLICY "Contractors can create customer notes" 
ON public.customer_notes 
FOR INSERT 
WITH CHECK (contractor_id = get_current_contractor_id());

CREATE POLICY "Contractors can update their customer notes" 
ON public.customer_notes 
FOR UPDATE 
USING (contractor_id = get_current_contractor_id());

CREATE POLICY "Contractors can delete their customer notes" 
ON public.customer_notes 
FOR DELETE 
USING (contractor_id = get_current_contractor_id());

-- RLS policies for tasks
CREATE POLICY "Contractors can view their tasks" 
ON public.tasks 
FOR SELECT 
USING (contractor_id = get_current_contractor_id());

CREATE POLICY "Contractors can create tasks" 
ON public.tasks 
FOR INSERT 
WITH CHECK (contractor_id = get_current_contractor_id());

CREATE POLICY "Contractors can update their tasks" 
ON public.tasks 
FOR UPDATE 
USING (contractor_id = get_current_contractor_id());

CREATE POLICY "Contractors can delete their tasks" 
ON public.tasks 
FOR DELETE 
USING (contractor_id = get_current_contractor_id());

-- RLS policies for quote_status_history
CREATE POLICY "Contractors can view their quote history" 
ON public.quote_status_history 
FOR SELECT 
USING (EXISTS (
  SELECT 1 FROM public.quotes 
  WHERE quotes.id = quote_status_history.quote_id 
  AND quotes.contractor_id = get_current_contractor_id()
));

CREATE POLICY "Contractors can create quote history" 
ON public.quote_status_history 
FOR INSERT 
WITH CHECK (EXISTS (
  SELECT 1 FROM public.quotes 
  WHERE quotes.id = quote_status_history.quote_id 
  AND quotes.contractor_id = get_current_contractor_id()
));

-- Add triggers for updated_at columns
CREATE TRIGGER update_customer_notes_updated_at
  BEFORE UPDATE ON public.customer_notes
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_tasks_updated_at
  BEFORE UPDATE ON public.tasks
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- Function to generate secure access tokens for quotes
CREATE OR REPLACE FUNCTION public.generate_quote_access_token()
RETURNS TEXT AS $$
BEGIN
  RETURN encode(gen_random_bytes(32), 'hex');
END;
$$ LANGUAGE plpgsql;

-- Function to create quote status history entry
CREATE OR REPLACE FUNCTION public.log_quote_status_change()
RETURNS TRIGGER AS $$
BEGIN
  IF OLD.status IS DISTINCT FROM NEW.status THEN
    INSERT INTO public.quote_status_history (quote_id, old_status, new_status, changed_by)
    VALUES (NEW.id, OLD.status, NEW.status, auth.uid());
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger to automatically log quote status changes
CREATE TRIGGER log_quote_status_changes
  AFTER UPDATE ON public.quotes
  FOR EACH ROW
  EXECUTE FUNCTION public.log_quote_status_change();