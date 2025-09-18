-- Create pricing history table for audit trails
CREATE TABLE public.pricing_history (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  contractor_id UUID NOT NULL,
  product_id UUID NOT NULL,
  old_price NUMERIC NOT NULL,
  new_price NUMERIC NOT NULL,
  change_type TEXT NOT NULL DEFAULT 'bulk_update', -- 'manual', 'bulk_update', 'category_update'
  changed_by UUID NOT NULL,
  change_reason TEXT,
  batch_id UUID, -- Groups related changes together
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.pricing_history ENABLE ROW LEVEL SECURITY;

-- Create policies for pricing history
CREATE POLICY "Contractors can view their pricing history" 
ON public.pricing_history 
FOR SELECT 
USING (contractor_id = get_current_contractor_id());

CREATE POLICY "Contractors can create pricing history" 
ON public.pricing_history 
FOR INSERT 
WITH CHECK (contractor_id = get_current_contractor_id() AND changed_by = auth.uid());

-- Create index for better performance
CREATE INDEX idx_pricing_history_contractor_product ON public.pricing_history(contractor_id, product_id);
CREATE INDEX idx_pricing_history_batch ON public.pricing_history(batch_id);
CREATE INDEX idx_pricing_history_created_at ON public.pricing_history(created_at DESC);