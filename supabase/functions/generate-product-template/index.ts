import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import * as XLSX from "https://cdn.sheetjs.com/xlsx-0.20.0/package/xlsx.mjs";

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

    const { mode = 'pricing_only', format = 'excel' } = await req.json();
    console.log(`Generating ${mode} template (${format}) for contractor: ${contractor.id}`);

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

    // Get contractor settings for unit types
    const { data: settings } = await supabaseClient
      .from('contractor_settings')
      .select('default_unit_type')
      .eq('contractor_id', contractor.id)
      .single();

    // Define available unit types
    const unitTypes = ['sqft', 'linearft', 'cubicyard', 'each', 'hour', 'pound', 'ton', 'pallet'];
    
    // Create lookup maps for category and subcategory UUIDs to names
    const categoryMap = new Map(categories?.map(c => [c.id, c.name]) || []);
    const subcategoryMap = new Map(subcategories?.map(s => [s.id, s.name]) || []);
    const categoryNames = categories?.map(c => c.name) || [];
    const subcategoryNames = subcategories?.map(s => s.name) || [];

    console.log(`Found ${products?.length || 0} products for template`);

    // Generate Excel file if format is excel
    if (format === 'excel') {
      const workbook = XLSX.utils.book_new();
      
      if (mode === 'pricing_only') {
        // Pricing-only template
        const data = [
          ['Product ID', 'Product Name', 'Current Price', 'New Price']
        ];
        
        if (products && products.length > 0) {
          products.forEach((product, index) => {
            const shortId = (index + 1).toString();
            data.push([shortId, product.name, product.unit_price, product.unit_price]);
          });
        } else {
          data.push(['1', 'Sample Product', 10.00, 12.00]);
        }
        
        const worksheet = XLSX.utils.aoa_to_sheet(data);
        XLSX.utils.book_append_sheet(workbook, worksheet, 'Products');
      } else {
        // Full management template with dropdowns
        const data = [
          ['Product ID', 'Product Name', 'Description', 'Unit Price', 'Unit Type', 'Category', 'Subcategory', 'Photo URL', 'Active', 'Display Order']
        ];
        
        if (products && products.length > 0) {
          products.forEach((product, index) => {
            const shortId = (index + 1).toString();
            const categoryName = categoryMap.get(product.category) || '';
            const subcategoryName = subcategoryMap.get(product.subcategory) || '';
            
            data.push([
              shortId,
              product.name,
              product.description || '',
              product.unit_price,
              product.unit_type,
              categoryName,
              subcategoryName,
              product.photo_url || '',
              product.is_active ? 'TRUE' : 'FALSE',
              product.display_order || 0
            ]);
          });
        } else {
          // Sample rows
          const sampleCategories = categoryNames.length > 0 ? categoryNames.slice(0, 3) : ['Fencing', 'Decking', 'Landscaping'];
          sampleCategories.forEach((category, index) => {
            data.push([
              '',
              `Sample ${category} Product`,
              `Description for ${category.toLowerCase()} service`,
              (15 + index * 5).toFixed(2),
              index === 0 ? 'linearft' : index === 1 ? 'sqft' : 'each',
              category,
              '',
              '',
              'TRUE',
              index
            ]);
          });
        }
        
        const worksheet = XLSX.utils.aoa_to_sheet(data);
        
        // Add data validation for dropdowns
        const rowCount = data.length;
        
        // Unit Type dropdown (column E, index 4)
        for (let i = 2; i <= Math.max(rowCount, 100); i++) {
          const cellRef = `E${i}`;
          if (!worksheet[cellRef]) worksheet[cellRef] = { t: 's', v: '' };
          worksheet[cellRef].s = {
            validation: {
              type: 'list',
              operator: 'equal',
              formula1: `"${unitTypes.join(',')}"`,
              showDropDown: true
            }
          };
        }
        
        // Category dropdown (column F, index 5)
        if (categoryNames.length > 0) {
          for (let i = 2; i <= Math.max(rowCount, 100); i++) {
            const cellRef = `F${i}`;
            if (!worksheet[cellRef]) worksheet[cellRef] = { t: 's', v: '' };
            worksheet[cellRef].s = {
              validation: {
                type: 'list',
                operator: 'equal',
                formula1: `"${categoryNames.join(',')}"`,
                showDropDown: true
              }
            };
          }
        }
        
        // Subcategory dropdown (column G, index 6)
        if (subcategoryNames.length > 0) {
          for (let i = 2; i <= Math.max(rowCount, 100); i++) {
            const cellRef = `G${i}`;
            if (!worksheet[cellRef]) worksheet[cellRef] = { t: 's', v: '' };
            worksheet[cellRef].s = {
              validation: {
                type: 'list',
                operator: 'equal',
                formula1: `"${subcategoryNames.join(',')}"`,
                showDropDown: true
              }
            };
          }
        }
        
        // Active dropdown (column I, index 8)
        for (let i = 2; i <= Math.max(rowCount, 100); i++) {
          const cellRef = `I${i}`;
          if (!worksheet[cellRef]) worksheet[cellRef] = { t: 's', v: '' };
          worksheet[cellRef].s = {
            validation: {
              type: 'list',
              operator: 'equal',
              formula1: '"TRUE,FALSE"',
              showDropDown: true
            }
          };
        }
        
        // Create hidden Dropdowns sheet with reference data
        const dropdownData = [
          ['Unit Types', 'Categories', 'Subcategories'],
          ...Array.from({ length: Math.max(unitTypes.length, categoryNames.length, subcategoryNames.length) }, (_, i) => [
            unitTypes[i] || '',
            categoryNames[i] || '',
            subcategoryNames[i] || ''
          ])
        ];
        
        const dropdownSheet = XLSX.utils.aoa_to_sheet(dropdownData);
        XLSX.utils.book_append_sheet(workbook, dropdownSheet, 'Dropdowns');
        
        XLSX.utils.book_append_sheet(workbook, worksheet, 'Products');
      }
      
      // Write workbook to buffer
      const excelBuffer = XLSX.write(workbook, { type: 'buffer', bookType: 'xlsx' });
      
      console.log('Excel template generated successfully');
      
      return new Response(excelBuffer, {
        headers: {
          ...corsHeaders,
          'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        },
      });
    }
    
    // Fallback to CSV format
    let csvContent = '';
    
    if (mode === 'pricing_only') {
      csvContent = 'Product ID,Product Name,Current Price,New Price\n';
      
      if (products && products.length > 0) {
        products.forEach((product, index) => {
          const shortId = (index + 1).toString();
          csvContent += `${shortId},"${product.name}",${product.unit_price},${product.unit_price}\n`;
        });
      } else {
        csvContent += '1,"Sample Product",10.00,12.00\n';
      }
    } else {
      csvContent = [
        'Product ID',
        'Product Name',
        'Description',
        'Unit Price',
        'Unit Type',
        'Category',
        'Subcategory',
        'Photo URL',
        'Active',
        'Display Order'
      ].join(',') + '\n';

      if (products && products.length > 0) {
        products.forEach((product, index) => {
          const shortId = (index + 1).toString();
          const categoryName = categoryMap.get(product.category) || '';
          const subcategoryName = subcategoryMap.get(product.subcategory) || '';
          
          csvContent += [
            shortId,
            `"${product.name}"`,
            `"${product.description || ''}"`,
            product.unit_price,
            product.unit_type,
            `"${categoryName}"`,
            `"${subcategoryName}"`,
            `"${product.photo_url || ''}"`,
            product.is_active ? 'TRUE' : 'FALSE',
            product.display_order || 0
          ].join(',') + '\n';
        });
      } else {
        const sampleCategories = categoryNames.length > 0 ? categoryNames.slice(0, 3) : ['Fencing', 'Decking', 'Landscaping'];
        sampleCategories.forEach((category, index) => {
          csvContent += [
            '',
            `"Sample ${category} Product"`,
            `"Description for ${category.toLowerCase()} service"`,
            (15 + index * 5).toFixed(2),
            index === 0 ? 'linearft' : index === 1 ? 'sqft' : 'each',
            `"${category}"`,
            '""',
            '""',
            'TRUE',
            index
          ].join(',') + '\n';
        });
      }
    }

    console.log('CSV template generated successfully');

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