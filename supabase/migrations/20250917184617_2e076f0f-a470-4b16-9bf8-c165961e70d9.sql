-- Create contractors table for business accounts
CREATE TABLE public.contractors (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL UNIQUE REFERENCES auth.users(id) ON DELETE CASCADE,
  business_name TEXT NOT NULL,
  email TEXT NOT NULL,
  phone TEXT,
  address TEXT,
  city TEXT,
  state TEXT,
  zip_code TEXT,
  website TEXT,
  logo_url TEXT,
  brand_color TEXT DEFAULT '#3B82F6',
  secondary_color TEXT DEFAULT '#64748B',
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create products table
CREATE TABLE public.products (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  contractor_id UUID NOT NULL REFERENCES public.contractors(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  description TEXT,
  unit_price DECIMAL(10,2) NOT NULL,
  unit_type TEXT NOT NULL DEFAULT 'sq_ft', -- sq_ft, linear_ft, per_item, etc.
  color_hex TEXT NOT NULL DEFAULT '#3B82F6',
  is_active BOOLEAN NOT NULL DEFAULT true,
  display_order INTEGER DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create customers table
CREATE TABLE public.customers (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  contractor_id UUID NOT NULL REFERENCES public.contractors(id) ON DELETE CASCADE,
  first_name TEXT NOT NULL,
  last_name TEXT NOT NULL,
  email TEXT NOT NULL,
  phone TEXT,
  address TEXT,
  city TEXT,
  state TEXT,
  zip_code TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create quotes table
CREATE TABLE public.quotes (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  contractor_id UUID NOT NULL REFERENCES public.contractors(id) ON DELETE CASCADE,
  customer_id UUID NOT NULL REFERENCES public.customers(id) ON DELETE CASCADE,
  quote_number TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'draft', -- draft, sent, accepted, rejected, expired
  total_amount DECIMAL(10,2) NOT NULL DEFAULT 0,
  project_address TEXT,
  project_city TEXT,
  project_state TEXT,
  project_zip_code TEXT,
  notes TEXT,
  expires_at TIMESTAMP WITH TIME ZONE,
  accepted_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(contractor_id, quote_number)
);

-- Create quote_items table for individual measured products
CREATE TABLE public.quote_items (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  quote_id UUID NOT NULL REFERENCES public.quotes(id) ON DELETE CASCADE,
  product_id UUID NOT NULL REFERENCES public.products(id) ON DELETE CASCADE,
  quantity DECIMAL(10,2) NOT NULL,
  unit_price DECIMAL(10,2) NOT NULL,
  line_total DECIMAL(10,2) NOT NULL,
  measurement_data JSONB, -- stores map coordinates, area calculations, etc.
  notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create profiles table for user management
CREATE TABLE public.profiles (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL UNIQUE REFERENCES auth.users(id) ON DELETE CASCADE,
  first_name TEXT,
  last_name TEXT,
  avatar_url TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable Row Level Security on all tables
ALTER TABLE public.contractors ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.products ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.customers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.quotes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.quote_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

-- Create RLS policies for contractors table
CREATE POLICY "Contractors can view their own data" 
ON public.contractors 
FOR SELECT 
USING (auth.uid() = user_id);

CREATE POLICY "Contractors can update their own data" 
ON public.contractors 
FOR UPDATE 
USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their contractor profile" 
ON public.contractors 
FOR INSERT 
WITH CHECK (auth.uid() = user_id);

-- Create security definer function to get contractor_id for current user
CREATE OR REPLACE FUNCTION public.get_current_contractor_id()
RETURNS UUID AS $$
  SELECT id FROM public.contractors WHERE user_id = auth.uid();
$$ LANGUAGE SQL SECURITY DEFINER STABLE SET search_path = public;

-- Create RLS policies for products table
CREATE POLICY "Contractors can view their own products" 
ON public.products 
FOR SELECT 
USING (contractor_id = public.get_current_contractor_id());

CREATE POLICY "Contractors can insert their own products" 
ON public.products 
FOR INSERT 
WITH CHECK (contractor_id = public.get_current_contractor_id());

CREATE POLICY "Contractors can update their own products" 
ON public.products 
FOR UPDATE 
USING (contractor_id = public.get_current_contractor_id());

CREATE POLICY "Contractors can delete their own products" 
ON public.products 
FOR DELETE 
USING (contractor_id = public.get_current_contractor_id());

-- Create RLS policies for customers table
CREATE POLICY "Contractors can view their own customers" 
ON public.customers 
FOR SELECT 
USING (contractor_id = public.get_current_contractor_id());

CREATE POLICY "Contractors can insert their own customers" 
ON public.customers 
FOR INSERT 
WITH CHECK (contractor_id = public.get_current_contractor_id());

CREATE POLICY "Contractors can update their own customers" 
ON public.customers 
FOR UPDATE 
USING (contractor_id = public.get_current_contractor_id());

-- Create RLS policies for quotes table
CREATE POLICY "Contractors can view their own quotes" 
ON public.quotes 
FOR SELECT 
USING (contractor_id = public.get_current_contractor_id());

CREATE POLICY "Contractors can insert their own quotes" 
ON public.quotes 
FOR INSERT 
WITH CHECK (contractor_id = public.get_current_contractor_id());

CREATE POLICY "Contractors can update their own quotes" 
ON public.quotes 
FOR UPDATE 
USING (contractor_id = public.get_current_contractor_id());

-- Create RLS policies for quote_items table
CREATE POLICY "Contractors can view their own quote items" 
ON public.quote_items 
FOR SELECT 
USING (
  EXISTS (
    SELECT 1 FROM public.quotes 
    WHERE quotes.id = quote_items.quote_id 
    AND quotes.contractor_id = public.get_current_contractor_id()
  )
);

CREATE POLICY "Contractors can insert their own quote items" 
ON public.quote_items 
FOR INSERT 
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.quotes 
    WHERE quotes.id = quote_items.quote_id 
    AND quotes.contractor_id = public.get_current_contractor_id()
  )
);

CREATE POLICY "Contractors can update their own quote items" 
ON public.quote_items 
FOR UPDATE 
USING (
  EXISTS (
    SELECT 1 FROM public.quotes 
    WHERE quotes.id = quote_items.quote_id 
    AND quotes.contractor_id = public.get_current_contractor_id()
  )
);

CREATE POLICY "Contractors can delete their own quote items" 
ON public.quote_items 
FOR DELETE 
USING (
  EXISTS (
    SELECT 1 FROM public.quotes 
    WHERE quotes.id = quote_items.quote_id 
    AND quotes.contractor_id = public.get_current_contractor_id()
  )
);

-- Create RLS policies for profiles table
CREATE POLICY "Users can view their own profile" 
ON public.profiles 
FOR SELECT 
USING (auth.uid() = user_id);

CREATE POLICY "Users can update their own profile" 
ON public.profiles 
FOR UPDATE 
USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own profile" 
ON public.profiles 
FOR INSERT 
WITH CHECK (auth.uid() = user_id);

-- Create function to update timestamps
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public;

-- Create triggers for automatic timestamp updates
CREATE TRIGGER update_contractors_updated_at
  BEFORE UPDATE ON public.contractors
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_products_updated_at
  BEFORE UPDATE ON public.products
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_customers_updated_at
  BEFORE UPDATE ON public.customers
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_quotes_updated_at
  BEFORE UPDATE ON public.quotes
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_profiles_updated_at
  BEFORE UPDATE ON public.profiles
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- Create function to handle new user registration
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  INSERT INTO public.profiles (user_id, first_name, last_name)
  VALUES (
    NEW.id,
    NEW.raw_user_meta_data ->> 'first_name',
    NEW.raw_user_meta_data ->> 'last_name'
  );
  RETURN NEW;
END;
$$;

-- Create trigger to automatically create profile on user signup
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_new_user();

-- Create indexes for performance
CREATE INDEX idx_contractors_user_id ON public.contractors(user_id);
CREATE INDEX idx_products_contractor_id ON public.products(contractor_id);
CREATE INDEX idx_customers_contractor_id ON public.customers(contractor_id);
CREATE INDEX idx_quotes_contractor_id ON public.quotes(contractor_id);
CREATE INDEX idx_quotes_customer_id ON public.quotes(customer_id);
CREATE INDEX idx_quote_items_quote_id ON public.quote_items(quote_id);
CREATE INDEX idx_profiles_user_id ON public.profiles(user_id);