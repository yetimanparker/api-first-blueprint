import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.57.4'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

interface ServiceAreaValidationRequest {
  contractor_id: string
  customer_address?: string
  customer_lat?: number
  customer_lng?: number
  customer_zip?: string
}

interface ServiceAreaValidationResponse {
  valid: boolean
  distance?: number
  zip_code?: string
  message: string
  method: 'radius' | 'zipcodes'
}

// Calculate distance between two points using Haversine formula
function calculateDistance(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const R = 3959 // Earth's radius in miles
  const dLat = (lat2 - lat1) * Math.PI / 180
  const dLng = (lng2 - lng1) * Math.PI / 180
  const a = 
    Math.sin(dLat/2) * Math.sin(dLat/2) +
    Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * 
    Math.sin(dLng/2) * Math.sin(dLng/2)
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a))
  return R * c
}

// Geocode address using Google Places API
async function geocodeAddress(address: string): Promise<{lat: number, lng: number} | null> {
  const apiKey = Deno.env.get('GOOGLE_PLACES_API_KEY')
  if (!apiKey) {
    console.error('Google Places API key not found')
    return null
  }

  try {
    const url = `https://maps.googleapis.com/maps/api/geocode/json?address=${encodeURIComponent(address)}&key=${apiKey}`
    const response = await fetch(url)
    const data = await response.json()

    if (data.status === 'OK' && data.results.length > 0) {
      const location = data.results[0].geometry.location
      return { lat: location.lat, lng: location.lng }
    }
  } catch (error) {
    console.error('Geocoding error:', error)
  }

  return null
}

Deno.serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders })
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    const supabase = createClient(supabaseUrl, supabaseKey)

    const body: ServiceAreaValidationRequest = await req.json()
    const { contractor_id, customer_address, customer_lat, customer_lng, customer_zip } = body

    console.log('Validating service area for contractor:', contractor_id)

    // Get contractor settings
    const { data: settings, error: settingsError } = await supabase
      .from('contractor_settings')
      .select('*')
      .eq('contractor_id', contractor_id)
      .maybeSingle()

    if (settingsError) {
      console.error('Error fetching contractor settings:', settingsError)
      return new Response(
        JSON.stringify({
          valid: false,
          message: 'Error fetching service area settings',
          method: 'radius'
        } as ServiceAreaValidationResponse),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 500 }
      )
    }

    // If settings don't exist or service area is disabled, always allow
    if (!settings || !settings.service_area_enabled) {
      return new Response(
        JSON.stringify({
          valid: true,
          message: 'Service area restrictions are not enabled',
          method: settings?.service_area_method || 'radius'
        } as ServiceAreaValidationResponse),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    let customerLat = customer_lat
    let customerLng = customer_lng

    // If coordinates not provided but address is, geocode it
    if (!customerLat || !customerLng) {
      if (customer_address) {
        const coords = await geocodeAddress(customer_address)
        if (coords) {
          customerLat = coords.lat
          customerLng = coords.lng
        }
      }
    }

    if (settings.service_area_method === 'radius') {
      // Radius-based validation
      if (!settings.service_area_center_lat || !settings.service_area_center_lng) {
        return new Response(
          JSON.stringify({
            valid: false,
            message: 'Service area center coordinates not configured',
            method: 'radius'
          } as ServiceAreaValidationResponse),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        )
      }

      if (!customerLat || !customerLng) {
        return new Response(
          JSON.stringify({
            valid: false,
            message: 'Unable to determine customer location',
            method: 'radius'
          } as ServiceAreaValidationResponse),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        )
      }

      const distance = calculateDistance(
        settings.service_area_center_lat,
        settings.service_area_center_lng,
        customerLat,
        customerLng
      )

      const withinRange = distance <= settings.service_area_radius_miles

      return new Response(
        JSON.stringify({
          valid: withinRange,
          distance: Math.round(distance * 10) / 10,
          message: withinRange 
            ? `✓ Within service area (${Math.round(distance * 10) / 10} miles)`
            : `⚠️ Outside service area (${Math.round(distance * 10) / 10} miles from service center)`,
          method: 'radius'
        } as ServiceAreaValidationResponse),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )

    } else if (settings.service_area_method === 'zipcodes') {
      // ZIP code-based validation
      if (!settings.service_area_zip_codes || settings.service_area_zip_codes.length === 0) {
        return new Response(
          JSON.stringify({
            valid: false,
            message: 'No ZIP codes configured for service area',
            method: 'zipcodes'
          } as ServiceAreaValidationResponse),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        )
      }

      if (!customer_zip) {
        return new Response(
          JSON.stringify({
            valid: false,
            message: 'ZIP code required for service area validation',
            method: 'zipcodes'
          } as ServiceAreaValidationResponse),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        )
      }

      const zipValid = settings.service_area_zip_codes.includes(customer_zip)

      return new Response(
        JSON.stringify({
          valid: zipValid,
          zip_code: customer_zip,
          message: zipValid 
            ? `✓ We service ZIP code ${customer_zip}`
            : `⚠️ We don't currently service ZIP code ${customer_zip}`,
          method: 'zipcodes'
        } as ServiceAreaValidationResponse),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    return new Response(
      JSON.stringify({
        valid: false,
        message: 'Invalid service area method configured',
        method: settings.service_area_method
      } as ServiceAreaValidationResponse),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )

  } catch (error) {
    console.error('Service area validation error:', error)
    return new Response(
      JSON.stringify({
        valid: false,
        message: 'Error validating service area',
        method: 'radius'
      } as ServiceAreaValidationResponse),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 500 }
    )
  }
})