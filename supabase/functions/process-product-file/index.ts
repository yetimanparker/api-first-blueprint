import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import * as XLSX from "https://cdn.sheetjs.com/xlsx-0.20.0/package/xlsx.mjs";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Helper function to normalize unit types to database format
function normalizeUnitType(unitType: string): string {
  const normalized = unitType.toLowerCase().trim().replace(/\s+/g, '');
  const mapping: Record<string, string> = {
    'sqft': 'sq_ft',
    'sq_ft': 'sq_ft',
    'squarefeet': 'sq_ft',
    'linearft': 'linear_ft',
    'linear_ft': 'linear_ft',
    'linearfeet': 'linear_ft',
    'cubicyard': 'cubic_yard',
    'cubic_yard': 'cubic_yard',
    'cubicyards': 'cubic_yard',
    'each': 'each',
    'hour': 'hour',
    'pound': 'pound',
    'ton': 'ton',
    'pallet': 'pallet'
  };
  return mapping[normalized] || normalized;
}

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
  isNewCategory?: boolean;
  isNewSubcategory?: boolean;
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

    let lines: string[] = [];
    const fileName = file.name.toLowerCase();
    
    // Check if file is Excel
    if (fileName.endsWith('.xlsx') || fileName.endsWith('.xls')) {
      const arrayBuffer = await file.arrayBuffer();
      const workbook = XLSX.read(arrayBuffer, { type: 'array' });
      const firstSheetName = workbook.SheetNames[0];
      const worksheet = workbook.Sheets[firstSheetName];
      const csvText = XLSX.utils.sheet_to_csv(worksheet);
      lines = csvText.split('\n').filter(line => line.trim());
    } else {
      // Process as CSV
      const csvText = await file.text();
      lines = csvText.split('\n').filter(line => line.trim());
    }

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
        const unitType = normalizeUnitType(row['Unit Type'] || row['Unit'] || 'sq_ft');
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
        } else {
          const unitPrice = parseFloat(unitPriceStr);
          if (isNaN(unitPrice)) {
            rowErrors.push({ row: i, field: 'Unit Price', message: 'Must be a valid number' });
          } else if (unitPrice < 0) {
            rowErrors.push({ row: i, field: 'Unit Price', message: 'Must be a positive number' });
          }
        }

        if (!unitType) {
          rowErrors.push({ row: i, field: 'Unit Type', message: 'Unit type is required' });
        }

        const unitPrice = parseFloat(unitPriceStr);
        if (isNaN(unitPrice) || unitPrice < 0) {
          // Already handled above, skip duplicate
        }

        // Validate unit type (after normalization)
        const validUnitTypes = ['sq_ft', 'linear_ft', 'cubic_yard', 'each', 'hour', 'pound', 'ton', 'pallet'];
        if (unitType && !validUnitTypes.includes(unitType)) {
          rowErrors.push({ 
            row: i + 2, 
            field: 'Unit Type', 
            message: `Invalid unit type "${row['Unit Type'] || row['Unit']}". Accepted formats: sq_ft (or sqft), linear_ft (or linearft), cubic_yard (or cubicyard), each, hour, pound, ton, pallet` 
          });
        }

        // Validate display order is a number
        const displayOrder = parseInt(displayOrderStr);
        if (displayOrderStr && isNaN(displayOrder)) {
          rowErrors.push({ row: i, field: 'Display Order', message: 'Must be a valid number' });
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
          
          // Convert category and subcategory to IDs, allow new categories/subcategories
          let categoryValue = undefined;
          let subcategoryValue = undefined;
          let isNewCategory = false;
          let isNewSubcategory = false;

          if (category) {
            // Check if it's a UUID
            if (category.match(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i)) {
              // Verify the UUID exists in our category map
              if (categoryMap.has(category)) {
                categoryValue = category;
              } else {
                rowErrors.push({ row: i, field: 'Category', message: `Category UUID "${category}" not found` });
              }
            } else {
              // It's a name, look it up or mark as new
              const existingCategoryId = categoryNameToIdMap.get(category.toLowerCase());
              if (existingCategoryId) {
                categoryValue = existingCategoryId;
              } else {
                // New category - use the name, will be created during apply
                categoryValue = category;
                isNewCategory = true;
              }
            }
          }

          if (subcategory) {
            // Check if it's a UUID
            if (subcategory.match(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i)) {
              // Verify the UUID exists
              const subcat = Array.from(subcategoryMap.values()).find(s => s.id === subcategory);
              if (subcat) {
                subcategoryValue = subcategory;
                
                // Check if subcategory belongs to the specified category
                if (categoryValue && typeof categoryValue === 'string' && 
                    categoryValue.match(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i)) {
                  // Category is a UUID, check if subcategory belongs to it
                  if (subcat.category_id !== categoryValue) {
                    rowErrors.push({ 
                      row: i, 
                      field: 'Subcategory', 
                      message: `Subcategory "${subcat.name}" will be auto-resolved under new category` 
                    });
                  }
                }
              } else {
                rowErrors.push({ row: i, field: 'Subcategory', message: `Subcategory UUID "${subcategory}" not found` });
              }
            } else {
              // It's a name, look it up or mark as new
              const existingSubcategoryId = subcategoryNameToIdMap.get(subcategory.toLowerCase());
              if (existingSubcategoryId) {
                subcategoryValue = existingSubcategoryId;
              } else {
                // New subcategory - use the name, will be created during apply
                subcategoryValue = subcategory;
                isNewSubcategory = true;
              }
            }
          }

          item = {
            productId: resolvedProductId || undefined,
            name: productName,
            description,
            unitPrice,
            oldPrice: existingProduct?.unit_price,
            unitType,
            category: categoryValue,
            subcategory: subcategoryValue,
            photoUrl,
            isActive: isActiveStr.toLowerCase() === 'true',
            displayOrder: parseInt(displayOrderStr) || 0,
            isNew: !isExisting,
            isNewCategory,
            isNewSubcategory
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