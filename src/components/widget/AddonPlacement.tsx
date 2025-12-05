import { useState, useEffect, useRef } from 'react';
import { Button } from '@/components/ui/button';
import { MapPin, Trash2, Check } from 'lucide-react';
import { loadGoogleMapsAPI } from '@/lib/googleMapsLoader';
import { toast } from 'sonner';
import { getDistinctAddonColor } from '@/lib/colorUtils';
import { getZoomBasedMarkerScale } from '@/lib/mapLabelUtils';

interface AddonPlacementProps {
  addonName: string;
  linkedProductId?: string;
  mainProductMeasurement: {
    type: 'area' | 'linear' | 'point';
    coordinates?: number[][];
    segments?: number[][][]; // Array of coordinate arrays for multiple independent segments
    pointLocations?: Array<{ lat: number; lng: number }>;
    centerPoint?: { lat: number; lng: number };
    mapColor?: string;
  };
  customerAddress?: string;
  existingAddonLocations?: Array<{ lat: number; lng: number; color: string }>;
  onComplete: (locations: Array<{ lat: number; lng: number }>, productColor: string) => void;
  onCancel: () => void;
}

export function AddonPlacement({
  addonName,
  linkedProductId,
  mainProductMeasurement,
  customerAddress,
  existingAddonLocations,
  onComplete,
  onCancel,
}: AddonPlacementProps) {
  const [map, setMap] = useState<google.maps.Map | null>(null);
  const [addonProductColor, setAddonProductColor] = useState<string | null>(null);
  const [mainProductShape, setMainProductShape] = useState<google.maps.Polygon | google.maps.Polyline | null>(null);
  const [placedMarkers, setPlacedMarkers] = useState<google.maps.Marker[]>([]);
  const [placedLocations, setPlacedLocations] = useState<Array<{lat: number, lng: number}>>([]);
  const [existingMarkers, setExistingMarkers] = useState<google.maps.Marker[]>([]);

  const mapRef = useRef<google.maps.Map | null>(null);
  const placedMarkersRef = useRef<google.maps.Marker[]>([]);
  const placedLocationsRef = useRef<Array<{ lat: number; lng: number }>>([]);
  const existingMarkersRef = useRef<google.maps.Marker[]>([]);
  const isInitializedRef = useRef(false);
  const [currentZoom, setCurrentZoom] = useState(20);
  const STORAGE_KEY = `map-state-${customerAddress || 'default'}`;

  useEffect(() => {
    // Guard against multiple initializations
    if (isInitializedRef.current) {
      console.log('🛑 AddonPlacement - Map already initialized, skipping');
      return;
    }
    
    console.log('🗺️ AddonPlacement - Initializing map');
    initializeMap();
    
    // Cleanup on unmount
    return () => {
      console.log('🧹 AddonPlacement - Cleaning up markers');
      // Clear placed markers
      placedMarkersRef.current.forEach(marker => marker.setMap(null));
      placedMarkersRef.current = [];
      // Clear existing markers
      existingMarkersRef.current.forEach(marker => marker.setMap(null));
      existingMarkersRef.current = [];
      // Reset initialization flag
      isInitializedRef.current = false;
    };
  }, []);

  // Generate a distinct color for the addon that's different from main product and existing addons
  useEffect(() => {
    const usedColors = [
      mainProductMeasurement.mapColor || '#3B82F6',
      ...(existingAddonLocations?.map(loc => loc.color).filter(Boolean) || [])
    ];
    
    const distinctColor = getDistinctAddonColor(usedColors);
    setAddonProductColor(distinctColor);
  }, [mainProductMeasurement.mapColor, existingAddonLocations]);

  // Update marker scales when zoom changes
  useEffect(() => {
    const newScale = getZoomBasedMarkerScale(currentZoom);
    
    // Update placed markers
    placedMarkersRef.current.forEach(marker => {
      const currentIcon = marker.getIcon() as google.maps.Symbol;
      if (currentIcon) {
        marker.setIcon({
          ...currentIcon,
          scale: newScale,
        });
      }
    });
    
    // Update existing markers
    existingMarkersRef.current.forEach(marker => {
      const currentIcon = marker.getIcon() as google.maps.Symbol;
      if (currentIcon) {
        marker.setIcon({
          ...currentIcon,
          scale: newScale,
        });
      }
    });
  }, [currentZoom]);

  const initializeMap = async () => {
    try {
      await loadGoogleMapsAPI();
      
      const mapElement = document.getElementById('addon-placement-map');
      if (!mapElement) return;

      // Start with a sensible default
      let center = { lat: 40.7128, lng: -74.0060 }; // Default NYC
      let zoom = 20;

      // Try to restore saved map state from the main measurement view
      const savedState = sessionStorage.getItem(STORAGE_KEY);
      if (savedState) {
        try {
          const parsed = JSON.parse(savedState);
          if (parsed.center) {
            center = parsed.center;
          }
          if (parsed.zoom) {
            zoom = parsed.zoom;
          }
        } catch (e) {
          console.error('Failed to parse saved map state:', e);
        }
      } else {
        // Fallback to main product measurement geometry
        if (mainProductMeasurement.centerPoint) {
          center = mainProductMeasurement.centerPoint;
        } else if (mainProductMeasurement.coordinates && mainProductMeasurement.coordinates.length > 0) {
          const coords = mainProductMeasurement.coordinates[0];
          center = { lat: coords[0], lng: coords[1] };
        } else if (mainProductMeasurement.pointLocations && mainProductMeasurement.pointLocations.length > 0) {
          center = mainProductMeasurement.pointLocations[0];
        }
      }

      const mapInstance = new google.maps.Map(mapElement, {
        center,
        zoom,
        mapTypeId: google.maps.MapTypeId.HYBRID,
        mapTypeControl: false,
        streetViewControl: false,
        fullscreenControl: false,
        zoomControl: true,
        zoomControlOptions: {
          position: google.maps.ControlPosition.RIGHT_CENTER,
        },
        tilt: 0,
        rotateControl: false,
        gestureHandling: 'greedy',
        disableDefaultUI: true,
        styles: [
          {
            featureType: 'poi',
            elementType: 'labels',
            stylers: [{ visibility: 'off' }],
          },
          {
            featureType: 'poi.business',
            stylers: [{ visibility: 'off' }],
          },
          {
            featureType: 'transit',
            elementType: 'labels',
            stylers: [{ visibility: 'off' }],
          },
        ],
      });

      mapRef.current = mapInstance;
      setMap(mapInstance);

      // Track zoom changes for dynamic marker sizing
      mapInstance.addListener('zoom_changed', () => {
        const newZoom = mapInstance.getZoom();
        if (newZoom) {
          setCurrentZoom(newZoom);
        }
      });

      // Draw the main product measurement (read-only)
      drawMainProductShape(mapInstance);

      // Render existing addon markers (read-only, for visual reference only)
      // These are NOT included in placedLocations when user clicks Done
      if (existingAddonLocations && existingAddonLocations.length > 0) {
        const existingMarkersToAdd: google.maps.Marker[] = [];
        existingAddonLocations.forEach((loc, index) => {
          const markerColor = loc.color || '#9CA3AF'; // Gray for existing markers

          const marker = new google.maps.Marker({
            position: { lat: loc.lat, lng: loc.lng },
            map: mapInstance,
            title: `Existing placement`,
            icon: {
              path: google.maps.SymbolPath.CIRCLE,
              scale: getZoomBasedMarkerScale(zoom),
              fillColor: markerColor,
              fillOpacity: 0.6,
              strokeColor: 'white',
              strokeWeight: 2,
            },
            draggable: false, // Existing markers are not draggable
          });

          existingMarkersToAdd.push(marker);
        });

        existingMarkersRef.current = existingMarkersToAdd;
        setExistingMarkers(existingMarkersToAdd);
      }

      // Add click listener for placing add-on markers
      mapInstance.addListener('click', (e: google.maps.MapMouseEvent) => {
        if (e.latLng) {
          placeAddonMarker(mapInstance, e.latLng);
        }
      });
      
      // Mark as initialized
      isInitializedRef.current = true;
      console.log('✅ AddonPlacement - Map initialized successfully');

    } catch (error) {
      console.error('Error initializing map:', error);
      toast.error('Failed to load map');
    }
  };

  const drawMainProductShape = (mapInstance: google.maps.Map) => {
    const color = mainProductMeasurement.mapColor || '#3B82F6';
    
    if (mainProductMeasurement.type === 'area') {
      // Handle multiple segments if present
      const segmentsToRender = mainProductMeasurement.segments || (mainProductMeasurement.coordinates ? [mainProductMeasurement.coordinates] : []);
      
      segmentsToRender.forEach((segmentCoords, idx) => {
        const paths = segmentCoords.map(coord => ({
          lat: coord[0],
          lng: coord[1]
        }));

        const polygon = new google.maps.Polygon({
          paths,
          strokeColor: color,
          strokeOpacity: 0.8,
          strokeWeight: 2,
          fillColor: color,
          fillOpacity: 0.2,
          editable: false,
          draggable: false,
          map: mapInstance
        });

        // Store first polygon as mainProductShape for reference
        if (idx === 0) {
          setMainProductShape(polygon);
        }
      });
    } else if (mainProductMeasurement.type === 'linear') {
      // Handle multiple segments if present
      const segmentsToRender = mainProductMeasurement.segments || (mainProductMeasurement.coordinates ? [mainProductMeasurement.coordinates] : []);
      
      segmentsToRender.forEach((segmentCoords, idx) => {
        const path = segmentCoords.map(coord => ({
          lat: coord[0],
          lng: coord[1]
        }));

        const polyline = new google.maps.Polyline({
          path,
          strokeColor: color,
          strokeOpacity: 0.8,
          strokeWeight: 3,
          editable: false,
          draggable: false,
          map: mapInstance
        });

        // Store first polyline as mainProductShape for reference
        if (idx === 0) {
          setMainProductShape(polyline);
        }
      });
    }
  };

  const placeAddonMarker = (mapInstance: google.maps.Map, latLng: google.maps.LatLng) => {
    // Use refs so the map click handler always has the latest marker count
    const currentMarkers = placedMarkersRef.current;
    const currentLocations = placedLocationsRef.current;

    // Calculate the number for this new marker
    const markerNumber = currentMarkers.length + 1;
    
    // Use the linked product's color if available, otherwise fall back to main product color
    const markerColor = addonProductColor || mainProductMeasurement.mapColor || '#3B82F6';
    
    const currentMapZoom = mapRef.current?.getZoom() || 20;
    const marker = new google.maps.Marker({
      position: latLng,
      map: mapInstance,
      title: `${addonName} #${markerNumber}`,
      label: {
        text: `${markerNumber}`,
        color: 'white',
        fontSize: '11px',
        fontWeight: 'normal'
      },
      icon: {
        path: google.maps.SymbolPath.CIRCLE,
        scale: getZoomBasedMarkerScale(currentMapZoom),
        fillColor: markerColor,
        fillOpacity: 1,
        strokeColor: 'white',
        strokeWeight: 2,
      },
      draggable: true,
      animation: google.maps.Animation.DROP,
    });

    // Allow removing marker by clicking it
    marker.addListener('click', () => {
      removeMarker(marker);
    });

    const newMarkers = [...currentMarkers, marker];
    const newLocations = [...currentLocations, {
      lat: latLng.lat(),
      lng: latLng.lng()
    }];
    
    placedMarkersRef.current = newMarkers;
    placedLocationsRef.current = newLocations;

    setPlacedMarkers(newMarkers);
    setPlacedLocations(newLocations);

    toast.success(`${addonName} #${markerNumber} placed`);
  };

  const removeMarker = (marker: google.maps.Marker) => {
    const currentMarkers = placedMarkersRef.current;
    const currentLocations = placedLocationsRef.current;

    const index = currentMarkers.indexOf(marker);
    if (index > -1) {
      marker.setMap(null);
      const updatedMarkers = currentMarkers.filter((_, i) => i !== index);
      const updatedLocations = currentLocations.filter((_, i) => i !== index);
      
      placedMarkersRef.current = updatedMarkers;
      placedLocationsRef.current = updatedLocations;

      setPlacedMarkers(updatedMarkers);
      setPlacedLocations(updatedLocations);
      
      // Update remaining markers' labels with correct sequential numbers
      updatedMarkers.forEach((m, i) => {
        m.setLabel({
          text: `${i + 1}`,
          color: 'white',
          fontSize: '11px',
          fontWeight: 'normal'
        });
      });
      
      toast.info(`${addonName} removed`);
    }
  };

  const handleComplete = () => {
    if (placedLocations.length === 0) {
      toast.error('Please place at least one add-on on the map');
      return;
    }
    const finalColor = addonProductColor || mainProductMeasurement.mapColor || '#3B82F6';
    onComplete(placedLocations, finalColor);
  };

  const clearAllMarkers = () => {
    // Only clear user-placed markers, not existing ones
    placedMarkers.forEach(marker => marker.setMap(null));
    placedMarkersRef.current = [];
    placedLocationsRef.current = [];
    setPlacedMarkers([]);
    setPlacedLocations([]);
    toast.info('All placements cleared');
  };

  return (
    <div className="flex flex-col h-screen">
      {/* Map Container - takes all available space */}
      <div className="relative flex-1">
        <div 
          id="addon-placement-map" 
          className="w-full h-full absolute inset-0"
        />
        
        {/* Placement Instructions - on map */}
        <div className="absolute bottom-20 left-1/2 -translate-x-1/2 z-10 pointer-events-none px-4 w-full sm:w-auto">
          <div className="bg-white rounded-lg shadow-lg px-3 py-2 text-xs sm:text-sm text-gray-700 text-center">
            Click to place add-ons. Click marker to remove.
          </div>
        </div>
      </div>

      {/* Action Buttons Bar */}
      <div className="p-4 bg-background border-t">
        <div className="flex flex-wrap gap-2">
          <Button
            onClick={onCancel}
            variant="outline"
            size="default"
            className="flex-1 min-w-[100px]"
          >
            Cancel
          </Button>
          
          {placedLocations.length > 0 && (
            <Button
              onClick={clearAllMarkers}
              variant="outline"
              size="default"
            >
              <Trash2 className="mr-2" />
              Clear All
            </Button>
          )}
          
          <Button
            variant="success"
            size="default"
            onClick={handleComplete}
            disabled={placedLocations.length === 0}
            className="flex-1 min-w-[140px]"
          >
            <Check className="mr-2" />
            Done ({placedLocations.length})
          </Button>
        </div>
      </div>
    </div>
  );
}
