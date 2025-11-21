import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.38.4";
import { z } from "https://deno.land/x/zod@v3.22.4/mod.ts";
import { corsHeaders } from "../_shared/cors.ts";

// Input validation schemas
const customerInfoSchema = z.object({
  firstName: z.string().trim().min(1, "First name is required").max(100, "First name too long"),
  lastName: z.string().trim().min(1, "Last name is required").max(100, "Last name too long"),
  email: z.string().trim().email("Invalid email format").max(255, "Email too long"),
  phone: z.string().trim().max(20, "Phone number too long").optional(),
  address: z.string().trim().max(500, "Address too long").optional(),
  city: z.string().trim().max(100, "City name too long").optional(),
  state: z.string().trim().max(50, "State name too long").optional(),
  zipCode: z.string().trim().max(20, "ZIP code too long").optional(),
});

const quoteItemSchema = z.object({
  productId: z.string().uuid("Invalid product ID"),
  quantity: z.number().positive("Quantity must be positive"),
  unitPrice: z.number().nonnegative("Unit price must be non-negative"),
  lineTotal: z.number().nonnegative("Line total must be non-negative"),
  measurementData: z.any().optional(),
  notes: z.string().max(1000, "Notes too long").optional(),
  parentQuoteItemId: z.string().optional(),
  addonId: z.string().optional(),
  isAddonItem: z.boolean().optional(),
});

const clarifyingAnswerSchema = z.object({
  question: z.string().max(500, "Question too long"),
  answer: z.string().max(2000, "Answer too long"),
});

const submitQuoteSchema = z.object({
  customerInfo: customerInfoSchema,
  quoteItems: z.array(quoteItemSchema).min(1, "At least one quote item required"),
  contractorId: z.string().uuid("Invalid contractor ID"),
  projectComments: z.string().max(2000, "Project comments too long").optional(),
  clarifyingAnswers: z.array(clarifyingAnswerSchema).optional(),
});

// Simple in-memory rate limiting
const requestCounts = new Map<string, { count: number; resetTime: number }>();
const RATE_LIMIT = 50; // submissions per hour per contractor
const RATE_WINDOW = 60 * 60 * 1000; // 1 hour

function checkRateLimit(contractorId: string): boolean {
  const now = Date.now();
  const record = requestCounts.get(contractorId);

  if (!record || now > record.resetTime) {
    requestCounts.set(contractorId, { count: 1, resetTime: now + RATE_WINDOW });
    return true;
  }

  if (record.count >= RATE_LIMIT) {
    return false;
  }

  record.count++;
  return true;
}

// Sanitize text input by removing potential HTML/script tags
function sanitizeText(text: string): string {
  return text.replace(/<[^>]*>/g, '').trim();
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    // Parse and validate input
    const body = await req.json();
    
    console.log('Received clarifyingAnswers:', JSON.stringify(body.clarifyingAnswers));
    
    // Validate with zod schema
    const validationResult = submitQuoteSchema.safeParse(body);
    
    if (!validationResult.success) {
      console.error('Validation error:', validationResult.error.errors);
      return new Response(
        JSON.stringify({ 
          error: 'Invalid input data',
          details: validationResult.error.errors.map(e => `${e.path.join('.')}: ${e.message}`)
        }),
        { 
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      );
    }

    const { customerInfo, quoteItems, contractorId, projectComments, clarifyingAnswers } = validationResult.data;

    // Check rate limit
    if (!checkRateLimit(contractorId)) {
      console.warn(`Rate limit exceeded for contractor: ${contractorId}`);
      return new Response(
        JSON.stringify({ error: 'Too many quote submissions. Please try again later.' }),
        { 
          status: 429,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      );
    }

    // Verify contractor exists
    const { data: contractor, error: contractorError } = await supabaseClient
      .from('contractors')
      .select('id')
      .eq('id', contractorId)
      .single();

    if (contractorError || !contractor) {
      console.error('Contractor not found:', contractorId);
      return new Response(
        JSON.stringify({ error: 'Invalid contractor ID' }),
        { 
          status: 404,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      );
    }

    // Sanitize text inputs
    const sanitizedCustomerInfo = {
      firstName: sanitizeText(customerInfo.firstName),
      lastName: sanitizeText(customerInfo.lastName),
      email: customerInfo.email.toLowerCase(), // Normalize email
      phone: customerInfo.phone,
      address: customerInfo.address ? sanitizeText(customerInfo.address) : undefined,
      city: customerInfo.city ? sanitizeText(customerInfo.city) : undefined,
      state: customerInfo.state ? sanitizeText(customerInfo.state) : undefined,
      zipCode: customerInfo.zipCode,
    };

    const sanitizedProjectComments = projectComments ? sanitizeText(projectComments) : undefined;

    // Sanitize clarifying answers
    const sanitizedClarifyingAnswers = clarifyingAnswers 
      ? clarifyingAnswers.map(qa => ({
          question: sanitizeText(qa.question).slice(0, 500),
          answer: sanitizeText(qa.answer).slice(0, 2000)
        }))
      : [];

    console.log('Sanitized clarifyingAnswers:', JSON.stringify(sanitizedClarifyingAnswers));

    // Log submission for security monitoring
    console.log(`Quote submitted for contractor: ${contractorId}, customer: ${sanitizedCustomerInfo.email}`);

    // Check if customer exists by email
    const { data: existingCustomers, error: customerLookupError } = await supabaseClient
      .from('customers')
      .select('id')
      .eq('contractor_id', contractorId)
      .eq('email', sanitizedCustomerInfo.email);

    if (customerLookupError) throw customerLookupError;

    let customerId: string;

    if (existingCustomers && existingCustomers.length > 0) {
      // Update existing customer
      customerId = existingCustomers[0].id;
      const { error: updateError } = await supabaseClient
        .from('customers')
        .update({
          first_name: sanitizedCustomerInfo.firstName,
          last_name: sanitizedCustomerInfo.lastName,
          phone: sanitizedCustomerInfo.phone,
          address: sanitizedCustomerInfo.address,
          city: sanitizedCustomerInfo.city,
          state: sanitizedCustomerInfo.state,
          zip_code: sanitizedCustomerInfo.zipCode,
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
          first_name: sanitizedCustomerInfo.firstName,
          last_name: sanitizedCustomerInfo.lastName,
          email: sanitizedCustomerInfo.email,
          phone: sanitizedCustomerInfo.phone,
          address: sanitizedCustomerInfo.address,
          city: sanitizedCustomerInfo.city,
          state: sanitizedCustomerInfo.state,
          zip_code: sanitizedCustomerInfo.zipCode,
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
        project_address: sanitizedCustomerInfo.address,
        project_city: sanitizedCustomerInfo.city,
        project_state: sanitizedCustomerInfo.state,
        project_zip_code: sanitizedCustomerInfo.zipCode,
        notes: sanitizedProjectComments,
        clarifying_answers: sanitizedClarifyingAnswers,
      })
      .select()
      .single();

    if (quoteError) throw quoteError;

    // Insert quote items with parent-child relationship handling
    // First, insert main items (no parent) and track their IDs
    const mainItems = quoteItems.filter((item: any) => !item.parentQuoteItemId);
    const addonItems = quoteItems.filter((item: any) => item.parentQuoteItemId);

    console.log('Processing quote items:', {
      totalItems: quoteItems.length,
      mainItemsCount: mainItems.length,
      addonItemsCount: addonItems.length,
      mainItemsSample: mainItems.slice(0, 2),
      addonItemsSample: addonItems.slice(0, 2)
    });

    // Map to track temporary IDs to real database IDs
    const idMapping = new Map<string, string>();

    // Insert main items first
    if (mainItems.length > 0) {
      const mainItemsToInsert = mainItems.map((item: any) => ({
        quote_id: quote.id,
        product_id: item.productId,
        quantity: item.quantity,
        unit_price: item.unitPrice,
        line_total: item.lineTotal,
        measurement_data: item.measurementData,
        notes: item.notes,
      }));

      const { data: insertedMainItems, error: mainItemsError } = await supabaseClient
        .from('quote_items')
        .insert(mainItemsToInsert)
        .select('id');

      if (mainItemsError) {
        console.error('Error inserting main quote items:', mainItemsError);
        throw mainItemsError;
      }

      // Build ID mapping (assumes items maintain order)
      mainItems.forEach((item: any, index: number) => {
        if (insertedMainItems && insertedMainItems[index]) {
          idMapping.set(item.id, insertedMainItems[index].id);
          console.log(`Mapped temp ID ${item.id} to DB ID ${insertedMainItems[index].id}`);
        }
      });
    }

    // Insert addon items with resolved parent IDs
    if (addonItems.length > 0) {
      const addonItemsToInsert = addonItems.map((item: any) => {
        const resolvedParentId = idMapping.get(item.parentQuoteItemId) || null;
        console.log(`Resolving parent for addon item ${item.id}: ${item.parentQuoteItemId} -> ${resolvedParentId}`);
        return {
          quote_id: quote.id,
          product_id: item.productId,
          quantity: item.quantity,
          unit_price: item.unitPrice,
          line_total: item.lineTotal,
          measurement_data: item.measurementData,
          notes: item.notes,
          parent_quote_item_id: resolvedParentId,
        };
      });

      console.log('Inserting addon items:', addonItemsToInsert.slice(0, 2));

      const { error: addonItemsError } = await supabaseClient
        .from('quote_items')
        .insert(addonItemsToInsert);

      if (addonItemsError) {
        console.error('Error inserting addon quote items:', addonItemsError);
        throw addonItemsError;
      }
    }

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
