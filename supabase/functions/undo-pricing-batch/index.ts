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

    const { batchId } = await req.json();

    if (!batchId) {
      return new Response(
        JSON.stringify({ error: 'Batch ID is required' }),
        { 
          status: 400, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      );
    }

    console.log(`Undoing pricing batch: ${batchId}`);

    // Get all pricing history entries for this batch
    const { data: historyEntries, error: historyError } = await supabaseClient
      .from('pricing_history')
      .select('product_id, old_price, new_price')
      .eq('batch_id', batchId)
      .eq('contractor_id', contractor.id);

    if (historyError) {
      console.error('Failed to fetch pricing history:', historyError);
      return new Response(
        JSON.stringify({ error: 'Failed to fetch pricing history' }),
        { 
          status: 500, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      );
    }

    if (!historyEntries || historyEntries.length === 0) {
      return new Response(
        JSON.stringify({ error: 'No pricing changes found for this batch' }),
        { 
          status: 404, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      );
    }

    console.log(`Found ${historyEntries.length} pricing changes to revert`);

    const results = [];
    const undoHistoryEntries = [];

    // Revert each product price
    for (const entry of historyEntries) {
      try {
        // Revert product price to old price
        const { data: product, error: updateError } = await supabaseClient
          .from('products')
          .update({ 
            unit_price: entry.old_price, 
            updated_at: new Date().toISOString() 
          })
          .eq('id', entry.product_id)
          .eq('contractor_id', contractor.id)
          .select('id, name')
          .single();

        if (updateError) {
          console.error(`Failed to revert product ${entry.product_id}:`, updateError);
          results.push({
            productId: entry.product_id,
            success: false,
            error: updateError.message
          });
          continue;
        }

        // Create undo history entry
        undoHistoryEntries.push({
          contractor_id: contractor.id,
          product_id: entry.product_id,
          old_price: entry.new_price, // Current price becomes old price
          new_price: entry.old_price, // Revert to original price
          change_type: 'bulk_undo',
          changed_by: user.id,
          batch_id: null, // Don't group undo operations
          change_reason: `Undo bulk update batch ${batchId}`
        });

        results.push({
          productId: entry.product_id,
          productName: product?.name,
          success: true,
          revertedFrom: entry.new_price,
          revertedTo: entry.old_price
        });

        console.log(`Reverted product ${entry.product_id}: ${entry.new_price} -> ${entry.old_price}`);
      } catch (error: any) {
        console.error(`Error reverting product ${entry.product_id}:`, error);
        results.push({
          productId: entry.product_id,
          success: false,
          error: error.message
        });
      }
    }

    // Insert undo history entries
    if (undoHistoryEntries.length > 0) {
      const { error: historyError } = await supabaseClient
        .from('pricing_history')
        .insert(undoHistoryEntries);

      if (historyError) {
        console.error('Failed to create undo history:', historyError);
        // Don't fail the entire operation for history errors
      } else {
        console.log(`Created ${undoHistoryEntries.length} undo history entries`);
      }
    }

    const successCount = results.filter(r => r.success).length;
    const failureCount = results.filter(r => !r.success).length;

    console.log(`Undo batch ${batchId} completed: ${successCount} reverted, ${failureCount} failures`);

    return new Response(
      JSON.stringify({ 
        batchId,
        results,
        summary: {
          totalReverts: historyEntries.length,
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
    console.error('Error in undo-pricing-batch function:', error);
    return new Response(
      JSON.stringify({ error: error.message }),
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  }
});