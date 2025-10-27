import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface ProductUpdate {
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

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
    );

    // Get the authenticated user
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      throw new Error('Authorization header required');
    }

    const { data: userData, error: userError } = await supabaseClient.auth.getUser(
      authHeader.replace('Bearer ', '')
    );
    
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

    const { updates, batchId, mode = 'pricing_only' } = await req.json();

    if (!updates || !Array.isArray(updates)) {
      throw new Error('Updates array is required');
    }

    if (!batchId) {
      throw new Error('Batch ID is required');
    }

    console.log(`Processing ${updates.length} product updates for contractor: ${contractor.id}`);

    // Get existing categories for lookups
    const { data: existingCategories, error: categoriesError } = await supabaseClient
      .from('product_categories')
      .select('id, name')
      .eq('contractor_id', contractor.id);

    if (categoriesError) {
      console.warn('Could not fetch categories:', categoriesError.message);
    }

    const categoryMap = new Map(existingCategories?.map(c => [c.name.toLowerCase(), c.id]) || []);
    const results = [];
    let successCount = 0;
    const historyEntries = [];

    for (const update of updates as ProductUpdate[]) {
      try {
        let result: any = { success: false };

        if (mode === 'pricing_only') {
          // Pricing-only update
          if (!update.productId) {
            result.error = 'Product ID is required for pricing updates';
            results.push(result);
            continue;
          }

          const { error: updateError } = await supabaseClient
            .from('products')
            .update({
              unit_price: update.unitPrice,
              updated_at: new Date().toISOString()
            })
            .eq('id', update.productId)
            .eq('contractor_id', contractor.id);

          if (updateError) {
            result.error = updateError.message;
          } else {
            result.success = true;
            successCount++;

            // Add to pricing history
            if (update.oldPrice && update.oldPrice !== update.unitPrice) {
              historyEntries.push({
                product_id: update.productId,
                contractor_id: contractor.id,
                old_price: update.oldPrice,
                new_price: update.unitPrice,
                change_type: 'bulk_update',
                batch_id: batchId,
                changed_by: userData.user.id,
                change_reason: 'Bulk pricing update'
              });
            }
          }
        } else {
          // Full product management
          let categoryId = null;
          let subcategoryId = null;

          // Handle category creation/lookup
          if (update.category) {
            // First check if it's already a valid UUID that exists
            if (update.category.match(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i)) {
              // It's a UUID - verify it exists for this contractor
              const { data: existingCat } = await supabaseClient
                .from('product_categories')
                .select('id')
                .eq('id', update.category)
                .eq('contractor_id', contractor.id)
                .single();
              
              if (existingCat) {
                categoryId = existingCat.id;
              } else {
                console.warn(`Category UUID ${update.category} not found for contractor`);
              }
            } else {
              // It's a name - look it up or create it
              const categoryKey = update.category.toLowerCase();
              if (categoryMap.has(categoryKey)) {
                categoryId = categoryMap.get(categoryKey);
              } else {
                // Create new category
                const { data: newCategory, error: categoryError } = await supabaseClient
                  .from('product_categories')
                  .insert({
                    name: update.category,
                    contractor_id: contractor.id,
                    color_hex: '#3B82F6'
                  })
                  .select('id')
                  .single();

                if (categoryError) {
                  console.warn(`Could not create category ${update.category}:`, categoryError.message);
                } else {
                  categoryId = newCategory.id;
                  categoryMap.set(categoryKey, categoryId);
                }
              }
            }
          }

          // Handle subcategory if provided
          if (update.subcategory && categoryId) {
            // Check if it's already a UUID
            if (update.subcategory.match(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i)) {
              // It's a UUID - verify it exists and belongs to the category
              const { data: existingSubcategory } = await supabaseClient
                .from('product_subcategories')
                .select('id, name, category_id')
                .eq('id', update.subcategory)
                .single();

              if (existingSubcategory) {
                // Check if subcategory belongs to the target category
                if (existingSubcategory.category_id === categoryId) {
                  subcategoryId = existingSubcategory.id;
                } else {
                  // Subcategory exists but belongs to different category
                  // Try to find or create subcategory with same name under new category
                  console.log(`Subcategory "${existingSubcategory.name}" belongs to different category, auto-resolving...`);
                  
                  const { data: matchingSubcategory } = await supabaseClient
                    .from('product_subcategories')
                    .select('id')
                    .eq('name', existingSubcategory.name)
                    .eq('category_id', categoryId)
                    .single();

                  if (matchingSubcategory) {
                    subcategoryId = matchingSubcategory.id;
                    console.log(`Auto-resolved to existing subcategory "${existingSubcategory.name}" under new category`);
                    result.subcategoryAutoResolved = true;
                  } else {
                    // Create new subcategory with same name under new category
                    const { data: newSubcategory, error: subcategoryError } = await supabaseClient
                      .from('product_subcategories')
                      .insert({
                        name: existingSubcategory.name,
                        category_id: categoryId
                      })
                      .select('id')
                      .single();

                    if (!subcategoryError && newSubcategory) {
                      subcategoryId = newSubcategory.id;
                      console.log(`Created new subcategory "${existingSubcategory.name}" under new category`);
                      result.subcategoryCreated = true;
                      result.originalSubcategoryName = existingSubcategory.name;
                    } else {
                      console.warn(`Failed to create subcategory: ${subcategoryError?.message}`);
                    }
                  }
                }
              } else {
                console.warn(`Subcategory UUID ${update.subcategory} not found`);
              }
            } else {
              // It's a name - look it up by name
              const { data: existingSubcategory } = await supabaseClient
                .from('product_subcategories')
                .select('id')
                .eq('name', update.subcategory)
                .eq('category_id', categoryId)
                .single();

              if (existingSubcategory) {
                subcategoryId = existingSubcategory.id;
              } else {
                // Create new subcategory
                const { data: newSubcategory, error: subcategoryError } = await supabaseClient
                  .from('product_subcategories')
                  .insert({
                    name: update.subcategory,
                    category_id: categoryId
                  })
                  .select('id')
                  .single();

                if (!subcategoryError) {
                  subcategoryId = newSubcategory.id;
                  result.subcategoryCreated = true;
                }
              }
            }
          }

          const productData = {
            name: update.name,
            description: update.description || null,
            unit_price: update.unitPrice,
            unit_type: update.unitType,
            category: categoryId,
            subcategory: subcategoryId,
            color_hex: '#3B82F6',
            photo_url: update.photoUrl || null,
            is_active: update.isActive,
            show_pricing_before_submit: true,
            display_order: update.displayOrder || 0,
            contractor_id: contractor.id,
            updated_at: new Date().toISOString()
          };

          if (update.isNew || !update.productId) {
            // Create new product
            const { data: newProduct, error: insertError } = await supabaseClient
              .from('products')
              .insert(productData)
              .select('id')
              .single();

            if (insertError) {
              result.error = insertError.message;
            } else {
              result.success = true;
              result.productId = newProduct.id;
              successCount++;

              // Add to pricing history for new products
              historyEntries.push({
                product_id: newProduct.id,
                contractor_id: contractor.id,
                old_price: 0,
                new_price: update.unitPrice,
                change_type: 'bulk_create',
                batch_id: batchId,
                changed_by: userData.user.id,
                change_reason: 'Bulk product creation'
              });
            }
          } else {
            // Update existing product
            const { error: updateError } = await supabaseClient
              .from('products')
              .update(productData)
              .eq('id', update.productId)
              .eq('contractor_id', contractor.id);

            if (updateError) {
              result.error = updateError.message;
            } else {
              result.success = true;
              successCount++;

              // Add to pricing history if price changed
              if (update.oldPrice && update.oldPrice !== update.unitPrice) {
                historyEntries.push({
                  product_id: update.productId,
                  contractor_id: contractor.id,
                  old_price: update.oldPrice,
                  new_price: update.unitPrice,
                  change_type: 'bulk_update',
                  batch_id: batchId,
                  changed_by: userData.user.id,
                  change_reason: 'Bulk product update'
                });
              }
            }
          }
        }

        results.push(result);
      } catch (error: any) {
        results.push({ success: false, error: error.message });
      }
    }

    // Insert pricing history entries in batch
    if (historyEntries.length > 0) {
      const { error: historyError } = await supabaseClient
        .from('pricing_history')
        .insert(historyEntries);

      if (historyError) {
        console.error('Error inserting pricing history:', historyError.message);
      }
    }

    console.log(`Successfully processed ${successCount} out of ${updates.length} updates`);

    return new Response(JSON.stringify({
      results,
      successCount,
      totalCount: updates.length,
      batchId
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error) {
    console.error('Error in apply-bulk-products function:', error);
    return new Response(JSON.stringify({ error: error instanceof Error ? error.message : 'Unknown error' }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});