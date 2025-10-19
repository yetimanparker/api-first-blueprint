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
  photoUrl?: string;
  isActive: boolean;
  displayOrder: number;
  isNew?: boolean;
}

function parseCSVLine(line: string): string[] {
  const result: string[] = [];
  let current = '';
  let inQuotes = false;
  
  for (let i = 0; i < line.length; i++) {
    const char = line[i];
    const nextChar = line[i + 1];
    
    if (char === '"') {
      if (inQuotes && nextChar === '"') {
        // Escaped quote
        current += '"';
        i++; // Skip next quote
      } else {
        // Toggle quote state
        inQuotes = !inQuotes;
      }
    } else if (char === ',' && !inQuotes) {
      // Field separator (only when not in quotes)
      result.push(current.trim());
      current = '';
    } else {
      current += char;
    }
  }
  
  // Add the last field
  result.push(current.trim());
  
  return result;
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

    const headers = parseCSVLine(lines[0]);
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
      .select('id, name, unit_price, category, subcategory, display_order')
      .eq('contractor_id', contractor.id)
      .order('display_order', { ascending: true });

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

    const { data: existingSubcategories, error: subcategoriesError } = await supabaseClient
      .from('product_subcategories')
      .select('id, name, category_id')
      .eq('is_active', true);

    if (subcategoriesError) {
      console.warn('Could not fetch subcategories:', subcategoriesError.message);
    }

    // Create lookup maps
    const productMap = new Map(existingProducts?.map(p => [p.id, p]) || []);
    const productNameMap = new Map(existingProducts?.map(p => [p.name.toLowerCase(), p]) || []);
    const categoryMap = new Map(existingCategories?.map(c => [c.name.toLowerCase(), c]) || []);
    const categoryNameToIdMap = new Map(existingCategories?.map(c => [c.name.toLowerCase(), c.id]) || []);
    const subcategoryMap = new Map(existingSubcategories?.map(s => [s.name.toLowerCase(), s]) || []);
    const subcategoryNameToIdMap = new Map(existingSubcategories?.map(s => [s.name.toLowerCase(), s.id]) || []);
    
    // Create sequential ID to product mapping (for shortened IDs)
    const sequentialIdToProduct = new Map(existingProducts?.map((p, index) => [(index + 1).toString(), p]) || []);

    const errors: ValidationError[] = [];
    const preview: ProductManagementItem[] = [];
    let validRows = 0;

    // Process each data row
    for (let i = 1; i < lines.length && i <= 501; i++) { // Limit to 500 products + header
      const values = parseCSVLine(lines[i]);
      
      if (values.length < headers.length && values.join('').trim() === '') {
        continue; // Skip empty rows
      }

      // Validate column count matches header count
      if (values.length !== headers.length) {
        console.warn(`Row ${i}: Expected ${headers.length} columns, got ${values.length}`);
        // Pad with empty strings if needed
        while (values.length < headers.length) {
          values.push('');
        }
      }

      const row: any = {};
      headers.forEach((header, index) => {
        row[header] = values[index] ? values[index].trim() : '';
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
          // Try UUID first, then sequential ID
          existingProduct = productMap.get(productId) || sequentialIdToProduct.get(productId);
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
            isActive: true,
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
        const photoUrl = row['Photo URL'] || row['Photo'] || '';
        const isActiveStr = row['Active'] || row['Is Active'] || 'TRUE';
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

        const validUnitTypes = ['sq_ft', 'linear_ft', 'cubic_yard', 'each', 'hour', 'yard', 'ton'];
        if (!validUnitTypes.includes(unitType)) {
          rowErrors.push({ row: i, field: 'Unit Type', message: `Must be one of: ${validUnitTypes.join(', ')}` });
        }

        if (rowErrors.length === 0) {
          // Handle product ID resolution (UUID or sequential)
          let resolvedProductId = productId;
          let existingProduct = null;
          
          if (productId) {
            existingProduct = productMap.get(productId) || sequentialIdToProduct.get(productId);
            if (existingProduct) {
              resolvedProductId = existingProduct.id; // Always use UUID internally
            }
          }
          
          const isExisting = !!existingProduct;
          
          // Convert category and subcategory names to UUIDs if needed
          let categoryId = category;
          let subcategoryId = subcategory;
          
          if (category && !category.match(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i)) {
            categoryId = categoryNameToIdMap.get(category.toLowerCase()) || category;
          }
          
          if (subcategory && !subcategory.match(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i)) {
            subcategoryId = subcategoryNameToIdMap.get(subcategory.toLowerCase()) || subcategory;
          }

          item = {
            productId: resolvedProductId || undefined,
            name: productName,
            description,
            unitPrice,
            oldPrice: existingProduct?.unit_price,
            unitType,
            category: categoryId,
            subcategory: subcategoryId,
            photoUrl,
            isActive: isActiveStr.toLowerCase() === 'true',
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
    return new Response(JSON.stringify({ error: error instanceof Error ? error.message : 'Unknown error' }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});