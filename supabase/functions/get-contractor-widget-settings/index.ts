import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.58.0';
import { corsHeaders } from '../_shared/cors.ts';

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const { contractor_id } = await req.json();

    if (!contractor_id) {
      return new Response(
        JSON.stringify({ error: 'contractor_id is required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Fetch contractor settings with ONLY safe fields for widget
    const { data: settings, error } = await supabase
      .from('contractor_settings')
      .select(`
        require_email,
        require_phone,
        require_address,
        contact_capture_timing,
        pricing_visibility,
        widget_theme_color,
        service_area_enabled,
        decimal_precision,
        currency_symbol
      `)
      .eq('contractor_id', contractor_id)
      .maybeSingle();

    if (error && error.code !== 'PGRST116') {
      throw error;
    }

    // Return safe defaults if no settings found
    const safeSettings = settings || {
      require_email: true,
      require_phone: true,
      require_address: true,
      contact_capture_timing: 'before_quote',
      pricing_visibility: 'before_submit',
      widget_theme_color: '#3B82F6',
      service_area_enabled: false,
      decimal_precision: 2,
      currency_symbol: '$',
    };

    return new Response(
      JSON.stringify(safeSettings),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error('Error fetching widget settings:', error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
