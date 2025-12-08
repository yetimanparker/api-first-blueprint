import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.38.4";
import { corsHeaders } from "../_shared/cors.ts";

// Simple in-memory rate limiting (resets on function restart)
const requestCounts = new Map<string, { count: number; resetTime: number }>();
const RATE_LIMIT = 100; // requests per hour
const RATE_WINDOW = 60 * 60 * 1000; // 1 hour in milliseconds

function checkRateLimit(contractorId: string): boolean {
  const now = Date.now();
  const record = requestCounts.get(contractorId);

  if (!record || now > record.resetTime) {
    requestCounts.set(contractorId, { count: 1, resetTime: now + RATE_WINDOW });
    return true;
  }

  if (record.count >= RATE_LIMIT) {
    return false;
  }

  record.count++;
  return true;
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    const { contractor_id } = await req.json();

    // Validate contractor_id is provided and is a valid UUID format
    if (!contractor_id || typeof contractor_id !== 'string') {
      console.error('Missing or invalid contractor_id');
      return new Response(
        JSON.stringify({ error: 'contractor_id is required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Basic UUID format validation
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    if (!uuidRegex.test(contractor_id)) {
      console.error('Invalid contractor_id format');
      return new Response(
        JSON.stringify({ error: 'Invalid contractor_id format' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Check rate limit
    if (!checkRateLimit(contractor_id)) {
      console.warn(`Rate limit exceeded for contractor: ${contractor_id}`);
      return new Response(
        JSON.stringify({ error: 'Rate limit exceeded. Please try again later.' }),
        { status: 429, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Verify contractor exists
    const { data: contractor, error: contractorError } = await supabaseClient
      .from('contractors')
      .select('id')
      .eq('id', contractor_id)
      .single();

    if (contractorError || !contractor) {
      console.error('Contractor not found:', contractor_id);
      return new Response(
        JSON.stringify({ error: 'Contractor not found' }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Log access for security monitoring
    console.log(`Product data accessed for contractor: ${contractor_id}`);

    // Fetch products with related data
    const { data: products, error: productsError } = await supabaseClient
      .from('products')
      .select('id, name, description, unit_type, unit_price, color_hex, photo_url, category, subcategory, is_active, show_in_widget_selector, show_pricing_before_submit, min_order_quantity, sold_in_increments_of, increment_unit_label, increment_description, allow_partial_increments, has_fixed_dimensions, default_width, default_length, dimension_unit, allow_dimension_editing, base_height, use_height_in_calculation, base_height_unit, display_order')
      .eq('contractor_id', contractor_id)
      .eq('is_active', true)
      .eq('show_in_widget_selector', true)
      .order('display_order', { ascending: true });

    if (productsError) {
      console.error('Error fetching products:', productsError);
      throw productsError;
    }

    // Fetch variations for all products
    const productIds = products?.map(p => p.id) || [];
    const { data: variations, error: variationsError } = await supabaseClient
      .from('product_variations')
      .select('*')
      .in('product_id', productIds)
      .eq('is_active', true)
      .order('display_order', { ascending: true });

    if (variationsError) {
      console.error('Error fetching variations:', variationsError);
    }

    // Fetch addons for all products (explicit foreign key to avoid ambiguity)
    const { data: addons, error: addonsError } = await supabaseClient
      .from('product_addons')
      .select('id, product_id, name, description, price_type, price_value, calculation_type, calculation_formula, display_order, is_active, linked_product_id, allow_map_placement, input_mode')
      .in('product_id', productIds)
      .eq('is_active', true)
      .order('display_order', { ascending: true });

    if (addonsError) {
      console.error('Error fetching addons:', addonsError);
    }
    
    // Fetch addon options for all addons
    const addonIds = addons?.map(a => a.id) || [];
    const { data: addonOptions, error: addonOptionsError } = await supabaseClient
      .from('product_addon_options')
      .select('*')
      .in('addon_id', addonIds)
      .eq('is_active', true)
      .order('display_order', { ascending: true });
    
    if (addonOptionsError) {
      console.error('Error fetching addon options:', addonOptionsError);
    }
    
    // Group options by addon_id
    const optionsByAddon: Record<string, any[]> = {};
    (addonOptions || []).forEach(option => {
      if (!optionsByAddon[option.addon_id]) {
        optionsByAddon[option.addon_id] = [];
      }
      optionsByAddon[option.addon_id].push(option);
    });

    // Fetch pricing tiers for all products
    const { data: pricingTiers, error: tiersError } = await supabaseClient
      .from('product_pricing_tiers')
      .select('*')
      .in('product_id', productIds)
      .eq('is_active', true)
      .order('display_order', { ascending: true });

    if (tiersError) {
      console.error('Error fetching pricing tiers:', tiersError);
    }

    // Fetch categories for this contractor
    const { data: categories, error: categoriesError } = await supabaseClient
      .from('product_categories')
      .select('id, name, color_hex')
      .eq('contractor_id', contractor_id)
      .eq('is_active', true)
      .order('display_order', { ascending: true });

    if (categoriesError) {
      console.error('Error fetching categories:', categoriesError);
    }
    console.log(`Fetched ${categories?.length || 0} categories for contractor ${contractor_id}`);
    console.log('Categories data:', categories);

    // Fetch subcategories for this contractor's categories
    const categoryIds = categories?.map(c => c.id) || [];
    console.log(`Category IDs for subcategories query:`, categoryIds);
    const { data: subcategories, error: subcategoriesError} = await supabaseClient
      .from('product_subcategories')
      .select('id, category_id, name, is_active, display_order')
      .in('category_id', categoryIds)
      .eq('is_active', true)
      .order('display_order', { ascending: true });

    if (subcategoriesError) {
      console.error('Error fetching subcategories:', subcategoriesError);
    }
    console.log(`Fetched ${subcategories?.length || 0} subcategories`);
    console.log('Subcategories data:', subcategories);

    // Organize data by product
    const productsWithRelations = products?.map(product => {
      const productAddons = (addons?.filter(a => a.product_id === product.id) || []).map(addon => ({
        ...addon,
        addon_options: optionsByAddon[addon.id] || []
      }));
      
      return {
        ...product,
        product_variations: variations?.filter(v => v.product_id === product.id) || [],
        product_addons: productAddons,
        product_pricing_tiers: pricingTiers?.filter(t => t.product_id === product.id) || [],
      };
    }) || [];

    console.log(`Returning response with ${productsWithRelations.length} products, ${categories?.length || 0} categories, ${subcategories?.length || 0} subcategories`);

    return new Response(
      JSON.stringify({ 
        success: true,
        products: productsWithRelations,
        categories: categories || [],
        subcategories: subcategories || []
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Error in get-widget-products:', error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { 
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    );
  }
});
