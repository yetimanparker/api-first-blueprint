import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.4";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface PricingUpdate {
  productId: string;
  oldPrice: number;
  newPrice: number;
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

    const { updates, batchId } = await req.json();

    if (!updates || !Array.isArray(updates) || updates.length === 0) {
      return new Response(
        JSON.stringify({ error: 'No updates provided' }),
        { 
          status: 400, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      );
    }

    console.log(`Applying ${updates.length} pricing updates for batch ${batchId}`);

    const results = [];
    const historyEntries = [];

    for (const update of updates as PricingUpdate[]) {
      try {
        // Verify product ownership and update price
        const { data: product, error: updateError } = await supabaseClient
          .from('products')
          .update({ unit_price: update.newPrice, updated_at: new Date().toISOString() })
          .eq('id', update.productId)
          .eq('contractor_id', contractor.id)
          .select('id, name')
          .single();

        if (updateError) {
          console.error(`Failed to update product ${update.productId}:`, updateError);
          results.push({
            productId: update.productId,
            success: false,
            error: updateError.message
          });
          continue;
        }

        // Create pricing history entry
        historyEntries.push({
          contractor_id: contractor.id,
          product_id: update.productId,
          old_price: update.oldPrice,
          new_price: update.newPrice,
          change_type: 'bulk_update',
          changed_by: user.id,
          batch_id: batchId,
          change_reason: 'Bulk pricing upload'
        });

        results.push({
          productId: update.productId,
          productName: product?.name,
          success: true
        });

        console.log(`Updated product ${update.productId}: ${update.oldPrice} -> ${update.newPrice}`);
      } catch (error: any) {
        console.error(`Error updating product ${update.productId}:`, error);
        results.push({
          productId: update.productId,
          success: false,
          error: error.message
        });
      }
    }

    // Insert pricing history entries in batch
    if (historyEntries.length > 0) {
      const { error: historyError } = await supabaseClient
        .from('pricing_history')
        .insert(historyEntries);

      if (historyError) {
        console.error('Failed to create pricing history:', historyError);
        // Don't fail the entire operation for history errors
      } else {
        console.log(`Created ${historyEntries.length} pricing history entries`);
      }
    }

    const successCount = results.filter(r => r.success).length;
    const failureCount = results.filter(r => !r.success).length;

    console.log(`Batch ${batchId} completed: ${successCount} success, ${failureCount} failures`);

    return new Response(
      JSON.stringify({ 
        batchId,
        results,
        summary: {
          totalUpdates: updates.length,
          successCount,
          failureCount
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
    console.error('Error in apply-bulk-pricing function:', error);
    return new Response(
      JSON.stringify({ error: error.message }),
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  }
});