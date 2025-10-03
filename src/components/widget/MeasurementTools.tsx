/// <reference types="@types/google.maps" />
import { useState, useEffect, useRef } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Separator } from '@/components/ui/separator';
import { Loader2, Ruler, Square, MapPin, Search, Undo2, PencilRuler } from 'lucide-react';
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
  const [mapMeasurement, setMapMeasurement] = useState<number | null>(null);
  const [isDrawing, setIsDrawing] = useState(false);
  const [currentMeasurement, setCurrentMeasurement] = useState<MeasurementData | null>(null);
  const [mapError, setMapError] = useState<string | null>(null);
  const [mapLoading, setMapLoading] = useState(true);
  const [apiKey, setApiKey] = useState<string | null>(null);
  const [showManualEntry, setShowManualEntry] = useState(false);
  const [manualValue, setManualValue] = useState('');
  
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
    setMapMeasurement(null);
    setCurrentMeasurement(null);
    clearMapDrawing();
    
    // Auto start drawing when switching type
    if (drawingManagerRef.current && !showManualEntry) {
      setTimeout(() => startDrawing(), 100);
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
      
      // Auto-select measurement type based on product unit type
      const unitType = data.unit_type.toLowerCase();
      
      // Check for linear measurements first (linear_ft, linear, etc.)
      if (unitType.includes('linear')) {
        console.log('Auto-selecting LINEAR measurement for unit type:', data.unit_type);
        setMeasurementType('linear');
      }
      // Then check for area measurements (sq_ft, square, etc.)
      else if (unitType.includes('sq_') || unitType.includes('square') || unitType.includes('area')) {
        console.log('Auto-selecting AREA measurement for unit type:', data.unit_type);
        setMeasurementType('area');
      }
      // Default to area for other types
      else {
        console.log('Defaulting to AREA measurement for unit type:', data.unit_type);
        setMeasurementType('area');
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
        mapTypeControl: false,
        streetViewControl: false,
        fullscreenControl: false,
        zoomControl: true,
        zoomControlOptions: {
          position: google.maps.ControlPosition.RIGHT_CENTER
        }
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
        fillColor: '#10B981',
        fillOpacity: 0.3,
        strokeColor: '#10B981',
        strokeWeight: 3,
        clickable: true,
        editable: true,
        zIndex: 1,
      },
      polylineOptions: {
        strokeColor: '#10B981',
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
        
        const updateMeasurement = () => {
          const newArea = google.maps.geometry.spherical.computeArea(path);
          const newSqFt = Math.ceil(newArea * 10.764);
          setMapMeasurement(newSqFt);
        };
        
        google.maps.event.addListener(path, 'set_at', updateMeasurement);
        google.maps.event.addListener(path, 'insert_at', updateMeasurement);
        
      } else if (event.type === google.maps.drawing.OverlayType.POLYLINE) {
        const polyline = event.overlay as google.maps.Polyline;
        const path = polyline.getPath();
        const length = google.maps.geometry.spherical.computeLength(path);
        const feet = Math.ceil(length * 3.28084);
        setMapMeasurement(feet);
        
        const updateMeasurement = () => {
          const newLength = google.maps.geometry.spherical.computeLength(path);
          const newFeet = Math.ceil(newLength * 3.28084);
          setMapMeasurement(newFeet);
        };
        
        google.maps.event.addListener(path, 'set_at', updateMeasurement);
        google.maps.event.addListener(path, 'insert_at', updateMeasurement);
      }
    });
  };

  const startDrawing = () => {
    if (!drawingManagerRef.current) return;

    setIsDrawing(true);
    setShowManualEntry(false);
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
    <div className="flex flex-col h-screen w-full">
      {/* Header with Search and Title */}
      <div className="bg-background border-b px-6 py-4 z-20">
        <div className="flex items-center justify-between gap-4 max-w-7xl mx-auto">
          <h2 className="text-2xl font-semibold text-foreground whitespace-nowrap">
            Measure Your Project
          </h2>
          <div className="flex items-center gap-2 flex-1 max-w-md">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="4800 dry oak trl"
                className="pl-10"
              />
            </div>
            <Button className="px-6">
              Search
            </Button>
          </div>
        </div>
      </div>

      {/* Full-width Map */}
      <div className="relative flex-1 w-full">
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

        {/* Map/Satellite Toggle - Top Right */}
        {!mapLoading && !mapError && (
          <div className="absolute top-4 right-4 z-10 bg-background rounded-lg shadow-lg border overflow-hidden">
            <div className="flex">
              <Button
                variant="ghost"
                className={`rounded-none px-6 h-10 ${
                  mapRef.current?.getMapTypeId() === 'roadmap' || mapRef.current?.getMapTypeId() === 'terrain'
                    ? 'bg-background font-semibold' 
                    : 'bg-muted text-muted-foreground'
                }`}
                onClick={() => mapRef.current?.setMapTypeId('roadmap')}
              >
                Map
              </Button>
              <Separator orientation="vertical" className="h-10" />
              <Button
                variant="ghost"
                className={`rounded-none px-6 h-10 ${
                  mapRef.current?.getMapTypeId() === 'hybrid' || mapRef.current?.getMapTypeId() === 'satellite'
                    ? 'bg-background font-semibold' 
                    : 'bg-muted text-muted-foreground'
                }`}
                onClick={() => mapRef.current?.setMapTypeId('hybrid')}
              >
                Satellite
              </Button>
            </div>
          </div>
        )}

        {/* Bottom Control Bar */}
        {!mapLoading && !mapError && (
          <div className="absolute bottom-6 left-1/2 -translate-x-1/2 z-10">
            <div className="bg-background rounded-lg shadow-lg border px-2 py-2 flex items-center gap-1">
              <Button
                variant="ghost"
                size="lg"
                onClick={() => {
                  setMeasurementType('linear');
                  setShowManualEntry(false);
                }}
                className={`gap-2 ${
                  measurementType === 'linear' && !showManualEntry
                    ? 'text-foreground font-semibold' 
                    : 'text-muted-foreground'
                }`}
              >
                <Ruler className="h-4 w-4" />
                Line
              </Button>
              
              <Button
                variant="ghost"
                size="lg"
                onClick={() => {
                  setMeasurementType('area');
                  setShowManualEntry(false);
                }}
                className={`gap-2 ${
                  measurementType === 'area' && !showManualEntry
                    ? 'text-foreground font-semibold' 
                    : 'text-muted-foreground'
                }`}
              >
                <Square className="h-4 w-4" />
                Area
              </Button>

              <Separator orientation="vertical" className="h-8 mx-1" />

              <Button
                variant="ghost"
                size="lg"
                onClick={clearMapDrawing}
                disabled={!mapMeasurement && !isDrawing}
                className="gap-2"
              >
                <Undo2 className="h-4 w-4" />
                Undo
              </Button>

              <Separator orientation="vertical" className="h-8 mx-1" />

              <Button
                variant="ghost"
                size="lg"
                onClick={() => {
                  setShowManualEntry(true);
                  clearMapDrawing();
                }}
                className="gap-2 text-orange-600 hover:text-orange-700"
              >
                <PencilRuler className="h-4 w-4" />
                Enter Manually
              </Button>
            </div>
          </div>
        )}

        {/* Manual Entry Modal */}
        {showManualEntry && (
          <div className="absolute inset-0 bg-background/80 backdrop-blur-sm flex items-center justify-center z-30">
            <div className="bg-background border-2 rounded-lg shadow-2xl p-6 max-w-md w-full mx-4">
              <h3 className="text-lg font-semibold mb-4">Enter Measurement</h3>
              <div className="flex gap-2 mb-4">
                <Input
                  type="number"
                  placeholder={`Enter ${unitLabel}`}
                  value={manualValue}
                  onChange={(e) => setManualValue(e.target.value)}
                  min="0"
                  step="0.01"
                  className="flex-1"
                  autoFocus
                />
                <span className="flex items-center text-sm text-muted-foreground">{unitAbbr}</span>
              </div>
              <div className="flex gap-2">
                <Button 
                  variant="outline"
                  onClick={() => {
                    setShowManualEntry(false);
                    setManualValue('');
                  }}
                  className="flex-1"
                >
                  Cancel
                </Button>
                <Button 
                  onClick={handleManualSubmit}
                  disabled={!manualValue || parseFloat(manualValue) <= 0}
                  className="flex-1"
                >
                  Submit
                </Button>
              </div>
            </div>
          </div>
        )}

        {/* Measurement Display */}
        {mapMeasurement && !isDrawing && !showManualEntry && (
          <div className="absolute bottom-24 left-1/2 -translate-x-1/2 z-10 bg-primary/10 border-2 border-primary rounded-lg px-6 py-4 shadow-lg">
            <div className="flex items-center gap-4">
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

        {/* Continue Button */}
        {currentMeasurement && (
          <div className="absolute bottom-24 left-1/2 -translate-x-1/2 z-10">
            <Button onClick={onNext} size="lg" className="px-8">
              Continue with {currentMeasurement.value.toLocaleString()} {unitAbbr}
            </Button>
          </div>
        )}
      </div>
    </div>
  );
};

export default MeasurementTools;
