import { Loader } from '@googlemaps/js-api-loader';
import { supabase } from '@/integrations/supabase/client';

let loaderInstance: Loader | null = null;
let loadPromise: Promise<typeof google> | null = null;
let apiKey: string | null = null;

/**
 * Get or create a shared Google Maps Loader instance
 * This ensures the loader is only initialized once with consistent options
 */
export const getGoogleMapsLoader = async (): Promise<Loader> => {
  if (loaderInstance) {
    return loaderInstance;
  }

  // Fetch API key if not already fetched
  if (!apiKey) {
    const { data, error } = await supabase.functions.invoke('get-google-maps-key');
    
    if (error || !data?.apiKey) {
      throw new Error('Failed to fetch Google Maps API key');
    }
    
    apiKey = data.apiKey;
  }

  // Create loader with all required libraries
  loaderInstance = new Loader({
    apiKey,
    version: 'weekly',
    libraries: ['places', 'drawing', 'geometry', 'marker'], // All libraries needed across the app
  });

  return loaderInstance;
};

/**
 * Load Google Maps API (only loads once, subsequent calls return the same promise)
 */
export const loadGoogleMapsAPI = async (): Promise<typeof google> => {
  if (loadPromise) {
    return loadPromise;
  }

  const loader = await getGoogleMapsLoader();
  loadPromise = loader.load();
  
  return loadPromise;
};

/**
 * Reset the loader (useful for testing or if you need to reinitialize)
 */
export const resetGoogleMapsLoader = () => {
  loaderInstance = null;
  loadPromise = null;
  apiKey = null;
};
