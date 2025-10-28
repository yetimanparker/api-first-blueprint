-- Remove public SELECT policies on products and related tables
-- This fixes the critical security issue of exposing business pricing and strategy to competitors

-- Drop public SELECT policy on products table
DROP POLICY IF EXISTS "Widget can view active products" ON public.products;

-- Drop public SELECT policy on product_variations table
DROP POLICY IF EXISTS "Widget can view product variations for active products" ON public.product_variations;

-- Drop public SELECT policy on product_addons table
DROP POLICY IF EXISTS "Widget can view product addons for active products" ON public.product_addons;

-- Drop public SELECT policy on product_pricing_tiers table
DROP POLICY IF EXISTS "Widget can view pricing tiers for active products" ON public.product_pricing_tiers;

-- These tables now have NO public access
-- Widget access will be through a secure edge function: get-widget-products
-- This prevents competitors from scraping pricing catalogs and business strategy