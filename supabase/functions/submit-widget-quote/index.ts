import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.38.4";

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
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    const { customerInfo, quoteItems, contractorId, projectComments } = await req.json();

    // Validate required data
    if (!customerInfo || !quoteItems || !contractorId) {
      throw new Error('Missing required data');
    }

    // Validate required customer fields
    if (!customerInfo.firstName?.trim() || !customerInfo.lastName?.trim()) {
      throw new Error('Customer first name and last name are required');
    }

    if (!customerInfo.email?.trim()) {
      throw new Error('Customer email is required');
    }

    // Check if customer exists by email
    const { data: existingCustomers, error: customerLookupError } = await supabaseClient
      .from('customers')
      .select('id')
      .eq('contractor_id', contractorId)
      .eq('email', customerInfo.email);

    if (customerLookupError) throw customerLookupError;

    let customerId: string;

    if (existingCustomers && existingCustomers.length > 0) {
      // Update existing customer
      customerId = existingCustomers[0].id;
      const { error: updateError } = await supabaseClient
        .from('customers')
        .update({
          first_name: customerInfo.firstName,
          last_name: customerInfo.lastName,
          phone: customerInfo.phone,
          address: customerInfo.address,
          city: customerInfo.city,
          state: customerInfo.state,
          zip_code: customerInfo.zipCode,
          last_activity_at: new Date().toISOString(),
        })
        .eq('id', customerId);

      if (updateError) throw updateError;
    } else {
      // Create new customer
      const { data: newCustomer, error: createError } = await supabaseClient
        .from('customers')
        .insert({
          contractor_id: contractorId,
          first_name: customerInfo.firstName,
          last_name: customerInfo.lastName,
          email: customerInfo.email,
          phone: customerInfo.phone,
          address: customerInfo.address,
          city: customerInfo.city,
          state: customerInfo.state,
          zip_code: customerInfo.zipCode,
          status: 'lead',
          lead_source: 'widget'
        })
        .select()
        .single();

      if (createError) throw createError;
      customerId = newCustomer.id;
    }

    // Generate quote number
    const { data: quoteNumberData, error: quoteNumberError } = await supabaseClient
      .rpc('generate_quote_number');

    if (quoteNumberError) throw quoteNumberError;

    // Calculate total
    const total = quoteItems.reduce((sum: number, item: any) => sum + (item.lineTotal || 0), 0);

    // Create quote
    const { data: quote, error: quoteError } = await supabaseClient
      .from('quotes')
      .insert({
        contractor_id: contractorId,
        customer_id: customerId,
        total_amount: total,
        status: 'draft',
        quote_number: quoteNumberData,
        project_address: customerInfo.address,
        project_city: customerInfo.city,
        project_state: customerInfo.state,
        project_zip_code: customerInfo.zipCode,
        notes: projectComments,
      })
      .select()
      .single();

    if (quoteError) throw quoteError;

    // Create quote items
    const itemsToInsert = quoteItems.map((item: any) => ({
      quote_id: quote.id,
      product_id: item.productId,
      quantity: item.quantity,
      unit_price: item.unitPrice,
      line_total: item.lineTotal,
      measurement_data: item.measurementData,
      notes: item.notes,
    }));

    const { error: itemsError } = await supabaseClient
      .from('quote_items')
      .insert(itemsToInsert);

    if (itemsError) throw itemsError;

    return new Response(
      JSON.stringify({ 
        success: true, 
        quoteId: quote.id,
        quoteNumber: quoteNumberData 
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Error submitting quote:', error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { 
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    );
  }
});
