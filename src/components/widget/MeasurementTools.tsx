/// <reference types="@types/google.maps" />
import { useState, useEffect, useRef } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Loader2, Ruler, Square, MapPin, Edit3 } from 'lucide-react';
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
      // Get API key from edge function
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
      
      // Set measurement type based on unit type
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
    if (!mapContainerRef.current || !apiKey) {
      console.error('No map container or API key available');
      return;
    }

    if (mapRef.current) {
      console.log('Map already initialized');
      return;
    }

    try {
      setMapLoading(true);
      setMapError(null);
      
      console.log('Loading Google Maps API...');
      
      // Load Google Maps JavaScript API
      const loader = new Loader({
        apiKey: apiKey,
        version: 'weekly',
        libraries: ['drawing', 'geometry'],
      });

      await loader.load();
      
      console.log('Google Maps API loaded successfully');

      // Default center (US center)
      let center = { lat: 39.8283, lng: -98.5795 };
      let zoom = 4;

      // Try to geocode customer address if provided
      if (customerAddress) {
        const geocodedCenter = await geocodeAddress(customerAddress);
        if (geocodedCenter) {
          center = geocodedCenter;
          zoom = 18;
        }
      }

      // Create map
      const map = new google.maps.Map(mapContainerRef.current, {
        center: center,
        zoom: zoom,
        mapTypeId: google.maps.MapTypeId.HYBRID,
        mapTypeControl: true,
        streetViewControl: false,
        fullscreenControl: false,
      });

      mapRef.current = map;
      console.log('Map created successfully');

      // Set up drawing manager
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
    const drawingMode = measurementType === 'area' 
      ? google.maps.drawing.OverlayType.POLYGON 
      : google.maps.drawing.OverlayType.POLYLINE;

    const drawingManager = new google.maps.drawing.DrawingManager({
      drawingMode: null,
      drawingControl: false, // We'll control this manually
      polygonOptions: {
        fillColor: '#FF0000',
        fillOpacity: 0.3,
        strokeColor: '#FF0000',
        strokeWeight: 2,
        clickable: true,
        editable: true,
        zIndex: 1,
      },
      polylineOptions: {
        strokeColor: '#0000FF',
        strokeWeight: 3,
        clickable: true,
        editable: true,
      },
    });

    drawingManager.setMap(map);
    drawingManagerRef.current = drawingManager;

    // Listen for shape completion
    google.maps.event.addListener(drawingManager, 'overlaycomplete', (event: any) => {
      setIsDrawing(false);
      
      // Remove previous shape if exists
      if (currentShapeRef.current) {
        currentShapeRef.current.setMap(null);
      }
      
      currentShapeRef.current = event.overlay;
      drawingManager.setDrawingMode(null);

      // Calculate measurement
      if (event.type === google.maps.drawing.OverlayType.POLYGON) {
        const polygon = event.overlay as google.maps.Polygon;
        const path = polygon.getPath();
        const area = google.maps.geometry.spherical.computeArea(path);
        const sqFt = Math.ceil(area * 10.764); // Convert m² to sq ft
        setMapMeasurement(sqFt);
        
        // Add listener for edits
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
        const feet = Math.ceil(length * 3.28084); // Convert meters to feet
        setMapMeasurement(feet);
        
        // Add listener for edits
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

  const canProceed = currentMeasurement !== null;

  if (loading) {
    return (
      <Card className="max-w-4xl mx-auto">
        <CardContent className="flex items-center justify-center py-12">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </CardContent>
      </Card>
    );
  }

  const unitLabel = measurementType === 'area' ? 'square feet' : 'linear feet';
  const unitAbbr = measurementType === 'area' ? 'sq ft' : 'ft';

  return (
    <Card className="max-w-4xl mx-auto">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          {measurementType === 'area' ? (
            <Square className="h-5 w-5 text-primary" />
          ) : (
            <Ruler className="h-5 w-5 text-primary" />
          )}
          Measure Your Project
        </CardTitle>
        <p className="text-sm text-muted-foreground">
          {product && `Measuring for: ${product.name}`}
          <br />
          {measurementType === 'area' 
            ? 'Draw the area on the map or enter the square footage manually'
            : 'Draw the distance on the map or enter the linear feet manually'
          }
        </p>
      </CardHeader>
      
      <CardContent className="space-y-6">
        {/* Measurement Type Selector */}
        <div className="flex justify-center">
          <Tabs value={measurementType} onValueChange={(value) => setMeasurementType(value as 'area' | 'linear')}>
            <TabsList className="grid w-full grid-cols-2 max-w-md">
              <TabsTrigger value="area" className="flex items-center gap-2">
                <Square className="h-4 w-4" />
                Area ({unitAbbr})
              </TabsTrigger>
              <TabsTrigger value="linear" className="flex items-center gap-2">
                <Ruler className="h-4 w-4" />
                Length (ft)
              </TabsTrigger>
            </TabsList>
          </Tabs>
        </div>

        {/* Map Measurement */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-lg flex items-center gap-2">
              <MapPin className="h-4 w-4" />
              Map Measurement
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="relative">
              <div 
                ref={mapContainerRef}
                className="w-full h-64 sm:h-80 bg-muted rounded-lg border"
                style={{ minHeight: '320px' }}
              />
              
              {/* Map Loading Overlay */}
              {mapLoading && (
                <div className="absolute inset-0 bg-background/90 flex items-center justify-center rounded-lg">
                  <div className="text-center">
                    <Loader2 className="h-8 w-8 animate-spin mx-auto mb-2 text-primary" />
                    <p className="text-sm text-muted-foreground">Loading Google Maps...</p>
                  </div>
                </div>
              )}
              
              {/* Map Error State */}
              {mapError && (
                <div className="absolute inset-0 bg-background/90 flex items-center justify-center rounded-lg">
                  <div className="text-center p-4">
                    <MapPin className="h-8 w-8 mx-auto mb-2 text-muted-foreground" />
                    <p className="text-sm font-medium mb-2">Map Unavailable</p>
                    <p className="text-xs text-muted-foreground mb-3">{mapError}</p>
                    <Button 
                      size="sm" 
                      variant="outline"
                      onClick={() => {
                        setMapError(null);
                        fetchApiKey();
                      }}
                    >
                      Retry Map
                    </Button>
                  </div>
                </div>
              )}
            </div>
            
            <div className="flex flex-col sm:flex-row gap-2">
              <Button
                onClick={startDrawing}
                disabled={isDrawing || !!mapError || mapLoading}
                variant="outline"
                className="flex-1"
              >
                {isDrawing ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin mr-2" />
                    Drawing... Click to place points
                  </>
                ) : (
                  <>
                    <Edit3 className="h-4 w-4 mr-2" />
                    {measurementType === 'area' ? 'Draw Area' : 'Draw Line'}
                  </>
                )}
              </Button>
              
              <Button
                onClick={clearMapDrawing}
                variant="outline"
                disabled={(!mapMeasurement && !isDrawing) || !!mapError}
              >
                Clear
              </Button>
            </div>

            {mapMeasurement && (
              <div className="flex items-center justify-between p-3 bg-success/10 rounded-lg border border-success/20">
                <span className="text-sm font-medium">
                  Measured: <strong>{mapMeasurement.toLocaleString()} {unitAbbr}</strong>
                </span>
                <Button onClick={handleMapSubmit} size="sm">
                  Use This Measurement
                </Button>
              </div>
            )}

            {isDrawing && (
              <p className="text-sm text-muted-foreground text-center">
                {measurementType === 'area' 
                  ? 'Click on the map to create points for your area. Click the first point again to complete.'
                  : 'Click on the map to create points for your line measurement.'
                }
              </p>
            )}
          </CardContent>
        </Card>

        {/* Manual Entry */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-lg flex items-center gap-2">
              <Edit3 className="h-4 w-4" />
              Manual Entry
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex gap-2">
              <div className="flex-1">
                <Label htmlFor="manual-measurement">
                  {measurementType === 'area' ? 'Square Feet' : 'Linear Feet'}
                </Label>
                <Input
                  id="manual-measurement"
                  type="number"
                  min="0"
                  step="0.1"
                  value={manualValue}
                  onChange={(e) => setManualValue(e.target.value)}
                  placeholder={`Enter ${unitLabel}`}
                />
              </div>
              <div className="flex items-end">
                <Button
                  onClick={handleManualSubmit}
                  disabled={!manualValue || parseFloat(manualValue) <= 0}
                >
                  Use This
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Current Selection Display */}
        {currentMeasurement && (
          <Card className="border-primary bg-primary/5">
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">Selected Measurement</p>
                  <p className="text-2xl font-bold">
                    {currentMeasurement.value.toLocaleString()} {currentMeasurement.unit.replace('_', ' ')}
                  </p>
                  <p className="text-xs text-muted-foreground mt-1">
                    {currentMeasurement.manualEntry ? 'Manual entry' : 'From map'}
                  </p>
                </div>
                <Button onClick={onNext} size="lg">
                  Continue
                </Button>
              </div>
            </CardContent>
          </Card>
        )}
      </CardContent>
    </Card>
  );
};

export default MeasurementTools;