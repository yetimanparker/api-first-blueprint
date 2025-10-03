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
    <div className="min-h-screen bg-gradient-to-b from-background to-muted/20 py-8">
      <div className="max-w-3xl mx-auto px-4 space-y-6">
        {/* Main Card */}
        <Card className="shadow-lg border-0">
          <CardHeader className="text-center space-y-4 pb-6">
            <div className="flex items-center justify-center gap-3">
              <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center">
                {measurementType === 'area' ? (
                  <Square className="h-6 w-6 text-primary" />
                ) : (
                  <Ruler className="h-6 w-6 text-primary" />
                )}
              </div>
              <CardTitle className="text-2xl">Measure Area</CardTitle>
            </div>
            {product && (
              <p className="text-sm text-muted-foreground max-w-md mx-auto">
                {measurementType === 'area' 
                  ? 'Draw your project area on the map or enter dimensions manually'
                  : 'Measure the length of your project on the map or enter manually'
                }
              </p>
            )}
          </CardHeader>
          
          <CardContent className="space-y-6 pb-8">
            {/* Measurement Type Tabs */}
            <Tabs value={measurementType} onValueChange={(value) => setMeasurementType(value as 'area' | 'linear')}>
              <TabsList className="grid w-full grid-cols-2">
                <TabsTrigger value="area" className="flex items-center gap-2">
                  <Square className="h-4 w-4" />
                  Area (sq ft)
                </TabsTrigger>
                <TabsTrigger value="linear" className="flex items-center gap-2">
                  <Ruler className="h-4 w-4" />
                  Length (ft)
                </TabsTrigger>
              </TabsList>

              <TabsContent value={measurementType} className="mt-6 space-y-6">
                {/* Option 1: Map Drawing */}
                <div className="space-y-4">
                  <div className="flex items-start gap-3 p-4 bg-muted/50 rounded-lg border">
                    <MapPin className="h-5 w-5 text-primary mt-0.5 flex-shrink-0" />
                    <div>
                      <p className="text-sm font-medium mb-1">Option 1: Draw on Map</p>
                      <p className="text-xs text-muted-foreground">
                        {measurementType === 'area' 
                          ? 'Click points on the map to outline your area. Double-click to complete.'
                          : 'Click points to trace the length. Double-click to finish.'
                        }
                      </p>
                    </div>
                  </div>

                  <div className="relative">
                    <div 
                      ref={mapContainerRef}
                      className="w-full h-[400px] rounded-lg border-2 overflow-hidden shadow-md"
                    />
                    
                    {mapLoading && (
                      <div className="absolute inset-0 bg-background/95 backdrop-blur-sm flex items-center justify-center rounded-lg">
                        <div className="text-center">
                          <Loader2 className="h-10 w-10 animate-spin mx-auto mb-3 text-primary" />
                          <p className="text-sm font-medium">Loading map...</p>
                        </div>
                      </div>
                    )}
                    
                    {mapError && (
                      <div className="absolute inset-0 bg-background/95 backdrop-blur-sm flex items-center justify-center rounded-lg">
                        <div className="text-center p-6">
                          <MapPin className="h-10 w-10 text-destructive mx-auto mb-3" />
                          <p className="text-sm font-medium mb-2">Unable to Load Map</p>
                          <p className="text-xs text-muted-foreground mb-4">{mapError}</p>
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
                  </div>

                  {isDrawing && (
                    <div className="bg-primary/10 border border-primary/20 rounded-lg p-4 animate-fade-in">
                      <div className="flex items-center gap-2">
                        <Loader2 className="h-4 w-4 animate-spin text-primary" />
                        <p className="text-sm font-medium">Click on the map to draw...</p>
                      </div>
                    </div>
                  )}

                  {mapMeasurement && !isDrawing && (
                    <div className="bg-primary/10 border border-primary rounded-lg p-4 animate-scale-in">
                      <div className="flex items-center justify-between">
                        <div>
                          <p className="text-sm text-muted-foreground mb-1">Measured from map</p>
                          <p className="text-2xl font-bold text-primary">
                            {mapMeasurement.toLocaleString()} {unitAbbr}
                          </p>
                        </div>
                        <Button onClick={handleMapSubmit} size="lg">
                          Use This Measurement
                        </Button>
                      </div>
                    </div>
                  )}

                  <div className="flex gap-2">
                    {!isDrawing && !mapMeasurement && (
                      <Button 
                        onClick={startDrawing}
                        disabled={mapLoading || !!mapError}
                        className="flex-1"
                        size="lg"
                      >
                        <MapPin className="mr-2 h-4 w-4" />
                        Start Drawing
                      </Button>
                    )}
                    {(isDrawing || mapMeasurement) && (
                      <Button 
                        onClick={clearMapDrawing}
                        variant="outline"
                        className="flex-1"
                        size="lg"
                      >
                        Clear Drawing
                      </Button>
                    )}
                  </div>
                </div>

                {/* Divider */}
                <div className="relative">
                  <div className="absolute inset-0 flex items-center">
                    <div className="w-full border-t border-border" />
                  </div>
                  <div className="relative flex justify-center">
                    <span className="bg-background px-4 text-sm text-muted-foreground">OR</span>
                  </div>
                </div>

                {/* Option 2: Manual Entry */}
                <div className="space-y-4">
                  <div className="flex items-start gap-3 p-4 bg-muted/50 rounded-lg border">
                    <Edit3 className="h-5 w-5 text-primary mt-0.5 flex-shrink-0" />
                    <div>
                      <p className="text-sm font-medium mb-1">Option 2: Enter Manually</p>
                      <p className="text-xs text-muted-foreground">
                        If you already know the {measurementType === 'area' ? 'square footage' : 'linear feet'}
                      </p>
                    </div>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="manual-measurement">
                      {measurementType === 'area' ? 'Square Feet' : 'Linear Feet'}
                    </Label>
                    <div className="flex gap-2">
                      <Input
                        id="manual-measurement"
                        type="number"
                        placeholder={`Enter ${unitLabel}`}
                        value={manualValue}
                        onChange={(e) => setManualValue(e.target.value)}
                        onKeyPress={(e) => {
                          if (e.key === 'Enter') {
                            handleManualSubmit();
                          }
                        }}
                        className="flex-1"
                      />
                      <Button 
                        onClick={handleManualSubmit}
                        disabled={!manualValue || parseFloat(manualValue) <= 0}
                        size="lg"
                        className="px-8"
                      >
                        Submit
                      </Button>
                    </div>
                  </div>
                </div>
              </TabsContent>
            </Tabs>
          </CardContent>
        </Card>

        {/* Selected Measurement Display */}
        {canProceed && (
          <Card className="border-2 border-primary bg-primary/5 shadow-lg animate-fade-in">
            <CardContent className="p-6">
              <div className="flex flex-col md:flex-row items-center justify-between gap-4">
                <div className="flex items-center gap-4">
                  <div className="w-12 h-12 rounded-full bg-primary/20 flex items-center justify-center">
                    {measurementType === 'area' ? (
                      <Square className="h-6 w-6 text-primary" />
                    ) : (
                      <Ruler className="h-6 w-6 text-primary" />
                    )}
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">Selected Measurement</p>
                    <p className="text-2xl font-bold">
                      {currentMeasurement?.value.toLocaleString()} {unitAbbr}
                    </p>
                  </div>
                </div>
                <Button 
                  size="lg" 
                  onClick={onNext}
                  className="w-full md:w-auto px-8"
                >
                  Continue to Next Step
                </Button>
              </div>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
};

export default MeasurementTools;