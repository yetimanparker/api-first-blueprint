import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import ExcelJS from "https://esm.sh/exceljs@4.4.0";

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
    
    // Helper function to resolve category/subcategory (handles both UUID and text names)
    const resolveCategoryName = (value: any) => {
      if (!value) return '';
      // Check if it's a UUID
      if (typeof value === 'string' && value.match(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i)) {
        return categoryMap.get(value) || '';
      }
      // Otherwise assume it's already a name
      return value;
    };
    
    const resolveSubcategoryName = (value: any) => {
      if (!value) return '';
      // Check if it's a UUID
      if (typeof value === 'string' && value.match(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i)) {
        return subcategoryMap.get(value) || '';
      }
      // Otherwise assume it's already a name
      return value;
    };

    console.log(`Found ${products?.length || 0} products for template`);

    // Generate Excel file if format is excel
    if (format === 'excel') {
      const workbook = new ExcelJS.Workbook();
      workbook.creator = 'Bulk Product Management';
      workbook.created = new Date();
      
      if (mode === 'pricing_only') {
        // Pricing-only template
        const worksheet = workbook.addWorksheet('Products');
        
        // Add headers
        worksheet.columns = [
          { header: 'Product ID', key: 'productId', width: 12 },
          { header: 'Product Name', key: 'productName', width: 30 },
          { header: 'Category', key: 'category', width: 20 },
          { header: 'Subcategory', key: 'subcategory', width: 20 },
          { header: 'Unit Type', key: 'unitType', width: 15 },
          { header: 'Current Price', key: 'currentPrice', width: 15 },
          { header: 'New Price', key: 'newPrice', width: 15 }
        ];
        
        // Style header row
        worksheet.getRow(1).font = { bold: true };
        worksheet.getRow(1).fill = {
          type: 'pattern',
          pattern: 'solid',
          fgColor: { argb: 'FFE0E0E0' }
        };
        
        if (products && products.length > 0) {
          products.forEach((product, index) => {
            const shortId = (index + 1).toString();
            const categoryName = resolveCategoryName(product.category);
            const subcategoryName = resolveSubcategoryName(product.subcategory);
            
            worksheet.addRow({
              productId: shortId,
              productName: product.name,
              category: categoryName,
              subcategory: subcategoryName,
              unitType: product.unit_type,
              currentPrice: product.unit_price,
              newPrice: product.unit_price
            });
          });
        } else {
          worksheet.addRow({
            productId: '1',
            productName: 'Sample Product',
            category: 'Fencing',
            subcategory: '',
            unitType: 'linearft',
            currentPrice: 10.00,
            newPrice: 12.00
          });
        }
      } else {
        // Full management template with dropdowns
        const worksheet = workbook.addWorksheet('Products');
        
        // Define columns with proper widths
        worksheet.columns = [
          { header: 'Product ID', key: 'productId', width: 12 },
          { header: 'Product Name', key: 'productName', width: 30 },
          { header: 'Description', key: 'description', width: 40 },
          { header: 'Unit Price', key: 'unitPrice', width: 12 },
          { header: 'Unit Type', key: 'unitType', width: 15 },
          { header: 'Category', key: 'category', width: 20 },
          { header: 'Subcategory', key: 'subcategory', width: 20 },
          { header: 'Photo URL', key: 'photoUrl', width: 30 },
          { header: 'Active', key: 'active', width: 10 },
          { header: 'Display Order', key: 'displayOrder', width: 15 }
        ];
        
        // Style header row
        worksheet.getRow(1).font = { bold: true };
        worksheet.getRow(1).fill = {
          type: 'pattern',
          pattern: 'solid',
          fgColor: { argb: 'FFE0E0E0' }
        };
        
        // Add data rows
        if (products && products.length > 0) {
          products.forEach((product, index) => {
            const shortId = (index + 1).toString();
            const categoryName = resolveCategoryName(product.category);
            const subcategoryName = resolveSubcategoryName(product.subcategory);
            
            worksheet.addRow({
              productId: shortId,
              productName: product.name,
              description: product.description || '',
              unitPrice: product.unit_price,
              unitType: product.unit_type,
              category: categoryName,
              subcategory: subcategoryName,
              photoUrl: product.photo_url || '',
              active: product.is_active ? 'TRUE' : 'FALSE',
              displayOrder: product.display_order || 0
            });
          });
        } else {
          // Sample rows
          const sampleCategories = categoryNames.length > 0 ? categoryNames.slice(0, 3) : ['Fencing', 'Decking', 'Landscaping'];
          sampleCategories.forEach((category, index) => {
            worksheet.addRow({
              productId: '',
              productName: `Sample ${category} Product`,
              description: `Description for ${category.toLowerCase()} service`,
              unitPrice: (15 + index * 5).toFixed(2),
              unitType: index === 0 ? 'linearft' : index === 1 ? 'sqft' : 'each',
              category: category,
              subcategory: '',
              photoUrl: '',
              active: 'TRUE',
              displayOrder: index
            });
          });
        }
        
        // Create Dropdowns reference sheet
        const dropdownSheet = workbook.addWorksheet('Dropdowns');
        dropdownSheet.state = 'hidden'; // Hide the dropdown sheet
        
        // Add dropdown values
        dropdownSheet.addRow(['Unit Types', 'Categories', 'Subcategories', 'Active Values']);
        const maxRows = Math.max(unitTypes.length, categoryNames.length, subcategoryNames.length, 2);
        
        for (let i = 0; i < maxRows; i++) {
          dropdownSheet.addRow([
            unitTypes[i] || '',
            categoryNames[i] || '',
            subcategoryNames[i] || '',
            i < 2 ? (i === 0 ? 'TRUE' : 'FALSE') : ''
          ]);
        }
        
        // Add data validation to columns
        const dataRowCount = worksheet.rowCount;
        const validationRows = Math.max(dataRowCount, 100);
        
        // Unit Type dropdown (column E)
        for (let i = 2; i <= validationRows; i++) {
          worksheet.getCell(`E${i}`).dataValidation = {
            type: 'list',
            allowBlank: false,
            formulae: [`Dropdowns!$A$2:$A$${unitTypes.length + 1}`],
            showErrorMessage: true,
            errorTitle: 'Invalid Unit Type',
            error: 'Please select a valid unit type from the dropdown'
          };
        }
        
        // Category dropdown (column F)
        if (categoryNames.length > 0) {
          for (let i = 2; i <= validationRows; i++) {
            worksheet.getCell(`F${i}`).dataValidation = {
              type: 'list',
              allowBlank: true,
              formulae: [`Dropdowns!$B$2:$B$${categoryNames.length + 1}`],
              showErrorMessage: true,
              errorTitle: 'Invalid Category',
              error: 'Please select a valid category from the dropdown'
            };
          }
        }
        
        // Subcategory dropdown (column G)
        if (subcategoryNames.length > 0) {
          for (let i = 2; i <= validationRows; i++) {
            worksheet.getCell(`G${i}`).dataValidation = {
              type: 'list',
              allowBlank: true,
              formulae: [`Dropdowns!$C$2:$C$${subcategoryNames.length + 1}`],
              showErrorMessage: true,
              errorTitle: 'Invalid Subcategory',
              error: 'Please select a valid subcategory from the dropdown'
            };
          }
        }
        
        // Active dropdown (column I)
        for (let i = 2; i <= validationRows; i++) {
          worksheet.getCell(`I${i}`).dataValidation = {
            type: 'list',
            allowBlank: false,
            formulae: ['Dropdowns!$D$2:$D$3'],
            showErrorMessage: true,
            errorTitle: 'Invalid Active Value',
            error: 'Please select TRUE or FALSE from the dropdown'
          };
        }
      }
      
      // Write workbook to buffer
      const buffer = await workbook.xlsx.writeBuffer();
      
      console.log('Excel template generated successfully');
      
      return new Response(buffer, {
        headers: {
          ...corsHeaders,
          'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        },
      });
    }
    
    // Fallback to CSV format
    let csvContent = '';
    
    if (mode === 'pricing_only') {
      csvContent = 'Product ID,Product Name,Category,Subcategory,Unit Type,Current Price,New Price\n';
      
      if (products && products.length > 0) {
        products.forEach((product, index) => {
          const shortId = (index + 1).toString();
          const categoryName = resolveCategoryName(product.category);
          const subcategoryName = resolveSubcategoryName(product.subcategory);
          csvContent += `${shortId},"${product.name}","${categoryName}","${subcategoryName}",${product.unit_type},${product.unit_price},${product.unit_price}\n`;
        });
      } else {
        csvContent += '1,"Sample Product","Fencing","",linearft,10.00,12.00\n';
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
          const categoryName = resolveCategoryName(product.category);
          const subcategoryName = resolveSubcategoryName(product.subcategory);
          
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