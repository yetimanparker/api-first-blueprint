import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface ValidationError {
  row: number;
  field: string;
  message: string;
}

interface ProductManagementItem {
  productId?: string;
  name: string;
  description?: string;
  unitPrice: number;
  oldPrice?: number;
  unitType: string;
  category?: string;
  subcategory?: string;
  colorHex: string;
  photoUrl?: string;
  isActive: boolean;
  showPricingBeforeSubmit: boolean;
  displayOrder: number;
  isNew?: boolean;
}

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

    console.log(`Processing product file for contractor: ${contractor.id}`);

    const formData = await req.formData();
    const file = formData.get('file') as File;
    const mode = formData.get('mode') as string || 'pricing_only';

    if (!file) {
      throw new Error('No file uploaded');
    }

    const csvText = await file.text();
    const lines = csvText.split('\n').filter(line => line.trim());

    if (lines.length < 2) {
      throw new Error('File must contain at least a header row and one data row');
    }

    const headers = lines[0].split(',').map(h => h.trim().replace(/"/g, ''));
    console.log('CSV headers:', headers);

    // Validate required columns based on mode
    const requiredColumns = mode === 'pricing_only' 
      ? ['Product ID', 'New Price']
      : ['Product Name', 'Unit Price'];

    const missingColumns = requiredColumns.filter(col => 
      !headers.some(h => h.toLowerCase().includes(col.toLowerCase()))
    );

    if (missingColumns.length > 0) {
      throw new Error(`Missing required columns: ${missingColumns.join(', ')}`);
    }

    // Get existing products and categories for validation
    const { data: existingProducts, error: productsError } = await supabaseClient
      .from('products')
      .select('id, name, unit_price, category, subcategory')
      .eq('contractor_id', contractor.id);

    if (productsError) {
      throw new Error(`Error fetching products: ${productsError.message}`);
    }

    const { data: existingCategories, error: categoriesError } = await supabaseClient
      .from('product_categories')
      .select('id, name')
      .eq('contractor_id', contractor.id);

    if (categoriesError) {
      console.warn('Could not fetch categories:', categoriesError.message);
    }

    const productMap = new Map(existingProducts?.map(p => [p.id, p]) || []);
    const productNameMap = new Map(existingProducts?.map(p => [p.name.toLowerCase(), p]) || []);
    const categoryMap = new Map(existingCategories?.map(c => [c.name.toLowerCase(), c]) || []);

    const errors: ValidationError[] = [];
    const preview: ProductManagementItem[] = [];
    let validRows = 0;

    // Process each data row
    for (let i = 1; i < lines.length && i <= 501; i++) { // Limit to 500 products + header
      const values = lines[i].split(',').map(v => v.trim().replace(/"/g, ''));
      
      if (values.length < headers.length && values.join('').trim() === '') {
        continue; // Skip empty rows
      }

      const row: any = {};
      headers.forEach((header, index) => {
        row[header] = values[index] || '';
      });

      const rowErrors: ValidationError[] = [];
      let item: ProductManagementItem;

      if (mode === 'pricing_only') {
        // Pricing-only mode
        const productId = row['Product ID'] || row['Product Id'] || row['product_id'];
        const productName = row['Product Name'] || row['Product'] || row['Name'];
        const newPriceStr = row['New Price'] || row['Price'] || row['Unit Price'];

        let existingProduct: any = null;
        
        if (productId) {
          existingProduct = productMap.get(productId);
          if (!existingProduct) {
            rowErrors.push({ row: i, field: 'Product ID', message: 'Product not found' });
          }
        } else if (productName) {
          existingProduct = productNameMap.get(productName.toLowerCase());
          if (!existingProduct) {
            rowErrors.push({ row: i, field: 'Product Name', message: 'Product not found' });
          }
        } else {
          rowErrors.push({ row: i, field: 'Product ID/Name', message: 'Product ID or Name is required' });
        }

        if (!newPriceStr) {
          rowErrors.push({ row: i, field: 'New Price', message: 'New price is required' });
        }

        const newPrice = parseFloat(newPriceStr);
        if (isNaN(newPrice) || newPrice < 0) {
          rowErrors.push({ row: i, field: 'New Price', message: 'Must be a valid positive number' });
        }

        if (rowErrors.length === 0 && existingProduct) {
          item = {
            productId: existingProduct.id,
            name: existingProduct.name,
            unitPrice: newPrice,
            oldPrice: existingProduct.unit_price,
            unitType: existingProduct.unit_type || 'sq_ft',
            colorHex: '#3B82F6',
            isActive: true,
            showPricingBeforeSubmit: true,
            displayOrder: 0
          };
          preview.push(item);
          validRows++;
        }
      } else {
        // Full management mode
        const productId = row['Product ID'] || row['Product Id'];
        const productName = row['Product Name'] || row['Name'];
        const description = row['Description'] || '';
        const unitPriceStr = row['Unit Price'] || row['Price'];
        const unitType = row['Unit Type'] || row['Unit'] || 'sq_ft';
        const category = row['Category'] || '';
        const subcategory = row['Subcategory'] || '';
        const colorHex = row['Color Hex'] || row['Color'] || '#3B82F6';
        const photoUrl = row['Photo URL'] || row['Photo'] || '';
        const isActiveStr = row['Active'] || row['Is Active'] || 'TRUE';
        const showPricingStr = row['Show Pricing Before Submit'] || 'TRUE';
        const displayOrderStr = row['Display Order'] || '0';

        // Validation
        if (!productName) {
          rowErrors.push({ row: i, field: 'Product Name', message: 'Product name is required' });
        }

        if (!unitPriceStr) {
          rowErrors.push({ row: i, field: 'Unit Price', message: 'Unit price is required' });
        }

        const unitPrice = parseFloat(unitPriceStr);
        if (isNaN(unitPrice) || unitPrice < 0) {
          rowErrors.push({ row: i, field: 'Unit Price', message: 'Must be a valid positive number' });
        }

        const validUnitTypes = ['sq_ft', 'linear_ft', 'each', 'hour', 'yard', 'ton'];
        if (!validUnitTypes.includes(unitType)) {
          rowErrors.push({ row: i, field: 'Unit Type', message: `Must be one of: ${validUnitTypes.join(', ')}` });
        }

        if (colorHex && !/^#[0-9A-Fa-f]{6}$/.test(colorHex)) {
          rowErrors.push({ row: i, field: 'Color Hex', message: 'Must be a valid hex color (e.g., #3B82F6)' });
        }

        if (rowErrors.length === 0) {
          const isExisting = productId && productMap.has(productId);
          const existingProduct = isExisting ? productMap.get(productId) : null;

          item = {
            productId: productId || undefined,
            name: productName,
            description,
            unitPrice,
            oldPrice: existingProduct?.unit_price,
            unitType,
            category,
            subcategory,
            colorHex: colorHex || '#3B82F6',
            photoUrl,
            isActive: isActiveStr.toLowerCase() === 'true',
            showPricingBeforeSubmit: showPricingStr.toLowerCase() === 'true',
            displayOrder: parseInt(displayOrderStr) || 0,
            isNew: !isExisting
          };
          preview.push(item);
          validRows++;
        }
      }

      errors.push(...rowErrors);
    }

    console.log(`Processed ${validRows} valid rows with ${errors.length} errors`);

    return new Response(JSON.stringify({
      preview,
      errors,
      summary: {
        totalRows: lines.length - 1,
        validRows,
        errorRows: errors.length,
        mode
      }
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error) {
    console.error('Error in process-product-file function:', error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});