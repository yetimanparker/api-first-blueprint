import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.4";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface ValidationError {
  row: number;
  field: string;
  message: string;
}

interface PricingPreviewItem {
  productId: string;
  productName: string;
  currentPrice: number;
  newPrice: number;
  priceChange: number;
  percentChange: number;
}

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

    // Parse form data
    const formData = await req.formData();
    const file = formData.get('file') as File;

    if (!file) {
      return new Response(
        JSON.stringify({ error: 'No file provided' }),
        { 
          status: 400, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      );
    }

    console.log(`Processing file: ${file.name}, size: ${file.size}, type: ${file.type}`);

    // Read file content
    const fileContent = await file.text();
    const lines = fileContent.split('\n').map(line => line.trim()).filter(line => line);

    if (lines.length < 2) {
      return new Response(
        JSON.stringify({ 
          errors: [{ row: 1, field: 'file', message: 'File must contain at least a header row and one data row' }]
        }),
        { 
          status: 400, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      );
    }

    // Parse CSV header
    const headerRow = lines[0];
    const headers = headerRow.split(',').map(h => h.replace(/"/g, '').trim().toLowerCase());

    console.log('CSV Headers:', headers);

    // Find required column indices
    const productIdIndex = headers.findIndex(h => 
      h.includes('product id') || h.includes('productid') || h === 'id'
    );
    const productNameIndex = headers.findIndex(h => 
      h.includes('product name') || h.includes('productname') || h.includes('name')
    );
    const currentPriceIndex = headers.findIndex(h => 
      h.includes('current price') || h.includes('currentprice') || h.includes('old price')
    );
    const newPriceIndex = headers.findIndex(h => 
      h.includes('new price') || h.includes('newprice') || h.includes('price')
    );

    console.log('Column indices:', { productIdIndex, productNameIndex, currentPriceIndex, newPriceIndex });

    // Validate required columns
    if (productIdIndex === -1 && productNameIndex === -1) {
      return new Response(
        JSON.stringify({ 
          errors: [{ row: 1, field: 'columns', message: 'File must contain either "Product ID" or "Product Name" column' }]
        }),
        { 
          status: 400, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      );
    }

    if (newPriceIndex === -1) {
      return new Response(
        JSON.stringify({ 
          errors: [{ row: 1, field: 'columns', message: 'File must contain "New Price" column' }]
        }),
        { 
          status: 400, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      );
    }

    // Fetch all contractor products for validation
    const { data: products, error: productsError } = await supabaseClient
      .from('products')
      .select('id, name, unit_price')
      .eq('contractor_id', contractor.id)
      .eq('is_active', true);

    if (productsError) {
      console.error('Products fetch error:', productsError);
      return new Response(
        JSON.stringify({ error: 'Failed to fetch products for validation' }),
        { 
          status: 500, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      );
    }

    console.log(`Loaded ${products?.length || 0} products for validation`);

    // Process data rows
    const errors: ValidationError[] = [];
    const preview: PricingPreviewItem[] = [];

    for (let i = 1; i < lines.length; i++) {
      const row = lines[i];
      if (!row) continue;

      const values = [];
      let currentValue = '';
      let inQuotes = false;
      
      // Simple CSV parser that handles quoted values
      for (let j = 0; j < row.length; j++) {
        const char = row[j];
        if (char === '"') {
          inQuotes = !inQuotes;
        } else if (char === ',' && !inQuotes) {
          values.push(currentValue.trim());
          currentValue = '';
        } else {
          currentValue += char;
        }
      }
      values.push(currentValue.trim()); // Add the last value

      console.log(`Row ${i + 1} values:`, values);

      // Extract values
      const productId = productIdIndex >= 0 ? values[productIdIndex]?.replace(/"/g, '') : '';
      const productName = productNameIndex >= 0 ? values[productNameIndex]?.replace(/"/g, '') : '';
      const newPriceStr = values[newPriceIndex]?.replace(/"/g, '').replace('$', '');

      // Validate new price
      const newPrice = parseFloat(newPriceStr);
      if (isNaN(newPrice) || newPrice <= 0) {
        errors.push({
          row: i + 1,
          field: 'New Price',
          message: `Invalid price: "${newPriceStr}". Must be a positive number.`
        });
        continue;
      }

      // Find matching product
      let matchedProduct = null;
      if (productId) {
        matchedProduct = products?.find(p => p.id === productId);
      }
      if (!matchedProduct && productName) {
        matchedProduct = products?.find(p => 
          p.name.toLowerCase().trim() === productName.toLowerCase().trim()
        );
      }

      if (!matchedProduct) {
        errors.push({
          row: i + 1,
          field: productId ? 'Product ID' : 'Product Name',
          message: `Product not found: "${productId || productName}"`
        });
        continue;
      }

      // Calculate price changes
      const currentPrice = parseFloat(matchedProduct.unit_price.toString());
      const priceChange = newPrice - currentPrice;
      const percentChange = currentPrice > 0 ? (priceChange / currentPrice) * 100 : 0;

      preview.push({
        productId: matchedProduct.id,
        productName: matchedProduct.name,
        currentPrice,
        newPrice,
        priceChange,
        percentChange
      });
    }

    console.log(`Processed ${preview.length} valid items, ${errors.length} errors`);

    return new Response(
      JSON.stringify({ 
        preview,
        errors,
        summary: {
          totalRows: lines.length - 1,
          validItems: preview.length,
          errorCount: errors.length
        }
      }),
      {
        headers: { 
          ...corsHeaders, 
          'Content-Type': 'application/json'
        },
      }
    );
  } catch (error: any) {
    console.error('Error in process-pricing-file function:', error);
    return new Response(
      JSON.stringify({ error: error.message }),
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  }
});