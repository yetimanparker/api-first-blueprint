import React, { useEffect, useRef, useState } from 'react';
import { useMap } from 'react-leaflet';
import L, { LatLng, LeafletMouseEvent } from 'leaflet';
import 'leaflet-draw';
import { Button } from '@/components/ui/button';
import { Square, Ruler, RotateCcw, Check } from 'lucide-react';
import { MeasurementData } from './MeasurementWidget';

interface MeasurementToolsProps {
  measurementType: 'area' | 'line';
  onMeasurementComplete: (measurement: MeasurementData) => void;
}

export const MeasurementTools: React.FC<MeasurementToolsProps> = ({
  measurementType,
  onMeasurementComplete
}) => {
  const map = useMap();
  const [isDrawing, setIsDrawing] = useState(false);
  const [currentShape, setCurrentShape] = useState<L.Layer | null>(null);
  const [measurement, setMeasurement] = useState<number>(0);
  const drawControl = useRef<L.Control.Draw | null>(null);
  const drawnItems = useRef(new L.FeatureGroup());

  useEffect(() => {
    // Add drawn items layer to map
    map.addLayer(drawnItems.current);

    // Initialize draw control
    const drawControlOptions: L.Control.DrawConstructorOptions = {
      position: 'topright' as L.ControlPosition,
      draw: {
        polyline: measurementType === 'line' ? {
          shapeOptions: {
            color: '#3B82F6',
            weight: 3
          }
        } as any : false,
        polygon: measurementType === 'area' ? {
          shapeOptions: {
            color: '#3B82F6',
            fillColor: '#3B82F6',
            fillOpacity: 0.2
          }
        } as any : false,
        circle: false,
        rectangle: false,
        marker: false,
        circlemarker: false
      },
      edit: {
        featureGroup: drawnItems.current,
        remove: true
      }
    };

    drawControl.current = new L.Control.Draw(drawControlOptions);
    map.addControl(drawControl.current);

    // Event handlers
    const onDrawCreated = (e: any) => {
      const layer = e.layer;
      drawnItems.current.addLayer(layer);
      setCurrentShape(layer);
      calculateMeasurement(layer);
      setIsDrawing(false);
    };

    const onDrawEdited = (e: any) => {
      e.layers.eachLayer((layer: L.Layer) => {
        calculateMeasurement(layer);
      });
    };

    const onDrawDeleted = () => {
      setCurrentShape(null);
      setMeasurement(0);
    };

    const onDrawStart = () => {
      setIsDrawing(true);
    };

    map.on(L.Draw.Event.CREATED, onDrawCreated);
    map.on(L.Draw.Event.EDITED, onDrawEdited);
    map.on(L.Draw.Event.DELETED, onDrawDeleted);
    map.on(L.Draw.Event.DRAWSTART, onDrawStart);

    // Cleanup
    return () => {
      map.off(L.Draw.Event.CREATED, onDrawCreated);
      map.off(L.Draw.Event.EDITED, onDrawEdited);
      map.off(L.Draw.Event.DELETED, onDrawDeleted);
      map.off(L.Draw.Event.DRAWSTART, onDrawStart);
      
      if (drawControl.current) {
        map.removeControl(drawControl.current);
      }
      map.removeLayer(drawnItems.current);
    };
  }, [map, measurementType]);

  const calculateMeasurement = (layer: L.Layer) => {
    let value = 0;
    let coordinates: LatLng[] = [];

    if (measurementType === 'area' && layer instanceof L.Polygon) {
      const latLngs = layer.getLatLngs()[0] as LatLng[];
      coordinates = latLngs;
      
      // Calculate area using spherical excess formula for accuracy
      const earthRadius = 20902231; // Earth radius in feet
      value = Math.abs(L.GeometryUtil.geodesicArea(latLngs)) * (earthRadius * earthRadius) / (1000000 * 1000000);
      value = Math.ceil(value); // Round up as per PRD
    } else if (measurementType === 'line' && layer instanceof L.Polyline) {
      const latLngs = layer.getLatLngs() as LatLng[];
      coordinates = latLngs;
      
      // Calculate total distance
      for (let i = 1; i < latLngs.length; i++) {
        value += latLngs[i - 1].distanceTo(latLngs[i]) * 3.28084; // Convert meters to feet
      }
      value = Math.ceil(value); // Round up as per PRD
    }

    setMeasurement(value);
  };

  const clearMeasurement = () => {
    drawnItems.current.clearLayers();
    setCurrentShape(null);
    setMeasurement(0);
    setIsDrawing(false);
  };

  const confirmMeasurement = () => {
    if (currentShape && measurement > 0) {
      const coordinates: LatLng[] = [];
      
      if (currentShape instanceof L.Polygon) {
        coordinates.push(...(currentShape.getLatLngs()[0] as LatLng[]));
      } else if (currentShape instanceof L.Polyline) {
        coordinates.push(...(currentShape.getLatLngs() as LatLng[]));
      }

      const measurementData: MeasurementData = {
        type: measurementType,
        value: measurement,
        coordinates,
        unit: measurementType === 'area' ? 'sq_ft' : 'linear_ft'
      };

      onMeasurementComplete(measurementData);
    }
  };

  return (
    <div className="absolute top-4 left-4 z-[1000] bg-background/95 backdrop-blur-sm rounded-lg shadow-lg p-3 space-y-2">
      {/* Measurement Display */}
      {measurement > 0 && (
        <div className="text-center p-2 bg-primary/10 rounded-md">
          <div className="text-lg font-semibold text-primary">
            {measurement.toLocaleString()} {measurementType === 'area' ? 'sq ft' : 'ft'}
          </div>
          <div className="text-xs text-muted-foreground">
            {measurementType === 'area' ? 'Total Area' : 'Total Length'}
          </div>
        </div>
      )}

      {/* Tool Status */}
      <div className="text-sm text-center">
        {isDrawing ? (
          <span className="text-primary">
            {measurementType === 'area' ? 'Drawing area...' : 'Drawing line...'}
          </span>
        ) : currentShape ? (
          <span className="text-success">Measurement complete</span>
        ) : (
          <span className="text-muted-foreground">
            {measurementType === 'area' 
              ? 'Click to start drawing area'
              : 'Click to start drawing line'
            }
          </span>
        )}
      </div>

      {/* Action Buttons */}
      <div className="flex gap-2">
        {currentShape && (
          <>
            <Button
              size="sm"
              variant="outline"
              onClick={clearMeasurement}
              className="flex-1"
            >
              <RotateCcw className="h-3 w-3 mr-1" />
              Clear
            </Button>
            <Button
              size="sm"
              onClick={confirmMeasurement}
              className="flex-1"
            >
              <Check className="h-3 w-3 mr-1" />
              Use This
            </Button>
          </>
        )}
      </div>

      {/* Instructions */}
      <div className="text-xs text-muted-foreground max-w-48">
        {measurementType === 'area' ? (
          <>
            Click points to create a polygon. Double-click to finish.
            You can edit by dragging points after creation.
          </>
        ) : (
          <>
            Click points to create a line. Double-click to finish.
            You can edit by dragging points after creation.
          </>
        )}
      </div>
    </div>
  );
};