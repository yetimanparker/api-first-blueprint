import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface AutocompleteRequest {
  input: string;
  sessionToken?: string;
  types?: string[];
  componentRestrictions?: {
    country?: string[];
  };
}

interface PlaceDetailsRequest {
  placeId: string;
  sessionToken?: string;
}

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const googleApiKey = Deno.env.get('GOOGLE_PLACES_API_KEY');
    
    if (!googleApiKey) {
      console.error('Google Places API key not found');
      return new Response(
        JSON.stringify({ error: 'Google Places API key not configured' }),
        { 
          status: 500, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      );
    }

    const url = new URL(req.url);
    const endpoint = url.pathname.split('/').pop();
    
    if (endpoint === 'autocomplete') {
      return handleAutocomplete(req, googleApiKey);
    } else if (endpoint === 'details') {
      return handlePlaceDetails(req, googleApiKey);
    } else {
      return new Response(
        JSON.stringify({ error: 'Invalid endpoint. Use /autocomplete or /details' }),
        { 
          status: 400, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      );
    }
  } catch (error) {
    console.error('Error in google-places-autocomplete function:', error);
    return new Response(
      JSON.stringify({ error: 'Internal server error' }),
      { 
        status: 500, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    );
  }
});

async function handleAutocomplete(req: Request, apiKey: string) {
  const { input, sessionToken, types, componentRestrictions }: AutocompleteRequest = await req.json();
  
  if (!input || input.trim().length < 2) {
    return new Response(
      JSON.stringify({ predictions: [] }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }

  console.log('Autocomplete request for:', input);

  // Build Google Places API URL
  const params = new URLSearchParams({
    input: input.trim(),
    key: apiKey,
    types: types?.join('|') || 'address',
  });

  if (sessionToken) {
    params.append('sessiontoken', sessionToken);
  }

  if (componentRestrictions?.country) {
    params.append('components', `country:${componentRestrictions.country.join('|')}`);
  }

  try {
    const response = await fetch(
      `https://maps.googleapis.com/maps/api/place/autocomplete/json?${params}`,
      {
        method: 'GET',
        headers: {
          'Accept': 'application/json',
        },
      }
    );

    const data = await response.json();
    
    if (data.error_message) {
      console.error('Google Places API error:', data.error_message);
      return new Response(
        JSON.stringify({ error: data.error_message }),
        { 
          status: 400, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      );
    }

    console.log('Autocomplete successful, returning', data.predictions?.length || 0, 'predictions');

    return new Response(
      JSON.stringify({
        predictions: data.predictions || [],
        status: data.status
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error('Network error calling Google Places API:', error);
    return new Response(
      JSON.stringify({ error: 'Failed to fetch autocomplete suggestions' }),
      { 
        status: 500, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    );
  }
}

async function handlePlaceDetails(req: Request, apiKey: string) {
  const { placeId, sessionToken }: PlaceDetailsRequest = await req.json();
  
  if (!placeId) {
    return new Response(
      JSON.stringify({ error: 'Place ID is required' }),
      { 
        status: 400, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    );
  }

  console.log('Place details request for:', placeId);

  // Build Google Places API URL
  const params = new URLSearchParams({
    place_id: placeId,
    key: apiKey,
    fields: 'address_components,formatted_address,geometry',
  });

  if (sessionToken) {
    params.append('sessiontoken', sessionToken);
  }

  try {
    const response = await fetch(
      `https://maps.googleapis.com/maps/api/place/details/json?${params}`,
      {
        method: 'GET',
        headers: {
          'Accept': 'application/json',
        },
      }
    );

    const data = await response.json();
    
    if (data.error_message) {
      console.error('Google Places API error:', data.error_message);
      return new Response(
        JSON.stringify({ error: data.error_message }),
        { 
          status: 400, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      );
    }

    if (!data.result) {
      return new Response(
        JSON.stringify({ error: 'Place not found' }),
        { 
          status: 404, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      );
    }

    console.log('Place details successful');

    return new Response(
      JSON.stringify({
        result: data.result,
        status: data.status
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error('Network error calling Google Places API:', error);
    return new Response(
      JSON.stringify({ error: 'Failed to fetch place details' }),
      { 
        status: 500, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    );
  }
}