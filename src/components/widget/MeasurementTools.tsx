/// <reference types="@types/google.maps" />
import { useState, useEffect, useRef } from 'react';
import { Button } from '@/components/ui/button';
import { AddressAutocomplete } from '@/components/ui/address-autocomplete';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import type { ParsedAddress } from '@/hooks/useGooglePlaces';
import { Separator } from '@/components/ui/separator';
import { Loader2, Ruler, Square, MapPin, Undo2, PencilRuler, ArrowLeft } from 'lucide-react';
import { MeasurementData } from '@/types/widget';
import { supabase } from '@/integrations/supabase/client';
import { loadGoogleMapsAPI } from '@/lib/googleMapsLoader';
import { getZoomBasedFontSize, getZoomBasedMarkerScale, renderDimensionalProductLabels, renderEdgeMeasurements } from '@/lib/mapLabelUtils';
import { calculateRotatedRectangle } from '@/components/widget/DimensionalPlacement';

interface MeasurementToolsProps {
  productId: string;
  contractorId: string;
  onMeasurementComplete: (measurement: MeasurementData) => void;
  onNext: () => void;
  customerAddress?: string;
  selectedProduct?: {
    id: string;
    name: string;
    description?: string;
    unit_type: string;
    unit_price: number;
  } | null;
  onChangeProduct?: () => void;
  isConfigurationMode?: boolean;
  currentStep?: string;
  existingQuoteItems?: Array<{
    id: string;
    productName: string;
    customName?: string;
    measurement: MeasurementData;
  }>;
  onAddressSelect?: (address: ParsedAddress) => void;
  onResetToMeasurement?: () => void;
  isManualEntry?: boolean;
  onFinalizeMeasurement?: () => void;
}

interface Product {
  id: string;
  name: string;
  unit_type: string;
  has_fixed_dimensions?: boolean;
  default_width?: number;
  default_length?: number;
  dimension_unit?: string;
  allow_dimension_editing?: boolean;
}

const MeasurementTools = ({ 
  productId,
  contractorId, 
  onMeasurementComplete, 
  onNext,
  customerAddress,
  selectedProduct,
  onChangeProduct,
  isConfigurationMode = false,
  currentStep,
  existingQuoteItems = [],
  onAddressSelect,
  onResetToMeasurement,
  isManualEntry = false,
  onFinalizeMeasurement
}: MeasurementToolsProps) => {
  const [product, setProduct] = useState<Product | null>(null);
  const [loading, setLoading] = useState(true);
  const [measurementType, setMeasurementType] = useState<'area' | 'linear' | 'point' | 'dimensional'>('area');
  const [mapMeasurement, setMapMeasurement] = useState<number | null>(null);
  const [isDrawing, setIsDrawing] = useState(false);
  const [currentMeasurement, setCurrentMeasurement] = useState<MeasurementData | null>(null);
  const [mapError, setMapError] = useState<string | null>(null);
  const [mapLoading, setMapLoading] = useState(true);
  const [apiKey, setApiKey] = useState<string | null>(null);
  const [showManualEntry, setShowManualEntry] = useState(false);
  const [manualValue, setManualValue] = useState('');
  const [searchAddress, setSearchAddress] = useState(customerAddress || '');
  const [pointLocations, setPointLocations] = useState<Array<{lat: number, lng: number}>>([]);
  const [pointMarkers, setPointMarkers] = useState<google.maps.Marker[]>([]);
  const [currentZoom, setCurrentZoom] = useState(19);
  const [debouncedZoom, setDebouncedZoom] = useState(19);
  
  // Dimensional product states
  const [dimensionalRotation, setDimensionalRotation] = useState(0);
  const [dimensionalCenter, setDimensionalCenter] = useState<{lat: number, lng: number} | null>(null);
  const [rotationHandle, setRotationHandle] = useState<google.maps.Marker | null>(null);
  const [dragHandle, setDragHandle] = useState<google.maps.Marker | null>(null);
  const [isDimensionalPlaced, setIsDimensionalPlaced] = useState(false);
  const [assignedMeasurementColor, setAssignedMeasurementColor] = useState<string | null>(null);
  
  // Real-time measurement tracking
  const [tempMeasurementValue, setTempMeasurementValue] = useState<string>('');
  const [tempMeasurementOverlay, setTempMeasurementOverlay] = useState<google.maps.Marker | null>(null);
  const [isDrawingInProgress, setIsDrawingInProgress] = useState(false);
  
  const mapContainerRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<google.maps.Map | null>(null);
  const initializationAttemptedRef = useRef(false);
  const drawingManagerRef = useRef<google.maps.drawing.DrawingManager | null>(null);
  const currentShapeRef = useRef<google.maps.Polygon | google.maps.Polyline | null>(null);
  const measurementLabelRef = useRef<google.maps.Marker | null>(null);
  const headerRef = useRef<HTMLDivElement>(null);
  const previousShapesRef = useRef<Array<google.maps.Polygon | google.maps.Polyline>>([]);
  const previousLabelsRef = useRef<Array<google.maps.Marker>>([]);
  const measurementTypeRef = useRef<'area' | 'linear' | 'point' | 'dimensional'>('area');
  const isDrawingRef = useRef(false);
  const pointCountRef = useRef(0); // Track point count for reliable sequential numbering
  const isRenderingRef = useRef(false); // Guard against concurrent renders
  const currentPathRef = useRef<google.maps.LatLng[]>([]);
  const mouseMoveListenerRef = useRef<google.maps.MapsEventListener | null>(null);
  const clickListenerRef = useRef<google.maps.MapsEventListener | null>(null);
  const segmentLabelsRef = useRef<google.maps.Marker[]>([]); // Track individual segment distance labels
  const currentEdgeLabelsRef = useRef<google.maps.Marker[]>([]); // Track edge measurements for current shape
  
  // Color palette for different measurements on the map
  const MAP_COLORS = [
    '#3B82F6', // blue
    '#F59E0B', // amber
    '#8B5CF6', // purple
    '#EC4899', // pink
    '#14B8A6', // teal
    '#F97316', // orange
  ];
  
  // Ref to track rotation handle position for accurate updates
  const rotationHandlePositionRef = useRef<google.maps.LatLng | null>(null);
  // Refs to capture final dimensional values synchronously (bypasses async state)
  const finalDimensionalCenterRef = useRef<{lat: number, lng: number} | null>(null);
  const finalDimensionalRotationRef = useRef<number>(0);
  const dimensionalSideLabelsRef = useRef<google.maps.Marker[]>([]);
  
  // Store map state in sessionStorage to persist across component unmounts
  const STORAGE_KEY = `map-state-${customerAddress || 'default'}`;

  useEffect(() => {
    fetchProduct();
    fetchApiKey();
    
    // Scroll to center the map view after a brief delay
    setTimeout(() => {
      if (headerRef.current) {
        headerRef.current.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }
    }, 300);
  }, []);

  // Save map state to sessionStorage whenever it changes
  useEffect(() => {
    if (mapRef.current) {
      const saveMapState = () => {
        const center = mapRef.current?.getCenter();
        const zoom = mapRef.current?.getZoom();
        if (center && zoom) {
          const state = {
            center: { lat: center.lat(), lng: center.lng() },
            zoom: zoom
          };
          sessionStorage.setItem(STORAGE_KEY, JSON.stringify(state));
          console.log('💾 Saved map state:', state);
        }
      };
      
      const zoomListener = mapRef.current.addListener('zoom_changed', saveMapState);
      const centerListener = mapRef.current.addListener('center_changed', saveMapState);
      
      return () => {
        google.maps.event.removeListener(zoomListener);
        google.maps.event.removeListener(centerListener);
      };
    }
  }, [mapRef.current]);

  // Update marker scales when zoom changes
  useEffect(() => {
    if (currentZoom && pointMarkers.length > 0) {
      const newScale = getZoomBasedMarkerScale(currentZoom);
      pointMarkers.forEach(marker => {
        const currentIcon = marker.getIcon() as google.maps.Symbol;
        if (currentIcon && typeof currentIcon === 'object') {
          marker.setIcon({
            ...currentIcon,
            scale: newScale
          });
        }
      });
    }
    
    // Update dimensional side labels font size when zoom changes
    if (currentZoom && dimensionalSideLabelsRef.current.length > 0) {
      const newFontSize = getZoomBasedFontSize(currentZoom);
      dimensionalSideLabelsRef.current.forEach(label => {
        const currentLabel = label.getLabel();
        if (currentLabel && typeof currentLabel !== 'string') {
          label.setLabel({
            ...currentLabel,
            fontSize: `${newFontSize}px`
          });
        }
      });
    }
  }, [currentZoom, pointMarkers]);

  // When productId changes, just refetch product without reinitializing map
  useEffect(() => {
    fetchProduct();
  }, [productId]);

  // Initialize map when container ref is available and we have an API key
  const initializeMapIfReady = async (container: HTMLDivElement) => {
    if (!apiKey || mapRef.current || initializationAttemptedRef.current) return;
    
    initializationAttemptedRef.current = true;
    
    try {
      console.log('Starting map initialization...');
      setMapLoading(true);
      setMapError(null);
      
      // Use shared loader to load Google Maps API
      console.log('Loading Google Maps API via shared loader...');
      await loadGoogleMapsAPI();
      console.log('Google Maps API loaded successfully');

      let center = { lat: 39.8283, lng: -98.5795 };
      let zoom = 4;

      // Try to restore saved map state first
      const savedState = sessionStorage.getItem(STORAGE_KEY);
      if (savedState) {
        try {
          const parsed = JSON.parse(savedState);
          center = parsed.center;
          zoom = parsed.zoom;
          console.log('📍 Restored map state from storage:', { center, zoom });
        } catch (e) {
          console.error('Failed to parse saved map state:', e);
        }
      } else if (customerAddress) {
        // Only geocode if no saved state
        console.log('Geocoding address:', customerAddress);
        const geocodedCenter = await geocodeAddress(customerAddress);
        if (geocodedCenter) {
          center = geocodedCenter;
          zoom = 21;
          console.log('Geocoded to:', center);
        }
      }

      console.log('Creating map instance with center:', center);
      const map = new google.maps.Map(container, {
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
        tilt: 0,
        rotateControl: false,
        gestureHandling: 'greedy',
        disableDefaultUI: true,
        styles: [
          {
            featureType: 'poi',
            elementType: 'labels',
            stylers: [{ visibility: 'off' }]
          },
          {
            featureType: 'poi.business',
            stylers: [{ visibility: 'off' }]
          },
          {
            featureType: 'transit',
            elementType: 'labels',
            stylers: [{ visibility: 'off' }]
          }
        ]
      });

      console.log('Map instance created successfully');
      mapRef.current = map;
      
      // Track zoom changes for dynamic font sizing
      map.addListener('zoom_changed', () => {
        const newZoom = map.getZoom();
        if (newZoom) {
          setCurrentZoom(newZoom);
        }
      });
      
      console.log('Setting up drawing manager');
      setupDrawingManager(map);
      
      console.log('Map initialization complete');
      setMapLoading(false);
      
      // Render existing measurements from quote items
      renderExistingMeasurements(map);
      
      // Auto-start drawing after a brief delay to ensure everything is ready
      // But NOT if this is a manual entry measurement (user chose manual input)
      console.log('Map initialized, preparing to auto-start drawing');
      setTimeout(() => {
        if (!showManualEntry && !isManualEntry) {
          startDrawing();
        } else {
          console.log('Skipping auto-start drawing: manual entry mode');
        }
      }, 500);
      
    } catch (error) {
      console.error('Map initialization failed:', error);
      console.error('Error stack:', error instanceof Error ? error.stack : 'No stack trace');
      setMapError(`Unable to load map: ${error instanceof Error ? error.message : 'Unknown error'}`);
      setMapLoading(false);
      initializationAttemptedRef.current = false; // Allow retry on error
    }
  };

  // Callback ref that initializes map when DOM element is ready
  const mapContainerCallbackRef = (node: HTMLDivElement | null) => {
    mapContainerRef.current = node;
    if (node && apiKey && !mapRef.current) {
      console.log('Map container ref callback triggered, initializing...');
      initializeMapIfReady(node);
    }
  };

  // Also try to initialize when apiKey becomes available (if container already exists)
  useEffect(() => {
    if (apiKey && mapContainerRef.current && !mapRef.current) {
      console.log('API key became available, initializing map...');
      initializeMapIfReady(mapContainerRef.current);
    }
  }, [apiKey]);

  // Auto-start drawing when map and drawing manager are ready
  // But NOT if this is a manual entry measurement
  useEffect(() => {
    if (mapRef.current && drawingManagerRef.current && !showManualEntry && !isManualEntry && !mapLoading) {
      console.log('Map ready, auto-starting drawing for type:', measurementType);
      setTimeout(() => startDrawing(), 300);
    } else if (isManualEntry) {
      console.log('Skipping auto-start drawing: manual entry mode');
    }
  }, [mapRef.current, drawingManagerRef.current, measurementType, showManualEntry, isManualEntry, mapLoading]);

  // Auto-scroll to buttons when measurement is complete
  useEffect(() => {
    if (currentMeasurement && !isConfigurationMode) {
      // Small delay to ensure DOM has updated
      setTimeout(() => {
        const buttonContainer = document.getElementById('measurement-action-buttons');
        if (buttonContainer) {
          buttonContainer.scrollIntoView({ 
            behavior: 'smooth', 
            block: 'nearest' 
          });
        }
      }, 300);
    }
  }, [currentMeasurement, isConfigurationMode]);

  useEffect(() => {
    // Update ref when measurement type changes
    measurementTypeRef.current = measurementType;
    
    // Reset measurements when measurement type changes
    setMapMeasurement(null);
    setCurrentMeasurement(null);
    clearMapDrawing();
    
    // Map state is now automatically preserved via listeners
  }, [measurementType]);

  // Update dimensional shape when rotation or center changes
  useEffect(() => {
    if (isDimensionalPlaced && dimensionalCenter && product?.default_width && product?.default_length) {
      // Update shape with new rotation/position
    }
  }, [dimensionalRotation, dimensionalCenter]);

  // Update isDrawing ref when state changes
  useEffect(() => {
    isDrawingRef.current = isDrawing;
  }, [isDrawing]);

  // Debounce zoom changes to prevent excessive re-renders
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedZoom(currentZoom);
    }, 150); // 150ms debounce
    
    return () => clearTimeout(timer);
  }, [currentZoom]);

  // Consolidated effect for re-rendering measurements (triggered by quote items or zoom changes)
  useEffect(() => {
    console.log('🗑️ Render trigger - Items:', existingQuoteItems.length, 'Zoom:', debouncedZoom);
    if (mapRef.current && existingQuoteItems.length > 0) {
      renderExistingMeasurements(mapRef.current);
    }
  }, [existingQuoteItems, debouncedZoom]);

  // Keyboard shortcuts
  useEffect(() => {
    const handleKeyPress = (event: KeyboardEvent) => {
      // Ignore if user is typing in an input field
      if (event.target instanceof HTMLInputElement || 
          event.target instanceof HTMLTextAreaElement) {
        return;
      }
      
      const key = event.key.toLowerCase();
      
      switch (key) {
        case 'escape':
          // Cancel current drawing
          if (isDrawing) {
            console.log('⌨️ Keyboard: Canceling drawing');
            handleUndo();
            event.preventDefault();
          }
          break;
          
        case 'backspace':
          // Remove last point (only for point measurement mode)
          if (measurementType === 'point' && pointMarkers.length > 0 && !currentMeasurement) {
            console.log('⌨️ Keyboard: Removing last point');
            removeLastPoint();
            event.preventDefault();
          }
          break;
          
        case 'm':
          // Toggle manual entry mode
          if (!isConfigurationMode) {
            console.log('⌨️ Keyboard: Toggling manual entry');
            setShowManualEntry(prev => !prev);
            if (!showManualEntry) {
              clearMapDrawing();
            }
            event.preventDefault();
          }
          break;
          
        case 'enter':
          // Finish point measurement
          if (measurementType === 'point' && pointLocations.length > 0 && isDrawing) {
            console.log('⌨️ Keyboard: Finishing point measurement');
            setIsDrawing(false);
            event.preventDefault();
          }
          break;
      }
    };
    
    // Add event listener
    window.addEventListener('keydown', handleKeyPress);
    
    // Cleanup
    return () => {
      window.removeEventListener('keydown', handleKeyPress);
    };
  }, [
    isConfigurationMode, 
    measurementType, 
    isDrawing, 
    currentMeasurement, 
    pointMarkers.length, 
    pointLocations.length,
    showManualEntry,
    product
  ]);

  // Disable/enable shape editing based on configuration mode
  useEffect(() => {
    if (currentShapeRef.current) {
      currentShapeRef.current.setEditable(!isConfigurationMode);
    }
    if (drawingManagerRef.current && isConfigurationMode) {
      drawingManagerRef.current.setDrawingMode(null);
      drawingManagerRef.current.setOptions({
        drawingControl: false
      });
    }
  }, [isConfigurationMode]);

  const fetchApiKey = async () => {
    try {
      // API key is now handled by the shared loader
      // Just set a placeholder to indicate it's ready
      setApiKey('shared-loader');
    } catch (error) {
      console.error('Error with shared loader:', error);
      setMapError('Unable to load map: API initialization failed');
      setMapLoading(false);
    }
  };

  const fetchProduct = async () => {
    try {
      // Use secure edge function to get product data
      const { data, error } = await supabase.functions.invoke('get-widget-products', {
        body: { contractor_id: contractorId }
      });

      if (error || !data?.success) {
        throw new Error('Failed to load product details');
      }
      
      const productData = data.products.find((p: any) => p.id === productId);
      if (!productData) {
        throw new Error('Product not found');
      }
      
      setProduct(productData);
      
      // Check if this is a dimensional product
      if (productData.has_fixed_dimensions && productData.default_width && productData.default_length) {
        console.log('This is a DIMENSIONAL product:', productData.name);
        setMeasurementType('dimensional');
        return;
      }
      
      // Auto-select measurement type based on product unit type
      const unitType = productData.unit_type.toLowerCase();
      
      // Check for 'each' type products first
      if (unitType === 'each') {
        console.log('Auto-selecting POINT measurement for unit type:', productData.unit_type);
        setMeasurementType('point');
      }
      // Check for linear measurements (linear_ft, linear, etc.)
      else if (unitType.includes('linear')) {
        console.log('Auto-selecting LINEAR measurement for unit type:', productData.unit_type);
        setMeasurementType('linear');
      }
      // Then check for area measurements (sq_ft, square, etc.)
      else if (unitType.includes('sq_') || unitType.includes('square') || unitType.includes('area')) {
        console.log('Auto-selecting AREA measurement for unit type:', productData.unit_type);
        setMeasurementType('area');
      }
      // For volume/cubic measurements, use area measurement (depth will be added in configuration)
      else if (unitType.includes('cubic') || unitType.includes('cu_') || unitType.includes('yard')) {
        console.log('Auto-selecting AREA measurement for volume-based unit type:', productData.unit_type);
        setMeasurementType('area');
      }
      // Default to area for other types
      else {
        console.log('Defaulting to AREA measurement for unit type:', productData.unit_type);
        setMeasurementType('area');
      }
    } catch (error) {
      console.error('Error fetching product:', error);
    } finally {
      setLoading(false);
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

  const calculateRealTimeMeasurement = (
    path: google.maps.LatLng[], 
    mousePosition: google.maps.LatLng
  ): { value: number; unit: string; position: google.maps.LatLng } => {
    if (measurementType === 'area') {
      // For polygon, create temp path including mouse position
      const tempPath = [...path, mousePosition];
      if (tempPath.length < 3) {
        return { value: 0, unit: 'sq ft', position: mousePosition };
      }
      
      // Calculate area with temporary closing point
      const area = google.maps.geometry.spherical.computeArea(tempPath);
      const sqFt = Math.ceil(area * 10.764);
      
      // Calculate centroid for label position
      let centerLat = 0, centerLng = 0;
      tempPath.forEach(point => {
        centerLat += point.lat();
        centerLng += point.lng();
      });
      const center = new google.maps.LatLng(
        centerLat / tempPath.length,
        centerLng / tempPath.length
      );
      
      return { value: sqFt, unit: 'sq ft', position: center };
    } else if (measurementType === 'linear') {
      // For polyline, calculate length to mouse position
      const tempPath = [...path, mousePosition];
      if (tempPath.length < 2) {
        return { value: 0, unit: 'ft', position: mousePosition };
      }
      
      const length = google.maps.geometry.spherical.computeLength(tempPath);
      const feet = Math.ceil(length * 3.28084);
      
      // Position at midpoint
      const midIndex = Math.floor(tempPath.length / 2);
      const position = tempPath[midIndex];
      
      return { value: feet, unit: 'ft', position };
    }
    
    return { value: 0, unit: '', position: mousePosition };
  };

  const updateTempMeasurementOverlay = (
    value: number,
    unit: string,
    position: google.maps.LatLng
  ) => {
    if (!mapRef.current) return;
    
    const displayText = value > 0 
      ? `Drawing: ${value.toLocaleString()} ${unit}` 
      : `Click to start ${measurementType === 'area' ? 'polygon' : 'line'}`;
    
    if (tempMeasurementOverlay) {
      // Update existing overlay
      tempMeasurementOverlay.setPosition(position);
      tempMeasurementOverlay.setLabel({
        text: displayText,
        color: '#1a1a1a',
        fontSize: '14px',
        fontWeight: 'bold',
      });
    } else {
      // Create new overlay
      const marker = new google.maps.Marker({
        position: position,
        map: mapRef.current,
        icon: {
          path: google.maps.SymbolPath.CIRCLE,
          scale: 8,
          fillColor: '#ffffff',
          fillOpacity: 0.9,
          strokeColor: '#3B82F6',
          strokeWeight: 2,
        },
        label: {
          text: displayText,
          color: '#1a1a1a',
          fontSize: '14px',
          fontWeight: 'bold',
        },
        zIndex: 9999,
      });
      setTempMeasurementOverlay(marker);
    }
  };

  const renderExistingMeasurements = async (map: google.maps.Map) => {
    // Prevent concurrent renders
    if (isRenderingRef.current) {
      console.log('⏸️ Render already in progress, skipping...');
      return;
    }
    
    isRenderingRef.current = true;
    console.log('🗺️ MeasurementTools - Rendering existing measurements. Items:', existingQuoteItems.length);
    
    // Clear any existing previous shapes and labels
    console.log('🧹 Clearing previous shapes:', previousShapesRef.current.length, 'labels:', previousLabelsRef.current.length);
    
    // Clear shapes
    previousShapesRef.current.forEach(shape => {
      try {
        shape.setMap(null);
      } catch (e) {
        console.warn('Failed to remove shape:', e);
      }
    });
    previousShapesRef.current = [];
    
    // Clear labels/markers
    previousLabelsRef.current.forEach(label => {
      try {
        label.setMap(null);
      } catch (e) {
        console.warn('Failed to remove label:', e);
      }
    });
    previousLabelsRef.current = [];
    
    // Add a small delay to ensure Google Maps API processes the removals
    await new Promise(resolve => setTimeout(resolve, 10));

    existingQuoteItems.forEach((item, index) => {
      console.log(`📍 Rendering item ${index} (${item.productName}):`, {
        type: item.measurement.type,
        hasCoordinates: !!item.measurement.coordinates,
        coordinatesLength: item.measurement.coordinates?.length || 0,
        hasPointLocations: !!item.measurement.pointLocations,
        pointLocationsLength: item.measurement.pointLocations?.length || 0,
        mapColor: item.measurement.mapColor
      });
      
      // Skip if no coordinates or point locations
      const hasCoordinates = item.measurement.coordinates && item.measurement.coordinates.length > 0;
      const hasPointLocations = item.measurement.type === 'point' && item.measurement.pointLocations && item.measurement.pointLocations.length > 0;
      
      if (!hasCoordinates && !hasPointLocations) {
        console.log('⚠️ Skipping item with no coordinates:', item.productName);
        return;
      }

      // Use the measurement's stored map color, or fall back to a default
      const color = item.measurement.mapColor || '#3B82F6';
      
      // Only convert coordinates if they exist (not for point measurements)
      const latLngs = hasCoordinates 
        ? item.measurement.coordinates!.map(coord => ({
            lat: coord[0],
            lng: coord[1]
          }))
        : [];

      if (item.measurement.type === 'area') {
        // Check if this is a dimensional product that should be rendered with rotation
        if (item.measurement.isDimensional && item.measurement.centerPoint && item.measurement.dimensions) {
          // Add debug logging
          console.log('🎨 Rendering dimensional product:', {
            center: item.measurement.centerPoint,
            rotation: item.measurement.rotation,
            dimensions: item.measurement.dimensions
          });
          
          // Reconstruct rotated rectangle from stored metadata
          const center = item.measurement.centerPoint;
          const rotation = item.measurement.rotation || 0;
          const { width, length } = item.measurement.dimensions;
          
          const rotatedCorners = calculateRotatedRectangle(
            center.lat, center.lng, width, length, rotation
          );
          
          const polygon = new google.maps.Polygon({
            paths: rotatedCorners,
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

          // Add label at center point (not bounds center)
          const marker = new google.maps.Marker({
            position: center,
            map: map,
            icon: {
              path: google.maps.SymbolPath.CIRCLE,
              scale: 0,
            },
            label: {
              text: `${(item.measurement.originalMeasurement || item.measurement.value).toLocaleString()} sq ft`,
              color: color,
              fontSize: `${getZoomBasedFontSize(currentZoom)}px`,
              fontWeight: 'bold',
            },
          });
          previousLabelsRef.current.push(marker);
          
          // Add side dimension labels using centralized helper function
          const labels = renderDimensionalProductLabels(
            map,
            rotatedCorners,
            width,
            length,
            color,
            currentZoom
          );
          previousLabelsRef.current.push(...labels);
        } else {
          // Regular area polygon (existing code)
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

          // Add label marker
          const bounds = new google.maps.LatLngBounds();
          latLngs.forEach(coord => bounds.extend(coord));
          const center = bounds.getCenter();

          const marker = new google.maps.Marker({
            position: center,
            map: map,
            icon: {
              path: google.maps.SymbolPath.CIRCLE,
              scale: 0,
            },
            label: {
              text: `${(item.measurement.originalMeasurement || item.measurement.value).toLocaleString()} sq ft`,
              color: color,
              fontSize: `${getZoomBasedFontSize(currentZoom)}px`,
              fontWeight: 'bold',
            },
          });
          previousLabelsRef.current.push(marker);
          
          // Add edge measurements for each side of the polygon
          const edgeLabels = renderEdgeMeasurements(
            map,
            latLngs,
            color,
            currentZoom,
            true  // closed shape (polygon)
          );
          previousLabelsRef.current.push(...edgeLabels);
          
          // Add side dimension labels for dimensional products
          if (item.measurement.isDimensional && item.measurement.dimensions) {
            const width = item.measurement.dimensions.width;
            const length = item.measurement.dimensions.length;
            
            // Calculate midpoints of top and right sides
            const topMid = {
              lat: (latLngs[0].lat + latLngs[1].lat) / 2,
              lng: (latLngs[0].lng + latLngs[1].lng) / 2
            };
            const rightMid = {
              lat: (latLngs[1].lat + latLngs[2].lat) / 2,
              lng: (latLngs[1].lng + latLngs[2].lng) / 2
            };
            
            // Width label (top side)
            const widthLabel = new google.maps.Marker({
              position: topMid,
              map: map,
              icon: {
                path: google.maps.SymbolPath.CIRCLE,
                scale: 0,
              },
              label: {
                text: `${width} ft`,
                color: color,
                fontSize: `${getZoomBasedFontSize(currentZoom)}px`,
                fontWeight: '600',
              },
              zIndex: 0
            });
            
            // Length label (right side)
            const lengthLabel = new google.maps.Marker({
              position: rightMid,
              map: map,
              icon: {
                path: google.maps.SymbolPath.CIRCLE,
                scale: 0,
              },
              label: {
                text: `${length} ft`,
                color: color,
                fontSize: `${getZoomBasedFontSize(currentZoom)}px`,
                fontWeight: '600',
              },
              zIndex: 0
            });
            
            previousLabelsRef.current.push(widthLabel, lengthLabel);
          }
        }
      } else if (item.measurement.type === 'linear') {
        const polyline = new google.maps.Polyline({
          path: latLngs,
          strokeColor: color,
          strokeWeight: 2,
          clickable: false,
          editable: false,
          zIndex: 0,
        });
        polyline.setMap(map);
        previousShapesRef.current.push(polyline);

        // Add label marker
        const midIndex = Math.floor(latLngs.length / 2);
        const center = latLngs[midIndex];

        const marker = new google.maps.Marker({
          position: center,
          map: map,
          icon: {
            path: google.maps.SymbolPath.CIRCLE,
            scale: 0,
          },
          label: {
            text: `${(item.measurement.originalMeasurement || item.measurement.value).toLocaleString()} ft`,
            color: color,
            fontSize: `${getZoomBasedFontSize(currentZoom)}px`,
            fontWeight: 'bold',
          },
        });
        previousLabelsRef.current.push(marker);
        
        // Only show edge measurements when there are multiple segments (more than 2 points)
        // For single segment (2 points), segment and total are identical, so skip redundant labels
        if (latLngs.length > 2) {
          const edgeLabels = renderEdgeMeasurements(
            map,
            latLngs,
            color,
            currentZoom,
            false  // open shape (polyline)
          );
          previousLabelsRef.current.push(...edgeLabels);
        }
      } else if (item.measurement.type === 'point' && item.measurement.pointLocations) {
        // Render point measurements
        console.log(`  ➡️ Rendering ${item.measurement.pointLocations.length} point markers with color ${color}`);
        item.measurement.pointLocations.forEach((point, idx) => {
          const markerId = `${item.id}-point-${idx}`;
          console.log(`    • Point ${idx + 1}:`, point, 'ID:', markerId);
          const marker = new google.maps.Marker({
            position: point, // Already in {lat, lng} format
            map: map,
            label: {
              text: `${idx + 1}`,
              color: 'white',
              fontSize: '14px',
              fontWeight: '300'
            },
            icon: {
              path: google.maps.SymbolPath.CIRCLE,
              fillColor: color,
              fillOpacity: 0.8,
              strokeColor: 'white',
              strokeWeight: 2,
              scale: getZoomBasedMarkerScale(currentZoom)
            },
            title: `${item.customName || item.productName} - Point ${idx + 1}`
          });
          
          // Store custom ID for debugging
          (marker as any).customId = markerId;
          
          previousLabelsRef.current.push(marker);
        });
      }
    });
    
    console.log('✅ MeasurementTools - Rendering complete. Shapes:', previousShapesRef.current.length, 'Labels:', previousLabelsRef.current.length);
    isRenderingRef.current = false;
  };

  const getNextMeasurementColor = () => {
    const colorIndex = existingQuoteItems.length % MAP_COLORS.length;
    return MAP_COLORS[colorIndex];
  };

  const setupDrawingManager = (map: google.maps.Map) => {
    const nextColor = getNextMeasurementColor();
    
    const drawingManager = new google.maps.drawing.DrawingManager({
      drawingMode: null,
      drawingControl: false,
      polygonOptions: {
        fillColor: nextColor,
        fillOpacity: 0.3,
        strokeColor: nextColor,
        strokeWeight: 2,
        clickable: true,
        editable: true, // Always editable when first drawn
        zIndex: 1,
      },
      polylineOptions: {
        strokeColor: nextColor,
        strokeWeight: 2,
        clickable: true,
        editable: true, // Always editable when first drawn
      },
    });

    drawingManager.setMap(map);
    drawingManagerRef.current = drawingManager;
    
    // Disable drawing manager if in configuration mode
    if (isConfigurationMode) {
      drawingManager.setDrawingMode(null);
      drawingManager.setOptions({
        drawingControl: false
      });
    }

    // Add map click listener for point placement mode using refs
    google.maps.event.addListener(map, 'click', (event: google.maps.MapMouseEvent) => {
      console.log('Map clicked, measurementType:', measurementTypeRef.current, 'isDrawing:', isDrawingRef.current);
      
      if (measurementTypeRef.current === 'dimensional' && isDrawingRef.current && event.latLng) {
        console.log('Placing dimensional product at:', event.latLng.lat(), event.latLng.lng());
        placeDimensionalProduct(event.latLng);
      } else if (measurementTypeRef.current === 'point' && isDrawingRef.current && event.latLng) {
        console.log('Adding point marker at:', event.latLng.lat(), event.latLng.lng());
        addPointMarker(event.latLng);
      }
    });

    // Add drawing mode change listener for real-time measurements
    google.maps.event.addListener(drawingManager, 'drawingmode_changed', () => {
      const mode = drawingManager.getDrawingMode();
      
      if (mode === google.maps.drawing.OverlayType.POLYGON || 
          mode === google.maps.drawing.OverlayType.POLYLINE) {
        setIsDrawingInProgress(true);
        currentPathRef.current = [];
        
        // Start tracking mouse movements
        if (mouseMoveListenerRef.current) {
          google.maps.event.removeListener(mouseMoveListenerRef.current);
        }
        
        // Throttle mouse move updates
        let lastUpdate = 0;
        mouseMoveListenerRef.current = map.addListener('mousemove', (event: google.maps.MapMouseEvent) => {
          const now = Date.now();
          if (!event.latLng || now - lastUpdate < 50) return;
          lastUpdate = now;
          
          // If we have at least one point, show temp segment distance to cursor
          if (currentPathRef.current.length > 0) {
            const lastPoint = currentPathRef.current[currentPathRef.current.length - 1];
            const distance = google.maps.geometry.spherical.computeDistanceBetween(lastPoint, event.latLng);
            const feet = Math.ceil(distance * 3.28084);
            
            updateTempMeasurementOverlay(
              feet,
              'ft',
              event.latLng
            );
          }
        });
        
        // Track clicks to build path and create segment labels
        if (clickListenerRef.current) {
          google.maps.event.removeListener(clickListenerRef.current);
        }
        clickListenerRef.current = map.addListener('click', (event: google.maps.MapMouseEvent) => {
          if (event.latLng && isDrawingInProgress) {
            const previousPoint = currentPathRef.current[currentPathRef.current.length - 1];
            currentPathRef.current.push(event.latLng);
            
            // If we have at least 2 points, create a segment label
            if (previousPoint) {
              const segmentLabel = createSegmentLabel(
                previousPoint, 
                event.latLng, 
                segmentLabelsRef.current.length
              );
              segmentLabelsRef.current.push(segmentLabel);
            }
          }
        });
      } else {
        // Clear when exiting drawing mode
        setIsDrawingInProgress(false);
        currentPathRef.current = [];
        
        // Clear segment labels when exiting drawing mode
        segmentLabelsRef.current.forEach(label => label.setMap(null));
        segmentLabelsRef.current = [];
        
        if (tempMeasurementOverlay) {
          tempMeasurementOverlay.setMap(null);
          setTempMeasurementOverlay(null);
        }
        if (mouseMoveListenerRef.current) {
          google.maps.event.removeListener(mouseMoveListenerRef.current);
          mouseMoveListenerRef.current = null;
        }
        if (clickListenerRef.current) {
          google.maps.event.removeListener(clickListenerRef.current);
          clickListenerRef.current = null;
        }
      }
    });

    google.maps.event.addListener(drawingManager, 'overlaycomplete', (event: any) => {
      // Clean up real-time measurement overlay
      if (tempMeasurementOverlay) {
        tempMeasurementOverlay.setMap(null);
        setTempMeasurementOverlay(null);
      }
      
      // Clear segment labels when drawing completes
      segmentLabelsRef.current.forEach(label => label.setMap(null));
      segmentLabelsRef.current = [];
      
      setIsDrawingInProgress(false);
      currentPathRef.current = [];
      
      // Clean up listeners
      if (mouseMoveListenerRef.current) {
        google.maps.event.removeListener(mouseMoveListenerRef.current);
        mouseMoveListenerRef.current = null;
      }
      if (clickListenerRef.current) {
        google.maps.event.removeListener(clickListenerRef.current);
        clickListenerRef.current = null;
      }
      
      setIsDrawing(false);
      
      if (currentShapeRef.current) {
        currentShapeRef.current.setMap(null);
      }
      
      if (measurementLabelRef.current) {
        measurementLabelRef.current.setMap(null);
      }
      
      currentShapeRef.current = event.overlay;
      drawingManager.setDrawingMode(null);

      if (event.type === google.maps.drawing.OverlayType.POLYGON) {
        const polygon = event.overlay as google.maps.Polygon;
        const path = polygon.getPath();
        const area = google.maps.geometry.spherical.computeArea(path);
        const sqFt = Math.ceil(area * 10.764);
        
        // Store coordinates
        const coordinates: number[][] = [];
        path.forEach((latLng) => {
          coordinates.push([latLng.lat(), latLng.lng()]);
        });
        
        setMapMeasurement(sqFt);
        
        // Set initial measurement immediately after drawing
        const colorIndex = existingQuoteItems.length % MAP_COLORS.length;
        const mapColor = MAP_COLORS[colorIndex];
        
        setCurrentMeasurement({
          type: 'area',
          value: sqFt,
          unit: 'sq_ft',
          coordinates: coordinates,
          manualEntry: false,
          mapColor: mapColor
        });
        
        // Add edge measurements for the polygon
        const latLngs = coordinates.map(coord => ({ lat: coord[0], lng: coord[1] }));
        currentEdgeLabelsRef.current = renderEdgeMeasurements(
          mapRef.current!,
          latLngs,
          mapColor,
          currentZoom,
          true  // closed shape (polygon)
        );
        
        const updateMeasurement = () => {
          const newArea = google.maps.geometry.spherical.computeArea(path);
          const newSqFt = Math.ceil(newArea * 10.764);
          setMapMeasurement(newSqFt);
          updateMeasurementLabel(polygon, newSqFt, 'sq ft');
          
          // Update currentMeasurement with new coordinates and value
          const newCoordinates: number[][] = [];
          path.forEach((latLng) => {
            newCoordinates.push([latLng.lat(), latLng.lng()]);
          });
          
          const colorIndex = existingQuoteItems.length % MAP_COLORS.length;
          const mapColor = MAP_COLORS[colorIndex];
          
          setCurrentMeasurement({
            type: 'area',
            value: newSqFt,
            unit: 'sq_ft',
            coordinates: newCoordinates,
            manualEntry: false,
            mapColor: mapColor
          });
          
          // Update edge measurements
          currentEdgeLabelsRef.current.forEach(label => label.setMap(null));
          const updatedLatLngs = newCoordinates.map(coord => ({ lat: coord[0], lng: coord[1] }));
          currentEdgeLabelsRef.current = renderEdgeMeasurements(
            mapRef.current!,
            updatedLatLngs,
            mapColor,
            currentZoom,
            true
          );
        };
        
        updateMeasurementLabel(polygon, sqFt, 'sq ft');
        
        // Always add edit listeners so nodes remain editable
        google.maps.event.addListener(path, 'set_at', updateMeasurement);
        google.maps.event.addListener(path, 'insert_at', updateMeasurement);
        google.maps.event.addListener(path, 'remove_at', updateMeasurement);
        
      } else if (event.type === google.maps.drawing.OverlayType.POLYLINE) {
        const polyline = event.overlay as google.maps.Polyline;
        const path = polyline.getPath();
        const length = google.maps.geometry.spherical.computeLength(path);
        const feet = Math.ceil(length * 3.28084);
        
        // Store coordinates
        const coordinates: number[][] = [];
        path.forEach((latLng) => {
          coordinates.push([latLng.lat(), latLng.lng()]);
        });
        
        setMapMeasurement(feet);
        
        // Set initial measurement immediately after drawing
        const colorIndex = existingQuoteItems.length % MAP_COLORS.length;
        const mapColor = MAP_COLORS[colorIndex];
        
        setCurrentMeasurement({
          type: 'linear',
          value: feet,
          unit: 'linear_ft',
          coordinates: coordinates,
          manualEntry: false,
          mapColor: mapColor
        });
        
        // Only show edge measurements when there are multiple segments (more than 2 points)
        // For single segment (2 points), segment and total are identical, so skip redundant labels
        const latLngs = coordinates.map(coord => ({ lat: coord[0], lng: coord[1] }));
        if (latLngs.length > 2) {
          currentEdgeLabelsRef.current = renderEdgeMeasurements(
            mapRef.current!,
            latLngs,
            mapColor,
            currentZoom,
            false  // open shape (polyline)
          );
        }
        
        const updateMeasurement = () => {
          const newLength = google.maps.geometry.spherical.computeLength(path);
          const newFeet = Math.ceil(newLength * 3.28084);
          setMapMeasurement(newFeet);
          updateMeasurementLabel(polyline, newFeet, 'ft');
          
          // Update currentMeasurement with new coordinates and value
          const newCoordinates: number[][] = [];
          path.forEach((latLng) => {
            newCoordinates.push([latLng.lat(), latLng.lng()]);
          });
          
          const colorIndex = existingQuoteItems.length % MAP_COLORS.length;
          const mapColor = MAP_COLORS[colorIndex];
          
          setCurrentMeasurement({
            type: 'linear',
            value: newFeet,
            unit: 'linear_ft',
            coordinates: newCoordinates,
            manualEntry: false,
            mapColor: mapColor
          });
          
          // Update edge measurements (only for multi-segment polylines)
          currentEdgeLabelsRef.current.forEach(label => label.setMap(null));
          currentEdgeLabelsRef.current = [];
          const updatedLatLngs = newCoordinates.map(coord => ({ lat: coord[0], lng: coord[1] }));
          if (updatedLatLngs.length > 2) {
            currentEdgeLabelsRef.current = renderEdgeMeasurements(
              mapRef.current!,
              updatedLatLngs,
              mapColor,
              currentZoom,
              false
            );
          }
        };
        
        updateMeasurementLabel(polyline, feet, 'ft');
        
        // Always add edit listeners so nodes remain editable
        google.maps.event.addListener(path, 'set_at', updateMeasurement);
        google.maps.event.addListener(path, 'insert_at', updateMeasurement);
        google.maps.event.addListener(path, 'remove_at', updateMeasurement);
      }
    });
  };

  // Helper function to create segment distance label
  const createSegmentLabel = (
    point1: google.maps.LatLng,
    point2: google.maps.LatLng,
    segmentIndex: number
  ): google.maps.Marker => {
    // Calculate distance between two points
    const distance = google.maps.geometry.spherical.computeDistanceBetween(point1, point2);
    const feet = Math.ceil(distance * 3.28084);
    
    // Calculate midpoint for label position
    const midLat = (point1.lat() + point2.lat()) / 2;
    const midLng = (point1.lng() + point2.lng()) / 2;
    const midpoint = new google.maps.LatLng(midLat, midLng);
    
    // Get current zoom for font sizing
    const currentZoom = mapRef.current?.getZoom() || 19;
    const fontSize = getZoomBasedFontSize(currentZoom);
    
    // Create label marker
    const marker = new google.maps.Marker({
      position: midpoint,
      map: mapRef.current,
      icon: {
        path: google.maps.SymbolPath.CIRCLE,
        scale: 0, // Invisible circle, just showing label
      },
      label: {
        text: `${feet.toLocaleString()} ft`,
        color: '#ffffff',
        fontSize: `${fontSize}px`,
        fontWeight: '700',
        className: 'segment-label'
      },
      zIndex: 10000 + segmentIndex,
    });
    
    return marker;
  };

  // Helper function to create side dimension labels
  const createSideLabels = (
    corners: Array<{lat: number, lng: number}>,
    width: number,
    length: number,
    color: string,
    zoomLevel: number
  ) => {
    if (!mapRef.current) return;
    
    // Clear existing side labels
    dimensionalSideLabelsRef.current.forEach(label => label.setMap(null));
    dimensionalSideLabelsRef.current = [];
    
    // Calculate midpoints of each side
    // corners order: [top-left, top-right, bottom-right, bottom-left]
    const topMid = {
      lat: (corners[0].lat + corners[1].lat) / 2,
      lng: (corners[0].lng + corners[1].lng) / 2
    };
    const rightMid = {
      lat: (corners[1].lat + corners[2].lat) / 2,
      lng: (corners[1].lng + corners[2].lng) / 2
    };
    
    const fontSize = getZoomBasedFontSize(zoomLevel);
    
    // Create width label (top side)
    const widthLabel = new google.maps.Marker({
      position: topMid,
      map: mapRef.current,
      icon: {
        path: google.maps.SymbolPath.CIRCLE,
        scale: 0,
      },
      label: {
        text: `${width} ft`,
        color: color,
        fontSize: `${fontSize}px`,
        fontWeight: '600',
      },
      zIndex: 2
    });
    
    // Create length label (right side)
    const lengthLabel = new google.maps.Marker({
      position: rightMid,
      map: mapRef.current,
      icon: {
        path: google.maps.SymbolPath.CIRCLE,
        scale: 0,
      },
      label: {
        text: `${length} ft`,
        color: color,
        fontSize: `${fontSize}px`,
        fontWeight: '600',
      },
      zIndex: 2
    });
    
    dimensionalSideLabelsRef.current.push(widthLabel, lengthLabel);
  };

  const placeDimensionalProduct = (latLng: google.maps.LatLng) => {
    if (!product || !product.default_width || !product.default_length || !mapRef.current) return;

    const center = { lat: latLng.lat(), lng: latLng.lng() };
    setDimensionalCenter(center);
    
    // Initialize refs with placement values
    finalDimensionalCenterRef.current = center;
    finalDimensionalRotationRef.current = 0;
    
    setIsDimensionalPlaced(true);
    setIsDrawing(false);

    const width = product.default_width;
    const length = product.default_length;
    const area = Math.ceil(width * length);
    
    setMapMeasurement(area);
    
    // Assign color ONCE and persist it
    const assignedColor = getNextMeasurementColor();
    setAssignedMeasurementColor(assignedColor);

    const updateDimensionalShape = () => {
      if (currentShapeRef.current) currentShapeRef.current.setMap(null);
      if (rotationHandle) rotationHandle.setMap(null);
      if (dragHandle) dragHandle.setMap(null);

      const corners = calculateRotatedRectangle(
        dimensionalCenter?.lat || center.lat,
        dimensionalCenter?.lng || center.lng,
        width, length, dimensionalRotation
      );

      const color = assignedMeasurementColor || getNextMeasurementColor();
      const polygon = new google.maps.Polygon({
        paths: corners, fillColor: color, fillOpacity: 0.3,
        strokeColor: color, strokeWeight: 2, map: mapRef.current, zIndex: 1
      });
      currentShapeRef.current = polygon;
      
      // Create side dimension labels
      const currentZoom = mapRef.current?.getZoom() || 14;
      createSideLabels(corners, width, length, color, currentZoom);

      const drag = new google.maps.Marker({
        position: dimensionalCenter || center, map: mapRef.current, draggable: true,
        icon: { path: google.maps.SymbolPath.CIRCLE, fillColor: '#fff', fillOpacity: 1,
          strokeColor: color, strokeWeight: 3, scale: 10 },
        label: { text: '✥', color: color, fontSize: '16px', fontWeight: 'bold' }
      });
      setDragHandle(drag);

      // Drag listener - update polygon in real-time
      google.maps.event.addListener(drag, 'drag', (e: any) => {
        const newCenter = { lat: e.latLng.lat(), lng: e.latLng.lng() };
        setDimensionalCenter(newCenter);
        
        // Immediately update polygon position - USE REF FOR ROTATION (not state)
        if (currentShapeRef.current) {
          const currentRotation = finalDimensionalRotationRef.current || 0;
          const updatedCorners = calculateRotatedRectangle(
            newCenter.lat, newCenter.lng, width, length, currentRotation
          );
          (currentShapeRef.current as google.maps.Polygon).setPath(updatedCorners);
          
          // Update rotation handle position to follow the product
          if (rotationHandle) {
            const newRotationPos = new google.maps.LatLng(updatedCorners[1].lat, updatedCorners[1].lng);
            rotationHandle.setPosition(newRotationPos);
            rotationHandlePositionRef.current = newRotationPos;
          }
          
          // Update side labels
          const currentZoom = mapRef.current?.getZoom() || 14;
          const color = assignedMeasurementColor || getNextMeasurementColor();
          createSideLabels(updatedCorners, width, length, color, currentZoom);
        }
      });
      
      google.maps.event.addListener(drag, 'dragend', () => {
        // Ensure state is updated with final position
        const finalCenter = drag.getPosition();
        if (finalCenter) {
          const centerObj = { lat: finalCenter.lat(), lng: finalCenter.lng() };
          setDimensionalCenter(centerObj);
          
          // CRITICAL: Save to ref immediately for measurement capture
          finalDimensionalCenterRef.current = centerObj;
          
          console.log('🎯 Drag ended at:', centerObj);
          
          // Update measurement label position if needed
          if (measurementLabelRef.current) {
            measurementLabelRef.current.setPosition(finalCenter);
          }
          
          // UPDATE: Re-save measurement with new position
          updateDimensionalMeasurement();
        }
      });

      // Create rotation handle at top-right corner
      const rotHandle = new google.maps.Marker({
        position: corners[1],
        map: mapRef.current,
        draggable: true,
        icon: {
          path: google.maps.SymbolPath.CIRCLE,
          fillColor: color,
          fillOpacity: 1,
          strokeColor: '#ffffff',
          strokeWeight: 2,
          scale: 8
        },
        title: 'Drag to rotate',
        zIndex: 10
      });
      setRotationHandle(rotHandle);

      // Rotation drag listener
      google.maps.event.addListener(rotHandle, 'drag', (e: any) => {
        const handlePos = { lat: e.latLng.lat(), lng: e.latLng.lng() };
        const centerPos = drag.getPosition(); // Use CURRENT drag handle position
        
        if (!centerPos) return;
        
        // Calculate angle between center and handle
        const angle = Math.atan2(
          handlePos.lat - centerPos.lat(),
          handlePos.lng - centerPos.lng()
        ) * (180 / Math.PI);
        
        // Adjust angle to match our coordinate system (0° = north)
        const adjustedAngle = (angle + 90 + 360) % 360;
        setDimensionalRotation(adjustedAngle);
        
        // Update ref in real-time
        finalDimensionalRotationRef.current = adjustedAngle;
        
        // Immediately update polygon with new rotation
        if (currentShapeRef.current) {
          const updatedCorners = calculateRotatedRectangle(
            centerPos.lat(), centerPos.lng(), width, length, adjustedAngle
          );
          (currentShapeRef.current as google.maps.Polygon).setPath(updatedCorners);
          
          // LOCK rotation handle to the corner (don't let it float freely)
          const lockedPosition = new google.maps.LatLng(updatedCorners[1].lat, updatedCorners[1].lng);
          rotHandle.setPosition(lockedPosition);
          rotationHandlePositionRef.current = lockedPosition;
          
          // Update side labels with new rotation
          const currentZoom = mapRef.current?.getZoom() || 14;
          const color = assignedMeasurementColor || getNextMeasurementColor();
          createSideLabels(updatedCorners, width, length, color, currentZoom);
        }
        
        // Update center to current position and save to ref
        const centerObj = { lat: centerPos.lat(), lng: centerPos.lng() };
        setDimensionalCenter(centerObj);
        finalDimensionalCenterRef.current = centerObj;
      });
      
      google.maps.event.addListener(rotHandle, 'dragend', () => {
        // Ensure both center and rotation state are finalized
        const finalCenter = drag.getPosition();
        if (finalCenter) {
          const centerObj = { lat: finalCenter.lat(), lng: finalCenter.lng() };
          setDimensionalCenter(centerObj);
          finalDimensionalCenterRef.current = centerObj;
        }
        
        // DON'T overwrite ref - it's already correct from drag event!
        // The state is stale due to React batching
        
        console.log('🔄 Rotation complete, angle:', finalDimensionalRotationRef.current, 'center:', finalDimensionalCenterRef.current);
        
        // UPDATE: Re-save measurement with new rotation
        updateDimensionalMeasurement();
      });
    };

    updateDimensionalShape();
  };

  const updateDimensionalMeasurement = () => {
    if (!currentShapeRef.current || !product || measurementType !== 'dimensional') return;
    
    // Get current coordinates from the shape
    const coordinates: number[][] = [];
    const path = (currentShapeRef.current as google.maps.Polygon).getPath();
    path.forEach((latLng) => {
      coordinates.push([latLng.lat(), latLng.lng()]);
    });
    
    const mapColor = assignedMeasurementColor || MAP_COLORS[existingQuoteItems.length % MAP_COLORS.length];
    
    // Calculate measurement value from dimensions (don't rely on state)
    const width = product.default_width || 0;
    const length = product.default_length || 0;
    const calculatedArea = Math.ceil(width * length);
    
    const updatedMeasurement: MeasurementData = {
      type: 'area',
      value: calculatedArea,
      unit: 'sq_ft',
      coordinates: coordinates,
      manualEntry: false,
      mapColor: mapColor,
      isDimensional: true,
      rotation: finalDimensionalRotationRef.current,
      centerPoint: finalDimensionalCenterRef.current || dimensionalCenter,
      dimensions: {
        width: width,
        length: length,
        unit: 'feet'
      }
    };
    
    console.log('🔄 Updating dimensional measurement after move/rotate:', {
      center: updatedMeasurement.centerPoint,
      rotation: updatedMeasurement.rotation,
      coordinates: updatedMeasurement.coordinates
    });
    
    setCurrentMeasurement(updatedMeasurement);
    // Don't call onMeasurementComplete here - let the Next button handle it
  };

  const updateMeasurementLabel = (
    shape: google.maps.Polygon | google.maps.Polyline,
    value: number,
    unit: string
  ) => {
    if (!mapRef.current) return;

    let center: google.maps.LatLng;
    
    if (shape instanceof google.maps.Polygon) {
      const bounds = new google.maps.LatLngBounds();
      shape.getPath().forEach((coord) => bounds.extend(coord));
      center = bounds.getCenter();
    } else {
      const path = shape.getPath();
      const midIndex = Math.floor(path.getLength() / 2);
      center = path.getAt(midIndex);
    }

    if (measurementLabelRef.current) {
      measurementLabelRef.current.setMap(null);
    }

    const marker = new google.maps.Marker({
      position: center,
      map: mapRef.current,
      icon: {
        path: google.maps.SymbolPath.CIRCLE,
        scale: 0,
      },
      label: {
        text: `${value.toLocaleString()} ${unit}`,
        color: getNextMeasurementColor(),
        fontSize: `${getZoomBasedFontSize(currentZoom)}px`,
        fontWeight: '600',
      },
    });

    measurementLabelRef.current = marker;
  };

  const startDrawing = () => {
    if (!drawingManagerRef.current || !mapRef.current) {
      console.log('Cannot start drawing: drawingManager not ready');
      return;
    }

    console.log('Starting drawing mode:', measurementType);
    setShowManualEntry(false);
    clearMapDrawing();
    
    // Set drawing state AFTER clearing to avoid it being reset
    setIsDrawing(true);
    isDrawingRef.current = true; // Update ref immediately

    const nextColor = getNextMeasurementColor();
    
    if (measurementType === 'dimensional') {
      // For dimensional mode, just enable map clicking for placement
      drawingManagerRef.current.setDrawingMode(null);
      console.log('Dimensional placement mode activated - click to place product');
      return;
    }
    
    if (measurementType === 'point') {
      // For point mode, just enable clicking (no drawing manager needed)
      drawingManagerRef.current.setDrawingMode(null);
      console.log('Point placement mode activated - click to place markers');
    } else {
      // Update drawing manager colors to match the next measurement color
      drawingManagerRef.current.setOptions({
        polygonOptions: {
          fillColor: nextColor,
          fillOpacity: 0.3,
          strokeColor: nextColor,
          strokeWeight: 2,
          clickable: true,
          editable: true,
          zIndex: 1,
        },
        polylineOptions: {
          strokeColor: nextColor,
          strokeWeight: 2,
          clickable: true,
          editable: true,
        },
      });

      const mode = measurementType === 'area' 
        ? google.maps.drawing.OverlayType.POLYGON 
        : google.maps.drawing.OverlayType.POLYLINE;
      
      drawingManagerRef.current.setDrawingMode(mode);
      console.log('Drawing mode activated:', mode);
    }
  };

  const clearMapDrawing = () => {
    if (currentShapeRef.current) {
      currentShapeRef.current.setMap(null);
      currentShapeRef.current = null;
    }
    
    if (measurementLabelRef.current) {
      measurementLabelRef.current.setMap(null);
      measurementLabelRef.current = null;
    }
    
    // Clear real-time measurement overlay
    if (tempMeasurementOverlay) {
      tempMeasurementOverlay.setMap(null);
      setTempMeasurementOverlay(null);
    }
    
    // Clear segment labels
    segmentLabelsRef.current.forEach(label => label.setMap(null));
    segmentLabelsRef.current = [];
    
    // Clear current edge measurement labels
    currentEdgeLabelsRef.current.forEach(label => label.setMap(null));
    currentEdgeLabelsRef.current = [];
    
    // Clear dimensional side labels (width/length labels)
    dimensionalSideLabelsRef.current.forEach(label => label.setMap(null));
    dimensionalSideLabelsRef.current = [];
    
    setIsDrawingInProgress(false);
    currentPathRef.current = [];
    
    // Clean up listeners
    if (mouseMoveListenerRef.current) {
      google.maps.event.removeListener(mouseMoveListenerRef.current);
      mouseMoveListenerRef.current = null;
    }
    if (clickListenerRef.current) {
      google.maps.event.removeListener(clickListenerRef.current);
      clickListenerRef.current = null;
    }
    
    // Clear point markers
    if (measurementType === 'point') {
      pointMarkers.forEach(marker => marker.setMap(null));
      setPointMarkers([]);
      setPointLocations([]);
      pointCountRef.current = 0; // Reset counter
    }
    
    // Clear dimensional product handles
    if (rotationHandle) {
      rotationHandle.setMap(null);
      setRotationHandle(null);
    }
    if (dragHandle) {
      dragHandle.setMap(null);
      setDragHandle(null);
    }
    setIsDimensionalPlaced(false);
    setAssignedMeasurementColor(null); // Reset color when clearing
    
    if (drawingManagerRef.current) {
      drawingManagerRef.current.setDrawingMode(null);
    }
    
    setMapMeasurement(null);
    setIsDrawing(false);
  };

  const handleUndo = () => {
    clearMapDrawing();
    setCurrentMeasurement(null); // Clear the saved measurement to allow new one
    
    // If we're in configuration mode, reset back to measurement step
    if (isConfigurationMode && onResetToMeasurement) {
      onResetToMeasurement();
    }
    
    // Restart drawing mode immediately after clearing
    setTimeout(() => {
      if (!showManualEntry) {
        startDrawing();
      }
    }, 100);
  };

  const addPointMarker = (location: google.maps.LatLng) => {
    if (!mapRef.current) return;
    
    const newPoint = {
      lat: location.lat(),
      lng: location.lng()
    };
    
    // Increment ref counter for reliable sequential numbering
    pointCountRef.current += 1;
    const markerNumber = pointCountRef.current;
    const nextColor = getNextMeasurementColor();
    
    // Create marker
    const currentZoom = mapRef.current?.getZoom() || 16;
    const marker = new google.maps.Marker({
      position: location,
      map: mapRef.current,
      draggable: true,
      label: {
        text: `${markerNumber}`,
        color: 'white',
        fontSize: '14px',
        fontWeight: '300'
      },
      icon: {
        path: google.maps.SymbolPath.CIRCLE,
        fillColor: nextColor,
        fillOpacity: 1,
        strokeColor: 'white',
        strokeWeight: 2,
        scale: getZoomBasedMarkerScale(currentZoom)
      },
      animation: google.maps.Animation.DROP
    });
    
    // Add drag listener to update position
    google.maps.event.addListener(marker, 'dragend', (e: google.maps.MapMouseEvent) => {
      if (e.latLng) {
        const index = pointMarkers.indexOf(marker);
        if (index !== -1) {
          const updatedLocations = [...pointLocations];
          updatedLocations[index] = {
            lat: e.latLng.lat(),
            lng: e.latLng.lng()
          };
          setPointLocations(updatedLocations);
        }
      }
    });
    
    setPointLocations(prev => [...prev, newPoint]);
    setPointMarkers(prev => [...prev, marker]);
  };

  const removeLastPoint = () => {
    if (pointMarkers.length === 0) return;
    
    // Remove last marker from map
    const lastMarker = pointMarkers[pointMarkers.length - 1];
    lastMarker.setMap(null);
    
    // Update state
    setPointMarkers(prev => prev.slice(0, -1));
    setPointLocations(prev => prev.slice(0, -1));
    
    // Decrement counter
    pointCountRef.current = Math.max(0, pointCountRef.current - 1);
    
    // Renumber remaining markers
    pointMarkers.slice(0, -1).forEach((marker, idx) => {
      marker.setLabel({
        text: `${idx + 1}`,
        color: 'white',
        fontSize: '14px',
        fontWeight: '300'
      });
    });
  };

  const clearAllPoints = () => {
    // Remove all markers from map
    pointMarkers.forEach(marker => marker.setMap(null));
    
    // Clear state
    setPointMarkers([]);
    setPointLocations([]);
    pointCountRef.current = 0; // Reset counter
    setIsDrawing(true);
  };

  const handleManualSubmit = () => {
    const value = parseFloat(manualValue);
    if (isNaN(value) || value <= 0) return;

    // Assign a color from the palette based on existing quote items count
    const colorIndex = existingQuoteItems.length % MAP_COLORS.length;
    const mapColor = MAP_COLORS[colorIndex];

    const measurement: MeasurementData = {
      type: measurementType === 'dimensional' ? 'area' : measurementType,
      value: Math.ceil(value),
      unit: measurementType === 'area' || measurementType === 'dimensional' ? 'sq_ft' : measurementType === 'linear' ? 'linear_ft' : 'each',
      manualEntry: true,
      mapColor: mapColor
    };

    setCurrentMeasurement(measurement);
    onMeasurementComplete(measurement);
    setShowManualEntry(false);
    setManualValue('');
    
    // Scroll to the action buttons after manual entry
    setTimeout(() => {
      const actionButtonsRow = document.getElementById('action-buttons-row');
      if (actionButtonsRow) {
        actionButtonsRow.scrollIntoView({ behavior: 'smooth', block: 'center' });
      }
    }, 300);
  };

  // Save measurement when map measurement is complete
  useEffect(() => {
    // Handle point measurements
    if (measurementType === 'point' && pointLocations.length > 0 && !isDrawing && !showManualEntry && !currentMeasurement) {
      const nextColor = getNextMeasurementColor();
      const measurement: MeasurementData = {
        type: 'point',
        value: pointLocations.length,
        unit: 'each',
        pointLocations: pointLocations,
        manualEntry: false,
        mapColor: nextColor
      };
      
      setCurrentMeasurement(measurement);
      onMeasurementComplete(measurement);
      
      // Scroll to show the measurement tools after completing measurement with retry
      const scrollToButtons = (attempts = 0) => {
        const bottomControls = document.getElementById('measurement-action-buttons');
        console.log(`🔍 Autoscroll attempt ${attempts + 1}: Looking for measurement-action-buttons:`, bottomControls ? 'Found' : 'Not found');
        
        if (bottomControls) {
          const header = document.querySelector('.sticky.top-0');
          const headerHeight = header?.getBoundingClientRect().height || 0;
          const elementPosition = bottomControls.getBoundingClientRect().top + window.pageYOffset;
          const offsetPosition = elementPosition - headerHeight - 100;
          
          window.scrollTo({
            top: offsetPosition,
            behavior: 'smooth'
          });
        } else if (attempts < 10) {
          setTimeout(() => scrollToButtons(attempts + 1), 200);
        } else {
          console.log('❌ Failed to find measurement-action-buttons after 10 attempts');
        }
      };
      setTimeout(() => scrollToButtons(), 300);
    }
    // Handle area/linear measurements (allow 0 measurements so user can remeasure)
    else if (mapMeasurement !== null && mapMeasurement !== undefined && !isDrawing && !showManualEntry && !currentMeasurement && currentShapeRef.current) {
      // Get coordinates from the current shape
      const coordinates: number[][] = [];
      if (currentShapeRef.current instanceof google.maps.Polygon) {
        const path = currentShapeRef.current.getPath();
        path.forEach((latLng) => {
          coordinates.push([latLng.lat(), latLng.lng()]);
        });
      } else if (currentShapeRef.current instanceof google.maps.Polyline) {
        const path = currentShapeRef.current.getPath();
        path.forEach((latLng) => {
          coordinates.push([latLng.lat(), latLng.lng()]);
        });
      }

      // Use the assigned color or assign a new one based on existing quote items count
      const mapColor = assignedMeasurementColor || MAP_COLORS[existingQuoteItems.length % MAP_COLORS.length];

      const measurement: MeasurementData = {
        type: measurementType === 'dimensional' ? 'area' : measurementType,
        value: mapMeasurement,
        unit: measurementType === 'area' || measurementType === 'dimensional' ? 'sq_ft' : 'linear_ft',
        coordinates: coordinates,
        manualEntry: false,
        mapColor: mapColor,
        // Add dimensional metadata - USE REFS for accurate values
        ...(measurementType === 'dimensional' && {
          isDimensional: true,
          rotation: finalDimensionalRotationRef.current, // Use ref instead of state
          centerPoint: finalDimensionalCenterRef.current || dimensionalCenter, // Use ref with fallback
          dimensions: {
            width: product?.default_width || 0,
            length: product?.default_length || 0,
            unit: 'feet'
          }
        })
      };

      // Add debug logging
      if (measurementType === 'dimensional') {
        console.log('💾 Saving dimensional measurement:', {
          center: finalDimensionalCenterRef.current,
          rotation: finalDimensionalRotationRef.current,
          dimensions: measurement.dimensions
        });
      }

      setCurrentMeasurement(measurement);
      
      // For dimensional products, don't auto-transition - let user adjust position/rotation first
      if (measurementType !== 'dimensional') {
        onMeasurementComplete(measurement);
      }
      
      // Scroll to show the measurement tools after completing measurement with retry
      const scrollToButtons = (attempts = 0) => {
        const bottomControls = document.getElementById('measurement-action-buttons');
        console.log(`🔍 Autoscroll attempt ${attempts + 1}: Looking for measurement-action-buttons:`, bottomControls ? 'Found' : 'Not found');
        
        if (bottomControls) {
          const header = document.querySelector('.sticky.top-0');
          const headerHeight = header?.getBoundingClientRect().height || 0;
          const elementPosition = bottomControls.getBoundingClientRect().top + window.pageYOffset;
          const offsetPosition = elementPosition - headerHeight - 100;
          
          window.scrollTo({
            top: offsetPosition,
            behavior: 'smooth'
          });
        } else if (attempts < 10) {
          setTimeout(() => scrollToButtons(attempts + 1), 200);
        } else {
          console.log('❌ Failed to find measurement-action-buttons after 10 attempts');
        }
      };
      setTimeout(() => scrollToButtons(), 300);
    }
  }, [mapMeasurement, isDrawing, showManualEntry, currentMeasurement, pointLocations, measurementType]);

  // Expose finalize method to parent component
  useEffect(() => {
    if (onFinalizeMeasurement && currentShapeRef.current) {
      // Replace the callback with our finalize logic
      const originalCallback = onFinalizeMeasurement;
      (window as any).__finalizeMeasurement = () => {
        console.log('🔒 Finalizing measurement - making non-editable');
        
        // Make the current shape non-editable instead of removing it
        if (currentShapeRef.current) {
          currentShapeRef.current.setEditable(false);
          console.log('✅ Measurement locked - nodes removed');
        }
        
        // Clear dimensional handles (only for dimensional measurements)
        if (measurementType === 'dimensional') {
          if (rotationHandle) {
            rotationHandle.setMap(null);
            setRotationHandle(null);
          }
          if (dragHandle) {
            dragHandle.setMap(null);
            setDragHandle(null);
          }
          setIsDimensionalPlaced(false);
        }
      };
    }
  }, [onFinalizeMeasurement, measurementType, rotationHandle, dragHandle]);

  // Clear interactive elements when navigating away from configuration
  useEffect(() => {
    // Only clear if we're NOT in configuration mode and have existing items
    if (existingQuoteItems.length > 0 && currentStep !== 'product-configuration' && currentShapeRef.current) {
      console.log('🧹 Clearing interactive drawing elements - left configuration');
      
      // Clear current shape (polygon/polyline)
      if (currentShapeRef.current) {
        currentShapeRef.current.setMap(null);
        currentShapeRef.current = null;
      }
      
      // Clear dimensional handles (only for dimensional measurements)
      if (measurementType === 'dimensional') {
        if (rotationHandle) {
          rotationHandle.setMap(null);
          setRotationHandle(null);
        }
        if (dragHandle) {
          dragHandle.setMap(null);
          setDragHandle(null);
        }
        setIsDimensionalPlaced(false);
      }
      
      // Clear measurement label
      if (measurementLabelRef.current) {
        measurementLabelRef.current.setMap(null);
        measurementLabelRef.current = null;
      }
    }
  }, [existingQuoteItems.length, currentStep, measurementType]);

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
    <div className={`flex flex-col w-full ${isConfigurationMode ? 'h-full' : 'h-screen'}`}>
      {/* Header with Search and Title */}
      <div ref={headerRef} className={`${!isConfigurationMode ? 'sticky top-0' : ''} bg-background border-b px-4 sm:px-6 py-1 z-20 shadow-md`}>
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 sm:gap-4 max-w-7xl mx-auto">
          <h2 className="text-xl sm:text-2xl font-semibold text-foreground">
            Measure Your Project
          </h2>
          <div className="flex items-center gap-2 w-full sm:flex-1 sm:max-w-2xl">
            <AddressAutocomplete
              value={searchAddress}
              onAddressSelect={(address: ParsedAddress) => {
                const fullAddress = `${address.streetAddress}, ${address.city}, ${address.state} ${address.zipCode}`;
                setSearchAddress(fullAddress);
                
                // Notify parent component about address selection
                onAddressSelect?.(address);
                
                if (mapRef.current && window.google) {
                  const geocoder = new google.maps.Geocoder();
                  geocoder.geocode({ address: fullAddress }, (results, status) => {
                    if (status === 'OK' && results && results[0]) {
                      const location = results[0].geometry.location;
                      mapRef.current?.setCenter(location);
                      mapRef.current?.setZoom(22);
                    }
                  });
                }
              }}
              onInputChange={(value: string) => setSearchAddress(value)}
              placeholder="Search for an address..."
            />
          </div>
        </div>
      </div>

      {/* Map Section */}
      <div className="relative flex-1 w-full overflow-hidden min-h-[500px]">
        <div 
          ref={mapContainerCallbackRef}
          className="w-full h-full absolute inset-0"
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

        {/* Keyboard Shortcuts Help - Top Left */}
        {!mapLoading && !mapError && !isConfigurationMode && (
          <div className="hidden md:block absolute top-4 left-4 z-10 bg-background/95 backdrop-blur-sm rounded-lg shadow-lg border px-3 py-2">
            <div className="flex items-center gap-4 text-xs text-muted-foreground">
              <div className="flex items-center gap-1.5">
                <kbd className="px-1.5 py-0.5 bg-muted rounded border text-xs">M</kbd>
                <span>Manual</span>
              </div>
              <div className="flex items-center gap-1.5">
                <kbd className="px-1.5 py-0.5 bg-muted rounded border text-xs">ESC</kbd>
                <span>Cancel</span>
              </div>
              {measurementType === 'point' && pointLocations.length > 0 && (
                <>
                  <div className="flex items-center gap-1.5">
                    <kbd className="px-1.5 py-0.5 bg-muted rounded border text-xs">⌫</kbd>
                    <span>Remove</span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <kbd className="px-1.5 py-0.5 bg-muted rounded border text-xs">Enter</kbd>
                    <span>Finish</span>
                  </div>
                </>
              )}
            </div>
          </div>
        )}

        {/* Point Placement Controls */}
        {measurementType === 'point' && pointLocations.length > 0 && !currentMeasurement && (
          <div className="absolute bottom-4 left-1/2 -translate-x-1/2 z-10 bg-background border rounded-lg shadow-lg p-4 flex gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={removeLastPoint}
            >
              <Undo2 className="mr-2 h-4 w-4" />
              Remove Last
            </Button>
            
            <Button
              variant="outline"
              size="sm"
              onClick={clearAllPoints}
            >
              Clear All
            </Button>
            
            <Button
              variant="success"
              size="sm"
              onClick={() => setIsDrawing(false)}
            >
              Done ({pointLocations.length})
            </Button>
          </div>
        )}

        {/* Manual Entry Modal */}
        {showManualEntry && (
          <div className="absolute inset-0 bg-background/80 backdrop-blur-sm flex items-center justify-center z-30">
            <div className="bg-background border-2 rounded-lg shadow-2xl p-6 max-w-md w-full mx-4">
              <h3 className="text-lg font-semibold mb-4">
                {measurementType === 'point' ? 'Enter Quantity' : 'Enter Measurement'}
              </h3>
              <div className="flex gap-2 mb-4">
                <Input
                  type="number"
                  placeholder={measurementType === 'point' ? 'Enter quantity' : `Enter ${unitLabel}`}
                  value={manualValue}
                  onChange={(e) => setManualValue(e.target.value)}
                  min="0"
                  step={measurementType === 'point' ? '1' : '0.01'}
                  className="flex-1"
                  autoFocus
                />
                <span className="flex items-center text-sm text-muted-foreground">
                  {measurementType === 'point' ? 'items' : unitAbbr}
                </span>
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
      </div>

      {/* Unified Action Buttons - Mobile Responsive */}
      {!mapLoading && !mapError && currentStep === 'measurement' && (
        <div id="measurement-action-buttons" className="bg-background border-t px-3 sm:px-6 py-2">
          <div className="max-w-7xl mx-auto">
            <div className="flex flex-wrap justify-center gap-2 sm:gap-3">
              {/* Always show navigation buttons first */}
              {!isConfigurationMode && (
                <>
                  <Button
                    variant="outline"
                    size="default"
                    onClick={onChangeProduct}
                    className="flex-1 sm:flex-none sm:w-auto min-w-[140px] gap-2"
                  >
                    <ArrowLeft className="h-4 w-4" />
                    Switch Product
                  </Button>
                  {measurementType !== 'dimensional' && (
                    <Button
                      variant="outline"
                      size="default"
                      onClick={() => {
                        setShowManualEntry(true);
                        clearMapDrawing();
                      }}
                      className="flex-1 sm:flex-none sm:w-auto min-w-[140px] gap-2"
                    >
                      <PencilRuler className="h-4 w-4" />
                      Enter Manually
                    </Button>
                  )}
                </>
              )}
              
              {/* Show Remeasure when measurement exists */}
              {currentMeasurement && (
                <Button
                  variant="outline"
                  size="lg"
                  onClick={handleUndo}
                  className="flex-1 sm:flex-none sm:w-auto min-w-[140px] px-4 sm:px-6 shadow-lg gap-2"
                >
                  <Undo2 className="h-4 w-4" />
                  Remeasure
                </Button>
              )}
              
              {/* Show Next when measurement is complete and not in configuration mode */}
              {currentMeasurement && !isConfigurationMode && (
                <Button
                  variant="success"
                  size="lg"
                  onClick={() => {
                    console.log('📤 NEXT button clicked, passing measurement to widget:', currentMeasurement);
                    if (currentMeasurement) {
                      onMeasurementComplete(currentMeasurement);
                    }
                    onNext();
                  }}
                  disabled={currentMeasurement.value === 0}
                  className="flex-1 sm:flex-none sm:w-auto min-w-[160px] px-4 sm:px-8 shadow-lg gap-2 sm:gap-3"
                >
                  <span>NEXT</span>
                  <span className="text-success-foreground/90 font-semibold">
                    ({currentMeasurement.value.toLocaleString()} {currentMeasurement.type === 'area' ? 'sq ft' : currentMeasurement.type === 'linear' ? 'ft' : 'items'})
                  </span>
                </Button>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default MeasurementTools;
