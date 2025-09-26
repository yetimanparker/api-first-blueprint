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

    const { batchId } = await req.json();

    if (!batchId) {
      throw new Error('Batch ID is required');
    }

    console.log(`Undoing batch ${batchId} for contractor: ${contractor.id}`);

    // Get all pricing history entries for this batch
    const { data: historyEntries, error: historyError } = await supabaseClient
      .from('pricing_history')
      .select('product_id, old_price, new_price, change_type')
      .eq('batch_id', batchId)
      .eq('contractor_id', contractor.id);

    if (historyError) {
      throw new Error(`Error fetching pricing history: ${historyError.message}`);
    }

    if (!historyEntries || historyEntries.length === 0) {
      throw new Error('No changes found for this batch ID');
    }

    console.log(`Found ${historyEntries.length} changes to undo`);

    let undoCount = 0;
    const errors = [];

    for (const entry of historyEntries) {
      try {
        if (entry.change_type === 'bulk_create') {
          // Delete products that were created in this batch
          const { error: deleteError } = await supabaseClient
            .from('products')
            .delete()
            .eq('id', entry.product_id)
            .eq('contractor_id', contractor.id);

          if (deleteError) {
            errors.push(`Failed to delete product ${entry.product_id}: ${deleteError.message}`);
          } else {
            undoCount++;
          }
        } else {
          // Revert price changes
          const { error: updateError } = await supabaseClient
            .from('products')
            .update({
              unit_price: entry.old_price,
              updated_at: new Date().toISOString()
            })
            .eq('id', entry.product_id)
            .eq('contractor_id', contractor.id);

          if (updateError) {
            errors.push(`Failed to revert product ${entry.product_id}: ${updateError.message}`);
          } else {
            undoCount++;
          }
        }
      } catch (error: any) {
        errors.push(`Error processing product ${entry.product_id}: ${error.message}`);
      }
    }

    // Mark the batch as undone by creating reverse entries
    const reverseEntries = historyEntries.map(entry => ({
      product_id: entry.product_id,
      contractor_id: contractor.id,
      old_price: entry.new_price,
      new_price: entry.old_price,
      change_type: 'undo_batch',
      batch_id: `undo-${batchId}`,
      changed_by: userData.user.id,
      change_reason: `Undo batch ${batchId}`
    }));

    const { error: reverseHistoryError } = await supabaseClient
      .from('pricing_history')
      .insert(reverseEntries);

    if (reverseHistoryError) {
      console.error('Error creating reverse history entries:', reverseHistoryError.message);
    }

    console.log(`Successfully undid ${undoCount} changes`);

    return new Response(JSON.stringify({
      undoCount,
      totalEntries: historyEntries.length,
      errors: errors.length > 0 ? errors : undefined,
      batchId
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error) {
    console.error('Error in undo-product-batch function:', error);
    return new Response(JSON.stringify({ error: error instanceof Error ? error.message : 'Unknown error' }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});