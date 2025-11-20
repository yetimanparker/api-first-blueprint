import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { MapPin, Trash2, Check } from 'lucide-react';
import { loadGoogleMapsAPI } from '@/lib/googleMapsLoader';
import { toast } from 'sonner';

interface AddonPlacementProps {
  addonName: string;
  mainProductMeasurement: {
    type: 'area' | 'linear' | 'point';
    coordinates?: number[][];
    pointLocations?: Array<{lat: number, lng: number}>;
    centerPoint?: {lat: number, lng: number};
    mapColor?: string;
  };
  customerAddress?: string;
  onComplete: (locations: Array<{lat: number, lng: number}>) => void;
  onCancel: () => void;
}

export function AddonPlacement({
  addonName,
  mainProductMeasurement,
  customerAddress,
  onComplete,
  onCancel
}: AddonPlacementProps) {
  const [map, setMap] = useState<google.maps.Map | null>(null);
  const [mainProductShape, setMainProductShape] = useState<google.maps.Polygon | google.maps.Polyline | null>(null);
  const [placedMarkers, setPlacedMarkers] = useState<google.maps.Marker[]>([]);
  const [placedLocations, setPlacedLocations] = useState<Array<{lat: number, lng: number}>>([]);

  useEffect(() => {
    initializeMap();
  }, []);

  const initializeMap = async () => {
    try {
      await loadGoogleMapsAPI();
      
      const mapElement = document.getElementById('addon-placement-map');
      if (!mapElement) return;

      // Determine center point
      let center = { lat: 40.7128, lng: -74.0060 }; // Default NYC
      
      if (mainProductMeasurement.centerPoint) {
        center = mainProductMeasurement.centerPoint;
      } else if (mainProductMeasurement.coordinates && mainProductMeasurement.coordinates.length > 0) {
        const coords = mainProductMeasurement.coordinates[0];
        center = { lat: coords[0], lng: coords[1] };
      } else if (mainProductMeasurement.pointLocations && mainProductMeasurement.pointLocations.length > 0) {
        center = mainProductMeasurement.pointLocations[0];
      }

      const mapInstance = new google.maps.Map(mapElement, {
        center,
        zoom: 20,
        mapTypeId: 'satellite',
        tilt: 0,
        mapTypeControl: true,
        streetViewControl: false,
        fullscreenControl: false,
      });

      setMap(mapInstance);

      // Draw the main product measurement (read-only)
      drawMainProductShape(mapInstance);

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
    // Calculate the number for this new marker
    const markerNumber = placedMarkers.length + 1;
    
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
        fillColor: '#10B981',
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

    const newMarkers = [...placedMarkers, marker];
    const newLocations = [...placedLocations, {
      lat: latLng.lat(),
      lng: latLng.lng()
    }];
    
    setPlacedMarkers(newMarkers);
    setPlacedLocations(newLocations);

    toast.success(`${addonName} #${markerNumber} placed`);
  };

  const removeMarker = (marker: google.maps.Marker) => {
    const index = placedMarkers.indexOf(marker);
    if (index > -1) {
      marker.setMap(null);
      const updatedMarkers = placedMarkers.filter((_, i) => i !== index);
      
      setPlacedMarkers(updatedMarkers);
      setPlacedLocations(prev => prev.filter((_, i) => i !== index));
      
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
    onComplete(placedLocations);
  };

  const clearAllMarkers = () => {
    placedMarkers.forEach(marker => marker.setMap(null));
    setPlacedMarkers([]);
    setPlacedLocations([]);
    toast.info('All placements cleared');
  };

  return (
    <Card className="w-full">
      <CardHeader className="bg-primary text-primary-foreground">
        <CardTitle className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <MapPin className="h-5 w-5" />
            <span>Place {addonName} on Map</span>
          </div>
          <Badge variant="secondary" className="bg-background/20 text-primary-foreground">
            {placedLocations.length} placed
          </Badge>
        </CardTitle>
      </CardHeader>
      <CardContent className="p-0">
        {/* Map Container */}
        <div 
          id="addon-placement-map" 
          className="w-full h-[400px] border-b"
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
