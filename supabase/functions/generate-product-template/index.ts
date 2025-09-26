import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_ANON_KEY') ?? '',
      {
        global: {
          headers: { Authorization: req.headers.get('Authorization')! },
        },
      }
    );

    // Get the authenticated user
    const { data: userData, error: userError } = await supabaseClient.auth.getUser();
    if (userError || !userData.user) {
      throw new Error('Authentication required');
    }

    // Get contractor ID
    const { data: contractor, error: contractorError } = await supabaseClient
      .from('contractors')
      .select('id')
      .eq('user_id', userData.user.id)
      .single();

    if (contractorError || !contractor) {
      throw new Error('Contractor not found');
    }

    const { mode = 'pricing_only' } = await req.json();
    console.log(`Generating ${mode} template for contractor: ${contractor.id}`);

    // Get existing products and categories
    const { data: products, error: productsError } = await supabaseClient
      .from('products')
      .select(`
        id, name, description, unit_price, unit_type, category, subcategory,
        color_hex, photo_url, is_active, show_pricing_before_submit, display_order
      `)
      .eq('contractor_id', contractor.id)
      .eq('is_active', true)
      .order('display_order', { ascending: true });

    if (productsError) {
      throw new Error(`Error fetching products: ${productsError.message}`);
    }

    const { data: categories, error: categoriesError } = await supabaseClient
      .from('product_categories')
      .select('id, name, color_hex')
      .eq('contractor_id', contractor.id)
      .eq('is_active', true)
      .order('name');

    if (categoriesError) {
      console.warn('Could not fetch categories:', categoriesError.message);
    }

    const { data: subcategories, error: subcategoriesError } = await supabaseClient
      .from('product_subcategories')
      .select('id, name, category_id')
      .eq('is_active', true);

    if (subcategoriesError) {
      console.warn('Could not fetch subcategories:', subcategoriesError.message);
    }

    // Create lookup maps for category and subcategory UUIDs to names
    const categoryMap = new Map(categories?.map(c => [c.id, c.name]) || []);
    const subcategoryMap = new Map(subcategories?.map(s => [s.id, s.name]) || []);

    console.log(`Found ${products?.length || 0} products for template`);

    let csvContent = '';
    
    if (mode === 'pricing_only') {
      // Pricing-only template
      csvContent = 'Product ID,Product Name,Current Price,New Price\n';
      
      if (products && products.length > 0) {
        products.forEach((product, index) => {
          const shortId = (index + 1).toString(); // Simple sequential ID
          csvContent += `${shortId},"${product.name}",${product.unit_price},${product.unit_price}\n`;
        });
      } else {
        // Sample row
        csvContent += '1,"Sample Product",10.00,12.00\n';
      }
    } else {
      // Full management template
      csvContent = [
        'Product ID',
        'Product Name',
        'Description',
        'Unit Price',
        'Unit Type',
        'Category',
        'Subcategory',
        'Color Hex',
        'Photo URL',
        'Active',
        'Show Pricing Before Submit',
        'Display Order'
      ].join(',') + '\n';

      if (products && products.length > 0) {
        products.forEach((product, index) => {
          const shortId = (index + 1).toString(); // Simple sequential ID
          const categoryName = categoryMap.get(product.category) || product.category || '';
          const subcategoryName = subcategoryMap.get(product.subcategory) || product.subcategory || '';
          
          csvContent += [
            shortId,
            `"${product.name}"`,
            `"${product.description || ''}"`,
            product.unit_price,
            product.unit_type,
            `"${categoryName}"`,
            `"${subcategoryName}"`,
            product.color_hex,
            `"${product.photo_url || ''}"`,
            product.is_active ? 'TRUE' : 'FALSE',
            product.show_pricing_before_submit ? 'TRUE' : 'FALSE',
            product.display_order || 0
          ].join(',') + '\n';
        });
      } else {
        // Sample rows with different unit types and categories
        const sampleCategories = categories && categories.length > 0 
          ? categories.slice(0, 3).map(c => c.name)
          : ['Fencing', 'Decking', 'Landscaping'];
          
        sampleCategories.forEach((category, index) => {
          csvContent += [
            '', // Empty Product ID for new products
            `"Sample ${category} Product"`,
            `"Description for ${category.toLowerCase()} service"`,
            (15 + index * 5).toFixed(2),
            index === 0 ? 'linear_ft' : index === 1 ? 'sq_ft' : 'each',
            `"${category}"`,
            '""',
            '#3B82F6',
            '""',
            'TRUE',
            'TRUE',
            index
          ].join(',') + '\n';
        });
      }
    }

    console.log('Template generated successfully');

    return new Response(JSON.stringify({
      csvContent,
      productCount: products?.length || 0,
      mode
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error) {
    console.error('Error in generate-product-template function:', error);
    return new Response(JSON.stringify({ error: error instanceof Error ? error.message : 'Unknown error' }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});