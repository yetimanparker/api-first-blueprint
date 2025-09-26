import { useState, useEffect, useRef } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Loader2, Ruler, Square, MapPin, Edit3 } from 'lucide-react';
import { MeasurementData } from '@/types/widget';
import { supabase } from '@/integrations/supabase/client';

// Import Leaflet after component mounts to avoid SSR issues
import 'leaflet/dist/leaflet.css';

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
  
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<any>(null);
  const drawingRef = useRef<any>(null);

  useEffect(() => {
    fetchProduct();
    initializeMap();
    return () => {
      if (mapRef.current) {
        mapRef.current.remove();
      }
    };
  }, []);

  useEffect(() => {
    // Reset measurements when measurement type changes
    setManualValue('');
    setMapMeasurement(null);
    setCurrentMeasurement(null);
    clearMapDrawing();
  }, [measurementType]);

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
    if (!mapContainerRef.current) return;

    try {
      // Dynamic import to avoid SSR issues
      const L = (await import('leaflet')).default;
      
      // Fix for default markers
      delete (L.Icon.Default.prototype as any)._getIconUrl;
      L.Icon.Default.mergeOptions({
        iconRetinaUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon-2x.png',
        iconUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon.png',
        shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-shadow.png',
      });

      // Initialize map
      const map = L.map(mapContainerRef.current).setView([39.8283, -98.5795], 4);
      
      // Add Google Satellite layer
      const googleSat = L.tileLayer('https://mt1.google.com/vt/lyrs=s&x={x}&y={y}&z={z}', {
        attribution: '© Google',
        maxZoom: 20,
      });
      googleSat.addTo(map);

      mapRef.current = map;

      // Try to geocode customer address if provided
      if (customerAddress) {
        geocodeAndCenterMap(customerAddress);
      }

    } catch (error) {
      console.error('Error initializing map:', error);
    }
  };

  const geocodeAndCenterMap = async (address: string) => {
    try {
      // Use the existing Google Places integration through edge function
      const { data, error } = await supabase.functions.invoke('google-places-autocomplete', {
        body: {
          input: address,
          sessionToken: Date.now().toString()
        }
      });

      if (!error && data?.predictions?.[0]) {
        const placeId = data.predictions[0].place_id;
        
        // Get place details
        const { data: details } = await supabase.functions.invoke('google-places-autocomplete/details', {
          body: {
            placeId: placeId,
            sessionToken: Date.now().toString()
          }
        });

        if (details?.geometry?.location) {
          const { lat, lng } = details.geometry.location;
          mapRef.current?.setView([lat, lng], 18);
        }
      }
    } catch (error) {
      console.error('Error geocoding address:', error);
    }
  };

  const startDrawing = async () => {
    if (!mapRef.current) return;

    setIsDrawing(true);
    clearMapDrawing();

    try {
      // Dynamic import for Leaflet.draw
      const L = (await import('leaflet')).default;
      
      // Simple drawing implementation without leaflet-draw dependency
      let isDrawingActive = true;
      let points: L.LatLng[] = [];
      let tempMarkers: L.Marker[] = [];
      let currentShape: L.Polygon | L.Polyline | null = null;

      const handleMapClick = (e: L.LeafletMouseEvent) => {
        if (!isDrawingActive) return;

        points.push(e.latlng);
        
        // Add temporary marker
        const marker = L.marker(e.latlng).addTo(mapRef.current);
        tempMarkers.push(marker);

        if (measurementType === 'area' && points.length >= 3) {
          // Create/update polygon
          if (currentShape) currentShape.remove();
          currentShape = L.polygon(points, { color: 'red', fillColor: 'red', fillOpacity: 0.2 }).addTo(mapRef.current);
          
          // Calculate area in square feet
          const area = calculatePolygonArea(points);
          const sqFt = Math.ceil(area * 10.764); // Convert m² to ft² and round up
          setMapMeasurement(sqFt);
          
        } else if (measurementType === 'linear' && points.length >= 2) {
          // Create/update polyline
          if (currentShape) currentShape.remove();
          currentShape = L.polyline(points, { color: 'blue', weight: 3 }).addTo(mapRef.current);
          
          // Calculate total distance in feet
          let totalDistance = 0;
          for (let i = 1; i < points.length; i++) {
            totalDistance += points[i-1].distanceTo(points[i]);
          }
          const feet = Math.ceil(totalDistance * 3.28084); // Convert meters to feet and round up
          setMapMeasurement(feet);
        }
      };

      const handleDoubleClick = () => {
        isDrawingActive = false;
        setIsDrawing(false);
        mapRef.current.off('click', handleMapClick);
        mapRef.current.off('dblclick', handleDoubleClick);
        
        // Clean up temporary markers
        tempMarkers.forEach(marker => marker.remove());
      };

      mapRef.current.on('click', handleMapClick);
      mapRef.current.on('dblclick', handleDoubleClick);
      
      drawingRef.current = {
        stop: () => {
          isDrawingActive = false;
          mapRef.current?.off('click', handleMapClick);
          mapRef.current?.off('dblclick', handleDoubleClick);
          tempMarkers.forEach(marker => marker.remove());
          setIsDrawing(false);
        },
        shape: currentShape
      };

    } catch (error) {
      console.error('Error starting drawing:', error);
      setIsDrawing(false);
    }
  };

  // Simple polygon area calculation (approximate)
  const calculatePolygonArea = (points: any[]) => {
    if (points.length < 3) return 0;
    
    let area = 0;
    for (let i = 0; i < points.length; i++) {
      const j = (i + 1) % points.length;
      area += points[i].lat * points[j].lng;
      area -= points[j].lat * points[i].lng;
    }
    return Math.abs(area * 111319.5 * 111319.5 / 2); // Approximate conversion to m²
  };

  const clearMapDrawing = () => {
    if (drawingRef.current) {
      drawingRef.current.stop();
      if (drawingRef.current.shape) {
        drawingRef.current.shape.remove();
      }
      drawingRef.current = null;
    }
    setMapMeasurement(null);
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
            <div 
              ref={mapContainerRef}
              className="w-full h-64 sm:h-80 bg-muted rounded-lg"
              style={{ minHeight: '320px' }}
            />
            
            <div className="flex flex-col sm:flex-row gap-2">
              <Button
                onClick={startDrawing}
                disabled={isDrawing}
                variant="outline"
                className="flex-1"
              >
                {isDrawing ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin mr-2" />
                    Click to draw, double-click to finish
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
                disabled={!mapMeasurement && !isDrawing}
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
                  ? 'Click points to create a shape. Double-click to finish.'
                  : 'Click points to draw a line. Double-click to finish.'
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
                  Use Manual Entry
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Current Measurement Display */}
        {currentMeasurement && (
          <Card className="bg-primary/5 border-primary/20">
            <CardContent className="flex items-center justify-between p-4">
              <div>
                <p className="text-sm font-medium">Selected Measurement:</p>
                <p className="text-lg font-bold text-primary">
                  {currentMeasurement.value.toLocaleString()} {currentMeasurement.unit.replace('_', ' ')}
                </p>
                {currentMeasurement.manualEntry && (
                  <p className="text-xs text-muted-foreground">Manual entry</p>
                )}
              </div>
              <Button onClick={onNext}>
                Continue to Configuration
              </Button>
            </CardContent>
          </Card>
        )}

        {!canProceed && (
          <div className="text-center text-muted-foreground text-sm">
            Please measure your project using the map tool or manual entry to continue.
          </div>
        )}
      </CardContent>
    </Card>
  );
};

export default MeasurementTools;