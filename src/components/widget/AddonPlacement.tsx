import { useState, useEffect, useRef } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { MapPin, Trash2, Check } from 'lucide-react';
import { loadGoogleMapsAPI } from '@/lib/googleMapsLoader';
import { toast } from 'sonner';

interface AddonPlacementProps {
  addonName: string;
  linkedProductId?: string;
  mainProductMeasurement: {
    type: 'area' | 'linear' | 'point';
    coordinates?: number[][];
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

  const mapRef = useRef<google.maps.Map | null>(null);
  const placedMarkersRef = useRef<google.maps.Marker[]>([]);
  const placedLocationsRef = useRef<Array<{ lat: number; lng: number }>>([]);
  const STORAGE_KEY = `map-state-${customerAddress || 'default'}`;

  useEffect(() => {
    initializeMap();
  }, []);

  // Generate a random distinct color for the addon
  useEffect(() => {
    const generateDistinctColor = () => {
      const mainColor = mainProductMeasurement.mapColor || '#3B82F6';
      
      // Predefined distinct colors that work well on maps
      const distinctColors = [
        '#10B981', // green
        '#F59E0B', // amber
        '#EF4444', // red
        '#8B5CF6', // purple
        '#EC4899', // pink
        '#14B8A6', // teal
        '#F97316', // orange
        '#06B6D4', // cyan
      ];
      
      // Filter out colors too similar to the main product color
      const availableColors = distinctColors.filter(color => color !== mainColor);
      
      // Pick a random color from available colors
      const randomColor = availableColors[Math.floor(Math.random() * availableColors.length)];
      
      setAddonProductColor(randomColor);
    };
    
    generateDistinctColor();
  }, [mainProductMeasurement.mapColor]);

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

      // Draw the main product measurement (read-only)
      drawMainProductShape(mapInstance);

      // Render any existing addon markers so they stay visible across sessions
      if (existingAddonLocations && existingAddonLocations.length > 0) {
        existingAddonLocations.forEach((loc) => {
          const markerNumber = placedMarkersRef.current.length + 1;
          const markerColor =
            loc.color || addonProductColor || mainProductMeasurement.mapColor || '#3B82F6';

          const marker = new google.maps.Marker({
            position: { lat: loc.lat, lng: loc.lng },
            map: mapInstance,
            title: `${addonName} #${markerNumber}`,
            label: {
              text: `${markerNumber}`,
              color: 'white',
              fontSize: '12px',
              fontWeight: 'bold',
            },
            icon: {
              path: google.maps.SymbolPath.CIRCLE,
              scale: 12,
              fillColor: markerColor,
              fillOpacity: 1,
              strokeColor: 'white',
              strokeWeight: 2,
            },
            draggable: true,
          });

          marker.addListener('click', () => {
            removeMarker(marker);
          });

          placedMarkersRef.current = [...placedMarkersRef.current, marker];
          placedLocationsRef.current = [
            ...placedLocationsRef.current,
            { lat: loc.lat, lng: loc.lng },
          ];
        });

        setPlacedMarkers(placedMarkersRef.current);
        setPlacedLocations(placedLocationsRef.current);
      }

      // Add click listener for placing add-on markers
      mapInstance.addListener('click', (e: google.maps.MapMouseEvent) => {
        if (e.latLng) {
          placeAddonMarker(mapInstance, e.latLng);
        }
      });

    } catch (error) {
      console.error('Error initializing map:', error);
      toast.error('Failed to load map');
    }
  };

  const drawMainProductShape = (mapInstance: google.maps.Map) => {
    const color = mainProductMeasurement.mapColor || '#3B82F6';
    
    if (mainProductMeasurement.type === 'area' && mainProductMeasurement.coordinates) {
      // Draw polygon
      const paths = mainProductMeasurement.coordinates.map(coord => ({
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

      setMainProductShape(polygon);
    } else if (mainProductMeasurement.type === 'linear' && mainProductMeasurement.coordinates) {
      // Draw polyline
      const path = mainProductMeasurement.coordinates.map(coord => ({
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

      setMainProductShape(polyline);
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
    
    const marker = new google.maps.Marker({
      position: latLng,
      map: mapInstance,
      title: `${addonName} #${markerNumber}`,
      label: {
        text: `${markerNumber}`,
        color: 'white',
        fontSize: '12px',
        fontWeight: 'bold'
      },
      icon: {
        path: google.maps.SymbolPath.CIRCLE,
        scale: 12,
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
          fontSize: '12px',
          fontWeight: 'bold'
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
    placedMarkers.forEach(marker => marker.setMap(null));
    placedMarkersRef.current = [];
    placedLocationsRef.current = [];
    setPlacedMarkers([]);
    setPlacedLocations([]);
    toast.info('All placements cleared');
  };

  return (
    <Card className="w-full">
      <CardContent className="p-0">
        {/* Map Container */}
        <div 
          id="addon-placement-map" 
          className="w-full min-h-[500px] border-b"
        />

        {/* Instructions */}
        <div className="p-4 bg-muted/30">
          <p className="text-sm text-muted-foreground mb-3">
            Tap on the map to place {addonName} at specific locations. 
            Tap a marker to remove it.
          </p>

          {/* Action Buttons */}
          <div className="flex flex-wrap gap-2">
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
              onClick={onCancel}
              variant="outline"
              size="default"
              className="flex-1 min-w-[100px]"
            >
              Cancel
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
