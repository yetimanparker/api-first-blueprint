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
    <div className="max-w-5xl mx-auto space-y-6">
      {/* Header Section */}
      <div className="text-center space-y-3 px-4">
        <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-primary/10 mb-2">
          {measurementType === 'area' ? (
            <Square className="h-8 w-8 text-primary" />
          ) : (
            <Ruler className="h-8 w-8 text-primary" />
          )}
        </div>
        <h2 className="text-3xl font-bold tracking-tight">Measure Your Project</h2>
        {product && (
          <p className="text-lg text-muted-foreground">
            For: <span className="font-semibold text-foreground">{product.name}</span>
          </p>
        )}
      </div>

      {/* Measurement Type Selector */}
      <Card className="border-2">
        <CardContent className="pt-6">
          <div className="text-center mb-4">
            <p className="text-sm font-medium text-muted-foreground">Choose measurement type</p>
          </div>
          <Tabs value={measurementType} onValueChange={(value) => setMeasurementType(value as 'area' | 'linear')}>
            <TabsList className="grid w-full grid-cols-2 h-14">
              <TabsTrigger value="area" className="flex items-center gap-2 text-base">
                <Square className="h-5 w-5" />
                <span>Area <span className="text-muted-foreground">({unitAbbr})</span></span>
              </TabsTrigger>
              <TabsTrigger value="linear" className="flex items-center gap-2 text-base">
                <Ruler className="h-5 w-5" />
                <span>Length <span className="text-muted-foreground">(ft)</span></span>
              </TabsTrigger>
            </TabsList>
          </Tabs>
        </CardContent>
      </Card>

      {/* Instructions Card */}
      <Card className="bg-muted/50 border-dashed">
        <CardContent className="pt-6">
          <div className="flex items-start gap-3">
            <div className="flex-shrink-0 w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center">
              <span className="text-primary font-bold">1</span>
            </div>
            <div className="flex-1">
              <p className="text-sm font-medium mb-1">Draw on the map or enter manually</p>
              <p className="text-xs text-muted-foreground">
                {measurementType === 'area' 
                  ? 'Click points on the map to outline your area, or type the square footage if you already know it.'
                  : 'Click points on the map to measure distance, or enter the linear feet directly.'
                }
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      <div className="grid md:grid-cols-2 gap-6">
        {/* Map Measurement */}
        <Card className="border-2 hover:border-primary/50 transition-colors">
          <CardHeader className="pb-4">
            <CardTitle className="text-xl flex items-center gap-2">
              <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center">
                <MapPin className="h-5 w-5 text-primary" />
              </div>
              <span>Draw on Map</span>
            </CardTitle>
            <p className="text-sm text-muted-foreground">Use satellite imagery for precision</p>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="relative">
              <div 
                ref={mapContainerRef}
                className="w-full h-80 bg-muted rounded-lg border-2 overflow-hidden shadow-inner"
              />
              
              {/* Map Loading Overlay */}
              {mapLoading && (
                <div className="absolute inset-0 bg-background/95 backdrop-blur-sm flex items-center justify-center rounded-lg">
                  <div className="text-center">
                    <Loader2 className="h-10 w-10 animate-spin mx-auto mb-3 text-primary" />
                    <p className="text-sm font-medium">Loading Google Maps...</p>
                    <p className="text-xs text-muted-foreground mt-1">This may take a moment</p>
                  </div>
                </div>
              )}
              
              {/* Map Error State */}
              {mapError && (
                <div className="absolute inset-0 bg-background/95 backdrop-blur-sm flex items-center justify-center rounded-lg">
                  <div className="text-center p-6 max-w-xs">
                    <div className="w-12 h-12 rounded-full bg-destructive/10 flex items-center justify-center mx-auto mb-3">
                      <MapPin className="h-6 w-6 text-destructive" />
                    </div>
                    <p className="text-sm font-semibold mb-2">Unable to Load Map</p>
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
            
            {/* Drawing Instructions Banner */}
            {isDrawing && (
              <div className="bg-primary/10 border border-primary/20 rounded-lg p-4 animate-fade-in">
                <div className="flex items-center gap-2 mb-2">
                  <Loader2 className="h-4 w-4 animate-spin text-primary" />
                  <p className="text-sm font-semibold text-primary">Drawing Mode Active</p>
                </div>
                <p className="text-xs text-muted-foreground">
                  {measurementType === 'area' 
                    ? 'Click to add points. Double-click or click the first point to complete the shape.'
                    : 'Click to add points along the line. Double-click to finish.'
                  }
                </p>
              </div>
            )}

            {/* Measurement Result */}
            {mapMeasurement && !isDrawing && (
              <div className="bg-primary/10 border border-primary rounded-lg p-4 animate-scale-in">
                <div className="flex items-center justify-between mb-3">
                  <div>
                    <p className="text-xs text-muted-foreground mb-1">Measured from map</p>
                    <p className="text-2xl font-bold text-primary">
                      {mapMeasurement.toLocaleString()} <span className="text-lg">{unitAbbr}</span>
                    </p>
                  </div>
                  <div className="w-12 h-12 rounded-full bg-primary flex items-center justify-center">
                    <MapPin className="h-6 w-6 text-primary-foreground" />
                  </div>
                </div>
                <Button onClick={handleMapSubmit} className="w-full" size="lg">
                  Use This Measurement
                </Button>
              </div>
            )}
            
            {/* Drawing Controls */}
            <div className="flex gap-2">
              <Button
                onClick={startDrawing}
                disabled={isDrawing || !!mapError || mapLoading}
                variant={mapMeasurement ? "outline" : "default"}
                className="flex-1"
                size="lg"
              >
                {isDrawing ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin mr-2" />
                    Drawing...
                  </>
                ) : (
                  <>
                    <Edit3 className="h-4 w-4 mr-2" />
                    {mapMeasurement ? 'Redraw' : (measurementType === 'area' ? 'Draw Area' : 'Draw Line')}
                  </>
                )}
              </Button>
              
              {(mapMeasurement || isDrawing) && (
                <Button
                  onClick={clearMapDrawing}
                  variant="outline"
                  disabled={!!mapError}
                  size="lg"
                >
                  Clear
                </Button>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Manual Entry */}
        <Card className="border-2 hover:border-primary/50 transition-colors">
          <CardHeader className="pb-4">
            <CardTitle className="text-xl flex items-center gap-2">
              <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center">
                <Edit3 className="h-5 w-5 text-primary" />
              </div>
              <span>Enter Manually</span>
            </CardTitle>
            <p className="text-sm text-muted-foreground">Already know the measurement?</p>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-3">
              <Label htmlFor="manual-measurement" className="text-base">
                {measurementType === 'area' ? 'Square Feet' : 'Linear Feet'}
              </Label>
              <div className="relative">
                <Input
                  id="manual-measurement"
                  type="number"
                  min="0"
                  step="0.1"
                  value={manualValue}
                  onChange={(e) => setManualValue(e.target.value)}
                  placeholder={`Enter ${unitLabel}`}
                  className="text-lg h-14 pr-16"
                />
                <span className="absolute right-4 top-1/2 -translate-y-1/2 text-sm text-muted-foreground font-medium">
                  {unitAbbr}
                </span>
              </div>
            </div>

            {manualValue && parseFloat(manualValue) > 0 && (
              <div className="bg-primary/10 border border-primary rounded-lg p-4 animate-scale-in">
                <div className="flex items-center justify-between mb-3">
                  <div>
                    <p className="text-xs text-muted-foreground mb-1">Manual entry</p>
                    <p className="text-2xl font-bold text-primary">
                      {parseFloat(manualValue).toLocaleString()} <span className="text-lg">{unitAbbr}</span>
                    </p>
                  </div>
                  <div className="w-12 h-12 rounded-full bg-primary flex items-center justify-center">
                    <Edit3 className="h-6 w-6 text-primary-foreground" />
                  </div>
                </div>
                <Button 
                  onClick={handleManualSubmit}
                  className="w-full"
                  size="lg"
                >
                  Use This Measurement
                </Button>
              </div>
            )}

            {/* Example Helper */}
            <div className="bg-muted/50 rounded-lg p-4 border border-dashed">
              <p className="text-xs font-medium text-muted-foreground mb-2">💡 Tip</p>
              <p className="text-xs text-muted-foreground">
                {measurementType === 'area' 
                  ? 'For a rectangular area: multiply length × width. Example: 50 ft × 30 ft = 1,500 sq ft'
                  : 'Measure along the edge or perimeter where the work will be done.'
                }
              </p>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Current Selection Display */}
      {currentMeasurement && (
        <Card className="border-2 border-primary bg-gradient-to-br from-primary/5 to-primary/10 animate-fade-in">
          <CardContent className="pt-6">
            <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
              <div className="flex items-center gap-4">
                <div className="w-16 h-16 rounded-full bg-primary flex items-center justify-center flex-shrink-0">
                  {currentMeasurement.manualEntry ? (
                    <Edit3 className="h-8 w-8 text-primary-foreground" />
                  ) : (
                    <MapPin className="h-8 w-8 text-primary-foreground" />
                  )}
                </div>
                <div>
                  <p className="text-sm font-medium text-muted-foreground mb-1">
                    ✓ Measurement Selected
                  </p>
                  <p className="text-3xl font-bold text-foreground">
                    {currentMeasurement.value.toLocaleString()}{' '}
                    <span className="text-xl text-muted-foreground">
                      {currentMeasurement.unit.replace('_', ' ')}
                    </span>
                  </p>
                  <p className="text-xs text-muted-foreground mt-1">
                    {currentMeasurement.manualEntry ? 'From manual entry' : 'From map drawing'}
                  </p>
                </div>
              </div>
              <Button onClick={onNext} size="lg" className="w-full sm:w-auto px-8">
                Continue to Next Step
              </Button>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
};

export default MeasurementTools;