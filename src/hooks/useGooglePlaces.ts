import { useState, useCallback, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';

export interface PlacePrediction {
  place_id: string;
  description: string;
  structured_formatting: {
    main_text: string;
    secondary_text: string;
  };
  types: string[];
}

export interface AddressComponents {
  streetNumber?: string;
  route?: string;
  locality?: string;
  administrativeAreaLevel1?: string;
  postalCode?: string;
  country?: string;
}

export interface ParsedAddress {
  fullAddress: string;
  streetAddress: string;
  city: string;
  state: string;
  zipCode: string;
  country: string;
}

export function useGooglePlaces() {
  const [predictions, setPredictions] = useState<PlacePrediction[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const sessionTokenRef = useRef<string | null>(null);

  // Generate a session token for billing optimization
  const generateSessionToken = useCallback(() => {
    if (!sessionTokenRef.current) {
      sessionTokenRef.current = Math.random().toString(36).substring(2, 15) + 
                               Math.random().toString(36).substring(2, 15);
    }
    return sessionTokenRef.current;
  }, []);

  // Clear session token after place selection
  const clearSessionToken = useCallback(() => {
    sessionTokenRef.current = null;
  }, []);

  // Get autocomplete predictions
  const getAutocomplete = useCallback(async (input: string, options?: {
    types?: string[];
    componentRestrictions?: { country?: string[] };
  }) => {
    if (!input || input.trim().length < 2) {
      setPredictions([]);
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const { data, error: supabaseError } = await supabase.functions.invoke(
        'google-places-autocomplete/autocomplete',
        {
          body: {
            input: input.trim(),
            sessionToken: generateSessionToken(),
            types: options?.types || ['address'],
            componentRestrictions: options?.componentRestrictions,
          },
        }
      );

      if (supabaseError) {
        throw new Error(supabaseError.message);
      }

      if (data?.error) {
        throw new Error(data.error);
      }

      setPredictions(data?.predictions || []);
    } catch (err) {
      console.error('Autocomplete error:', err);
      setError(err instanceof Error ? err.message : 'Failed to get autocomplete suggestions');
      setPredictions([]);
    } finally {
      setLoading(false);
    }
  }, [generateSessionToken]);

  // Get place details and parse address components
  const getPlaceDetails = useCallback(async (placeId: string): Promise<ParsedAddress | null> => {
    setLoading(true);
    setError(null);

    try {
      const { data, error: supabaseError } = await supabase.functions.invoke(
        'google-places-autocomplete/details',
        {
          body: {
            placeId,
            sessionToken: sessionTokenRef.current,
          },
        }
      );

      if (supabaseError) {
        throw new Error(supabaseError.message);
      }

      if (data?.error) {
        throw new Error(data.error);
      }

      const result = data?.result;
      if (!result) {
        throw new Error('No place details found');
      }

      // Parse address components
      const components = parseAddressComponents(result.address_components || []);
      
      const parsedAddress: ParsedAddress = {
        fullAddress: result.formatted_address || '',
        streetAddress: [components.streetNumber, components.route].filter(Boolean).join(' '),
        city: components.locality || '',
        state: components.administrativeAreaLevel1 || '',
        zipCode: components.postalCode || '',
        country: components.country || '',
      };

      // Clear session token after successful request
      clearSessionToken();

      return parsedAddress;
    } catch (err) {
      console.error('Place details error:', err);
      setError(err instanceof Error ? err.message : 'Failed to get place details');
      return null;
    } finally {
      setLoading(false);
    }
  }, [clearSessionToken]);

  return {
    predictions,
    loading,
    error,
    getAutocomplete,
    getPlaceDetails,
    clearPredictions: () => setPredictions([]),
    clearError: () => setError(null),
  };
}

// State name to code mapping for consistent form field population
const stateNameToCode: Record<string, string> = {
  'Alabama': 'AL', 'Alaska': 'AK', 'Arizona': 'AZ', 'Arkansas': 'AR', 'California': 'CA',
  'Colorado': 'CO', 'Connecticut': 'CT', 'Delaware': 'DE', 'Florida': 'FL', 'Georgia': 'GA',
  'Hawaii': 'HI', 'Idaho': 'ID', 'Illinois': 'IL', 'Indiana': 'IN', 'Iowa': 'IA',
  'Kansas': 'KS', 'Kentucky': 'KY', 'Louisiana': 'LA', 'Maine': 'ME', 'Maryland': 'MD',
  'Massachusetts': 'MA', 'Michigan': 'MI', 'Minnesota': 'MN', 'Mississippi': 'MS', 'Missouri': 'MO',
  'Montana': 'MT', 'Nebraska': 'NE', 'Nevada': 'NV', 'New Hampshire': 'NH', 'New Jersey': 'NJ',
  'New Mexico': 'NM', 'New York': 'NY', 'North Carolina': 'NC', 'North Dakota': 'ND', 'Ohio': 'OH',
  'Oklahoma': 'OK', 'Oregon': 'OR', 'Pennsylvania': 'PA', 'Rhode Island': 'RI', 'South Carolina': 'SC',
  'South Dakota': 'SD', 'Tennessee': 'TN', 'Texas': 'TX', 'Utah': 'UT', 'Vermont': 'VT',
  'Virginia': 'VA', 'Washington': 'WA', 'West Virginia': 'WV', 'Wisconsin': 'WI', 'Wyoming': 'WY'
};

// Helper function to parse Google Places API address components
function parseAddressComponents(components: any[]): AddressComponents {
  const parsed: AddressComponents = {};

  components.forEach((component) => {
    const types = component.types;
    const longName = component.long_name;
    const shortName = component.short_name;

    if (types.includes('street_number')) {
      parsed.streetNumber = longName;
    } else if (types.includes('route')) {
      parsed.route = longName;
    } else if (types.includes('locality')) {
      parsed.locality = longName;
    } else if (types.includes('administrative_area_level_1')) {
      // Try to get 2-letter state code, fallback to mapping from full name
      parsed.administrativeAreaLevel1 = shortName.length === 2 
        ? shortName 
        : stateNameToCode[longName] || shortName;
    } else if (types.includes('postal_code')) {
      parsed.postalCode = longName;
    } else if (types.includes('country')) {
      parsed.country = longName;
    }
  });

  return parsed;
}