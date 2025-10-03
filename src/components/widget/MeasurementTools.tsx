/// <reference types="@types/google.maps" />
import { useState, useEffect, useRef } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Separator } from '@/components/ui/separator';
import { Loader2, Ruler, Square, MapPin } from 'lucide-react';
import { MeasurementData } from '@/types/widget';
import { supabase } from '@/integrations/supabase/client';
import { Loader } from '@googlemaps/js-api-loader';

interface MeasurementToolsProps {
  productId: string;
  onMeasurementComplete: (measurement: MeasurementData) => void;
  onNext: () => void;
  customerAddress?: string;
}

interface Product {
  id: string;
  name: string;
  unit_type: string;
}

const MeasurementTools = ({ 
  productId, 
  onMeasurementComplete, 
  onNext,
  customerAddress 
}: MeasurementToolsProps) => {
  const [product, setProduct] = useState<Product | null>(null);
  const [loading, setLoading] = useState(true);
  const [measurementType, setMeasurementType] = useState<'area' | 'linear'>('area');
  const [manualValue, setManualValue] = useState('');
  const [mapMeasurement, setMapMeasurement] = useState<number | null>(null);
  const [isDrawing, setIsDrawing] = useState(false);
  const [currentMeasurement, setCurrentMeasurement] = useState<MeasurementData | null>(null);
  const [mapError, setMapError] = useState<string | null>(null);
  const [mapLoading, setMapLoading] = useState(true);
  const [apiKey, setApiKey] = useState<string | null>(null);
  
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<google.maps.Map | null>(null);
  const drawingManagerRef = useRef<google.maps.drawing.DrawingManager | null>(null);
  const currentShapeRef = useRef<google.maps.Polygon | google.maps.Polyline | null>(null);

  useEffect(() => {
    fetchProduct();
    fetchApiKey();
  }, []);

  useEffect(() => {
    if (apiKey && !mapRef.current) {
      initializeMap();
    }
  }, [apiKey]);

  useEffect(() => {
    // Reset measurements when measurement type changes
    setManualValue('');
    setMapMeasurement(null);
    setCurrentMeasurement(null);
    clearMapDrawing();
    
    // Update drawing manager mode if it exists
    if (drawingManagerRef.current) {
      const mode = measurementType === 'area' 
        ? google.maps.drawing.OverlayType.POLYGON 
        : google.maps.drawing.OverlayType.POLYLINE;
      drawingManagerRef.current.setOptions({
        drawingMode: null,
        drawingControl: true,
        drawingControlOptions: {
          drawingModes: [mode],
        },
      });
    }
  }, [measurementType]);

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
      setMapError('Unable to load map: API key not available');
      setMapLoading(false);
    }
  };

  const fetchProduct = async () => {
    try {
      const { data, error } = await supabase
        .from('products')
        .select('id, name, unit_type')
        .eq('id', productId)
        .single();

      if (error) throw error;
      setProduct(data);
      
      if (data.unit_type.includes('sq_') || data.unit_type.includes('area')) {
        setMeasurementType('area');
      } else if (data.unit_type.includes('linear') || data.unit_type.includes('ft')) {
        setMeasurementType('linear');
      }
    } catch (error) {
      console.error('Error fetching product:', error);
    } finally {
      setLoading(false);
    }
  };

  const initializeMap = async () => {
    if (!mapContainerRef.current || !apiKey) return;
    if (mapRef.current) return;

    try {
      setMapLoading(true);
      setMapError(null);
      
      const loader = new Loader({
        apiKey: apiKey,
        version: 'weekly',
        libraries: ['drawing', 'geometry'],
      });

      await loader.load();

      let center = { lat: 39.8283, lng: -98.5795 };
      let zoom = 4;

      if (customerAddress) {
        const geocodedCenter = await geocodeAddress(customerAddress);
        if (geocodedCenter) {
          center = geocodedCenter;
          zoom = 18;
        }
      }

      const map = new google.maps.Map(mapContainerRef.current, {
        center: center,
        zoom: zoom,
        mapTypeId: google.maps.MapTypeId.HYBRID,
        mapTypeControl: true,
        streetViewControl: false,
        fullscreenControl: true,
      });

      mapRef.current = map;
      setupDrawingManager(map);
      setMapLoading(false);
      
    } catch (error) {
      console.error('Map initialization failed:', error);
      setMapError(`Unable to load map: ${error instanceof Error ? error.message : 'Unknown error'}`);
      setMapLoading(false);
    }
  };

  const geocodeAddress = async (address: string): Promise<{ lat: number; lng: number } | null> => {
    try {
      const geocoder = new google.maps.Geocoder();
      const result = await geocoder.geocode({ address });
      
      if (result.results && result.results[0]) {
        const location = result.results[0].geometry.location;
        return {
          lat: location.lat(),
          lng: location.lng(),
        };
      }
    } catch (error) {
      console.error('Error geocoding address:', error);
    }
    return null;
  };

  const setupDrawingManager = (map: google.maps.Map) => {
    const drawingManager = new google.maps.drawing.DrawingManager({
      drawingMode: null,
      drawingControl: false,
      polygonOptions: {
        fillColor: '#3B82F6',
        fillOpacity: 0.3,
        strokeColor: '#3B82F6',
        strokeWeight: 2,
        clickable: true,
        editable: true,
        zIndex: 1,
      },
      polylineOptions: {
        strokeColor: '#3B82F6',
        strokeWeight: 3,
        clickable: true,
        editable: true,
      },
    });

    drawingManager.setMap(map);
    drawingManagerRef.current = drawingManager;

    google.maps.event.addListener(drawingManager, 'overlaycomplete', (event: any) => {
      setIsDrawing(false);
      
      if (currentShapeRef.current) {
        currentShapeRef.current.setMap(null);
      }
      
      currentShapeRef.current = event.overlay;
      drawingManager.setDrawingMode(null);

      if (event.type === google.maps.drawing.OverlayType.POLYGON) {
        const polygon = event.overlay as google.maps.Polygon;
        const path = polygon.getPath();
        const area = google.maps.geometry.spherical.computeArea(path);
        const sqFt = Math.ceil(area * 10.764);
        setMapMeasurement(sqFt);
        
        google.maps.event.addListener(path, 'set_at', () => {
          const newArea = google.maps.geometry.spherical.computeArea(path);
          const newSqFt = Math.ceil(newArea * 10.764);
          setMapMeasurement(newSqFt);
        });
        
        google.maps.event.addListener(path, 'insert_at', () => {
          const newArea = google.maps.geometry.spherical.computeArea(path);
          const newSqFt = Math.ceil(newArea * 10.764);
          setMapMeasurement(newSqFt);
        });
        
      } else if (event.type === google.maps.drawing.OverlayType.POLYLINE) {
        const polyline = event.overlay as google.maps.Polyline;
        const path = polyline.getPath();
        const length = google.maps.geometry.spherical.computeLength(path);
        const feet = Math.ceil(length * 3.28084);
        setMapMeasurement(feet);
        
        google.maps.event.addListener(path, 'set_at', () => {
          const newLength = google.maps.geometry.spherical.computeLength(path);
          const newFeet = Math.ceil(newLength * 3.28084);
          setMapMeasurement(newFeet);
        });
        
        google.maps.event.addListener(path, 'insert_at', () => {
          const newLength = google.maps.geometry.spherical.computeLength(path);
          const newFeet = Math.ceil(newLength * 3.28084);
          setMapMeasurement(newFeet);
        });
      }
    });
  };

  const startDrawing = () => {
    if (!drawingManagerRef.current) return;

    setIsDrawing(true);
    clearMapDrawing();

    const mode = measurementType === 'area' 
      ? google.maps.drawing.OverlayType.POLYGON 
      : google.maps.drawing.OverlayType.POLYLINE;
    
    drawingManagerRef.current.setDrawingMode(mode);
  };

  const clearMapDrawing = () => {
    if (currentShapeRef.current) {
      currentShapeRef.current.setMap(null);
      currentShapeRef.current = null;
    }
    
    if (drawingManagerRef.current) {
      drawingManagerRef.current.setDrawingMode(null);
    }
    
    setMapMeasurement(null);
    setIsDrawing(false);
  };

  const handleManualSubmit = () => {
    const value = parseFloat(manualValue);
    if (isNaN(value) || value <= 0) return;

    const measurement: MeasurementData = {
      type: measurementType,
      value: Math.ceil(value),
      unit: measurementType === 'area' ? 'sq_ft' : 'linear_ft',
      manualEntry: true
    };

    setCurrentMeasurement(measurement);
    onMeasurementComplete(measurement);
  };

  const handleMapSubmit = () => {
    if (!mapMeasurement) return;

    const measurement: MeasurementData = {
      type: measurementType,
      value: mapMeasurement,
      unit: measurementType === 'area' ? 'sq_ft' : 'linear_ft',
      manualEntry: false
    };

    setCurrentMeasurement(measurement);
    onMeasurementComplete(measurement);
  };

  if (loading) {
    return (
      <div className="w-full h-screen flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  const unitLabel = measurementType === 'area' ? 'square feet' : 'linear feet';
  const unitAbbr = measurementType === 'area' ? 'sq ft' : 'ft';

  return (
    <div className="relative w-full h-screen">
      {/* Full-width Map */}
      <div className="relative w-full h-full">
        <div 
          ref={mapContainerRef}
          className="w-full h-full"
        />
        
        {mapLoading && (
          <div className="absolute inset-0 bg-background/95 backdrop-blur-sm flex items-center justify-center z-50">
            <div className="text-center">
              <Loader2 className="h-12 w-12 animate-spin mx-auto mb-4 text-primary" />
              <p className="text-base font-medium">Loading map...</p>
            </div>
          </div>
        )}
        
        {mapError && (
          <div className="absolute inset-0 bg-background/95 backdrop-blur-sm flex items-center justify-center z-50">
            <div className="text-center p-6">
              <MapPin className="h-12 w-12 text-destructive mx-auto mb-4" />
              <p className="text-base font-medium mb-2">Unable to Load Map</p>
              <p className="text-sm text-muted-foreground mb-4">{mapError}</p>
              <Button 
                size="sm" 
                variant="outline"
                onClick={() => {
                  setMapError(null);
                  fetchApiKey();
                }}
              >
                Try Again
              </Button>
            </div>
          </div>
        )}

        {/* Measurement Type Tabs - Top Center */}
        <div className="absolute top-4 left-1/2 -translate-x-1/2 z-10 bg-background/95 backdrop-blur-sm rounded-lg shadow-lg p-1">
          <Tabs value={measurementType} onValueChange={(value) => setMeasurementType(value as 'area' | 'linear')}>
            <TabsList className="grid w-full grid-cols-2">
              <TabsTrigger value="area" className="flex items-center gap-2">
                <Square className="h-4 w-4" />
                Area
              </TabsTrigger>
              <TabsTrigger value="linear" className="flex items-center gap-2">
                <Ruler className="h-4 w-4" />
                Line
              </TabsTrigger>
            </TabsList>
          </Tabs>
        </div>

        {/* Bottom Control Bar */}
        <div className="absolute bottom-6 left-1/2 -translate-x-1/2 z-10 w-full max-w-2xl px-4">
          <Card className="bg-background/95 backdrop-blur-sm shadow-2xl border-2">
            <CardContent className="p-4">
              {/* Drawing Controls */}
              <div className="flex items-center justify-center gap-3 mb-4">
                <Button
                  onClick={startDrawing}
                  disabled={mapLoading || !!mapError || isDrawing}
                  size="lg"
                  variant={isDrawing || mapMeasurement ? "secondary" : "default"}
                  className="flex-1"
                >
                  {measurementType === 'area' ? <Square className="mr-2 h-4 w-4" /> : <Ruler className="mr-2 h-4 w-4" />}
                  {isDrawing ? 'Drawing...' : 'Start Drawing'}
                </Button>
                
                {(isDrawing || mapMeasurement) && (
                  <Button 
                    onClick={clearMapDrawing}
                    variant="outline"
                    size="lg"
                  >
                    Undo
                  </Button>
                )}
              </div>

              {/* Current Measurement Display */}
              {mapMeasurement && !isDrawing && (
                <div className="bg-primary/10 border border-primary rounded-lg p-4 mb-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm text-muted-foreground mb-1">Measured on map</p>
                      <p className="text-2xl font-bold text-primary">
                        {mapMeasurement.toLocaleString()} {unitAbbr}
                      </p>
                    </div>
                    <Button onClick={handleMapSubmit} size="lg">
                      Use Measurement
                    </Button>
                  </div>
                </div>
              )}

              {/* Manual Entry Option */}
              {!mapMeasurement && !isDrawing && (
                <>
                  <div className="relative my-4">
                    <div className="absolute inset-0 flex items-center">
                      <Separator />
                    </div>
                    <div className="relative flex justify-center text-xs uppercase">
                      <span className="bg-background px-2 text-muted-foreground">Or enter manually</span>
                    </div>
                  </div>

                  <div className="flex gap-2">
                    <Input
                      type="number"
                      placeholder={`Enter ${unitLabel}`}
                      value={manualValue}
                      onChange={(e) => setManualValue(e.target.value)}
                      min="0"
                      step="0.01"
                      className="flex-1"
                    />
                    <Button 
                      onClick={handleManualSubmit}
                      disabled={!manualValue || parseFloat(manualValue) <= 0}
                      size="lg"
                    >
                      Submit
                    </Button>
                  </div>
                </>
              )}

              {/* Measurement Confirmed - Continue Button */}
              {currentMeasurement && (
                <Button onClick={onNext} size="lg" className="w-full mt-4">
                  Continue with {currentMeasurement.value.toLocaleString()} {unitAbbr}
                </Button>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
};

export default MeasurementTools;