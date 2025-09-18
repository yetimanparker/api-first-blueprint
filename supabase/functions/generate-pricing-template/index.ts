import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.4";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    // Get the authenticated user
    const authHeader = req.headers.get('Authorization')!;
    const { data: { user }, error: authError } = await supabaseClient.auth.getUser(
      authHeader.replace('Bearer ', '')
    );

    if (authError || !user) {
      console.error('Authentication error:', authError);
      return new Response(
        JSON.stringify({ error: 'Authentication required' }),
        { 
          status: 401, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      );
    }

    console.log(`Generating template for user: ${user.id}`);

    // Get current contractor ID
    const { data: contractor, error: contractorError } = await supabaseClient
      .from('contractors')
      .select('id')
      .eq('user_id', user.id)
      .single();

    if (contractorError || !contractor) {
      console.error('Contractor lookup error:', contractorError);
      return new Response(
        JSON.stringify({ error: 'Contractor not found' }),
        { 
          status: 404, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      );
    }

    // Fetch all products for this contractor
    const { data: products, error: productsError } = await supabaseClient
      .from('products')
      .select('id, name, category, unit_price, unit_type')
      .eq('contractor_id', contractor.id)
      .eq('is_active', true)
      .order('category', { ascending: true })
      .order('name', { ascending: true });

    if (productsError) {
      console.error('Products fetch error:', productsError);
      return new Response(
        JSON.stringify({ error: 'Failed to fetch products' }),
        { 
          status: 500, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      );
    }

    console.log(`Found ${products?.length || 0} products for template`);

    // Generate CSV content
    let csvContent = 'Product ID,Product Name,Category,Current Price,Unit Type,New Price\n';

    if (products && products.length > 0) {
      for (const product of products) {
        const escapedName = `"${(product.name || '').replace(/"/g, '""')}"`;
        const escapedCategory = `"${(product.category || '').replace(/"/g, '""')}"`;
        
        csvContent += `${product.id},${escapedName},${escapedCategory},${product.unit_price},${product.unit_type},\n`;
      }
    } else {
      // Add sample row if no products exist
      csvContent += 'sample-id,"Sample Product Name","Sample Category",100.00,sq_ft,110.00\n';
    }

    console.log('Template generated successfully');

    return new Response(
      JSON.stringify({ 
        csv: csvContent,
        productCount: products?.length || 0
      }),
      {
        headers: { 
          ...corsHeaders, 
          'Content-Type': 'application/json'
        },
      }
    );
  } catch (error: any) {
    console.error('Error in generate-pricing-template function:', error);
    return new Response(
      JSON.stringify({ error: error.message }),
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  }
});