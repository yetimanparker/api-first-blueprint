/// <reference types="@types/google.maps" />
import { useState, useEffect, useRef } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { MapPin, Undo2, Check, Loader2 } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { Loader } from '@googlemaps/js-api-loader';
import { MeasurementData } from '@/types/widget';

interface PointPlacementProps {
  productId: string;
  productName: string;
  quantity: number;
  customerAddress?: string;
  onPointsSet: (measurement: MeasurementData) => void;
  onSkip: () => void;
  existingQuoteItems?: Array<{
    id: string;
    productName: string;
    customName?: string;
    measurement: MeasurementData;
  }>;
}

const PointPlacement = ({
  productName,
  quantity,
  customerAddress,
  onPointsSet,
  onSkip,
  existingQuoteItems = []
}: PointPlacementProps) => {
  const [placedPoints, setPlacedPoints] = useState<google.maps.Marker[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [apiKey, setApiKey] = useState<string | null>(null);
  
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<google.maps.Map | null>(null);
  const clickListenerRef = useRef<google.maps.MapsEventListener | null>(null);
  const previousShapesRef = useRef<Array<google.maps.Polygon | google.maps.Polyline>>([]);
  const previousLabelsRef = useRef<Array<google.maps.Marker>>([]);

  const POINT_COLOR = '#10B981';

  useEffect(() => {
    fetchApiKey();
    return () => {
      if (clickListenerRef.current) {
        google.maps.event.removeListener(clickListenerRef.current);
      }
    };
  }, []);

  useEffect(() => {
    if (apiKey && !mapRef.current) {
      initializeMap();
    }
  }, [apiKey]);

  const fetchApiKey = async () => {
    try {
      const { data, error } = await supabase.functions.invoke('get-google-maps-key');
      if (error) throw error;
      if (data?.apiKey) {
        setApiKey(data.apiKey);
      } else {
        throw new Error('No API key returned');
      }
    } catch (error) {
      console.error('Error fetching API key:', error);
      setError('Unable to load map: API key not available');
      setLoading(false);
    }
  };

  const initializeMap = async () => {
    if (!mapContainerRef.current || !apiKey) {
      setLoading(false);
      return;
    }
    if (mapRef.current) {
      setLoading(false);
      return;
    }

    // Set a timeout to prevent infinite loading
    const timeoutId = setTimeout(() => {
      console.error('Map initialization timeout');
      setError('Map loading timeout. Please try again.');
      setLoading(false);
    }, 10000); // 10 second timeout

    try {
      setLoading(true);
      setError(null);

      if (typeof google === 'undefined' || !google.maps) {
        const loader = new Loader({
          apiKey: apiKey,
          version: 'weekly',
          libraries: ['geometry'],
        });
        await loader.load();
      }

      // Determine map center - default to US center, will geocode later if address provided
      let center = { lat: 39.8283, lng: -98.5795 };
      let zoom = 4;

      // Try to geocode if address exists, but don't block map initialization
      if (customerAddress) {
        try {
          const geocodedCenter = await geocodeAddress(customerAddress);
          if (geocodedCenter) {
            center = geocodedCenter;
            zoom = 21;
          }
        } catch (error) {
          console.log('Geocoding skipped, will use default center');
        }
      }

      const map = new google.maps.Map(mapContainerRef.current, {
        center: center,
        zoom: zoom,
        mapTypeId: google.maps.MapTypeId.HYBRID,
        mapTypeControl: false,
        streetViewControl: false,
        fullscreenControl: false,
        zoomControl: true,
        zoomControlOptions: {
          position: google.maps.ControlPosition.RIGHT_CENTER
        },
        gestureHandling: 'greedy',
        disableDefaultUI: false,
      });

      mapRef.current = map;

      try {
        renderExistingMeasurements(map);
      } catch (error) {
        console.error('Error rendering existing measurements:', error);
      }

      clickListenerRef.current = map.addListener('click', (e: google.maps.MapMouseEvent) => {
        if (placedPoints.length < quantity && e.latLng) {
          addPoint(map, e.latLng);
        }
      });

      clearTimeout(timeoutId);
      setLoading(false);
    } catch (error) {
      clearTimeout(timeoutId);
      console.error('Map initialization failed:', error);
      setError(`Unable to load map: ${error instanceof Error ? error.message : 'Unknown error'}`);
      setLoading(false);
    }
  };

  const geocodeAddress = async (address: string): Promise<{ lat: number; lng: number } | null> => {
    try {
      const geocoder = new google.maps.Geocoder();
      const result = await geocoder.geocode({ address });
      if (result.results && result.results[0]) {
        const location = result.results[0].geometry.location;
        return { lat: location.lat(), lng: location.lng() };
      }
    } catch (error) {
      console.error('Error geocoding address:', error);
    }
    return null;
  };

  const renderExistingMeasurements = (map: google.maps.Map) => {
    previousShapesRef.current.forEach(shape => shape.setMap(null));
    previousShapesRef.current = [];
    previousLabelsRef.current.forEach(label => label.setMap(null));
    previousLabelsRef.current = [];

    existingQuoteItems.forEach((item) => {
      if (!item.measurement.coordinates || item.measurement.coordinates.length === 0) {
        return;
      }

      const color = item.measurement.mapColor || '#3B82F6';
      const latLngs = item.measurement.coordinates.map(coord => ({
        lat: coord[0],
        lng: coord[1]
      }));

      if (item.measurement.type === 'area') {
        const polygon = new google.maps.Polygon({
          paths: latLngs,
          fillColor: color,
          fillOpacity: 0.25,
          strokeColor: color,
          strokeWeight: 2,
          clickable: false,
          editable: false,
          zIndex: 0,
        });
        polygon.setMap(map);
        previousShapesRef.current.push(polygon);
      } else if (item.measurement.type === 'linear') {
        const polyline = new google.maps.Polyline({
          path: latLngs,
          strokeColor: color,
          strokeWeight: 3,
          clickable: false,
          editable: false,
          zIndex: 0,
        });
        polyline.setMap(map);
        previousShapesRef.current.push(polyline);
      }
    });
  };

  const addPoint = (map: google.maps.Map, latLng: google.maps.LatLng) => {
    const pointNumber = placedPoints.length + 1;

    const marker = new google.maps.Marker({
      position: latLng,
      map: map,
      label: {
        text: pointNumber.toString(),
        color: 'white',
        fontSize: '14px',
        fontWeight: 'bold'
      },
      icon: {
        path: google.maps.SymbolPath.CIRCLE,
        fillColor: POINT_COLOR,
        fillOpacity: 0.9,
        strokeColor: 'white',
        strokeWeight: 2,
        scale: 15,
      },
      draggable: true,
      zIndex: 1000,
    });

    marker.addListener('dragend', () => {
      console.log('Point moved:', pointNumber);
    });

    setPlacedPoints(prev => [...prev, marker]);
  };

  const handleRemoveLast = () => {
    if (placedPoints.length === 0) return;
    const lastMarker = placedPoints[placedPoints.length - 1];
    lastMarker.setMap(null);
    setPlacedPoints(prev => prev.slice(0, -1));
  };

  const handleContinue = () => {
    const pointLocations = placedPoints.map(marker => {
      const pos = marker.getPosition();
      return {
        lat: pos?.lat() || 0,
        lng: pos?.lng() || 0
      };
    });

    const measurement: MeasurementData = {
      type: 'point',
      value: quantity,
      unit: 'each',
      pointLocations: pointLocations,
      coordinates: pointLocations.map(p => [p.lat, p.lng]),
      manualEntry: false,
      mapColor: POINT_COLOR
    };

    onPointsSet(measurement);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center p-12">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="max-w-2xl mx-auto px-4 py-6">
        <Card className="border-destructive">
          <CardContent className="pt-6">
            <p className="text-destructive mb-4">{error}</p>
            <Button onClick={onSkip} variant="outline" className="w-full">
              Skip Map and Continue
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="max-w-6xl mx-auto px-4 py-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center justify-between">
            <span className="flex items-center gap-2">
              <MapPin className="h-5 w-5 text-primary" />
              Place {productName} Locations
            </span>
            <span className="text-sm font-normal text-muted-foreground">
              Placed {placedPoints.length} of {quantity}
            </span>
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {!customerAddress && (
            <div className="bg-muted/50 border border-border rounded-lg p-3">
              <p className="text-sm text-muted-foreground">
                💡 <strong>Tip:</strong> For best results, enter your property address first to center the map. You can zoom and pan to find your location.
              </p>
            </div>
          )}
          <p className="text-sm text-muted-foreground">
            Click on the map to mark exact locations for each item. You can drag markers to adjust their positions.
          </p>

          <div 
            ref={mapContainerRef} 
            className="w-full h-[500px] rounded-lg border-2 border-border overflow-hidden"
            style={{ cursor: placedPoints.length < quantity ? 'crosshair' : 'default' }}
          />

          <div className="flex gap-3">
            <Button
              variant="outline"
              onClick={handleRemoveLast}
              disabled={placedPoints.length === 0}
              className="flex-1"
            >
              <Undo2 className="mr-2 h-4 w-4" />
              Remove Last
            </Button>
            
            <Button
              variant="outline"
              onClick={onSkip}
              className="flex-1"
            >
              Skip Map
            </Button>
            
            <Button
              onClick={handleContinue}
              disabled={placedPoints.length === 0}
              className="flex-1"
            >
              <Check className="mr-2 h-4 w-4" />
              Continue ({placedPoints.length}/{quantity})
            </Button>
          </div>

          {placedPoints.length === quantity && (
            <p className="text-sm text-green-600 font-medium text-center">
              ✓ All {quantity} points placed! Click "Continue" to proceed.
            </p>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

export default PointPlacement;
