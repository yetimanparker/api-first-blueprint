import { useEffect, useRef, useState } from "react";
import { loadGoogleMapsAPI } from "@/lib/googleMapsLoader";
import { getZoomBasedFontSize, getZoomBasedMarkerScale, renderDimensionalProductLabels } from "@/lib/mapLabelUtils";

interface MeasurementMapProps {
  measurements: Array<{
    type: 'area' | 'linear' | 'point';
    coordinates?: number[][];
    segments?: number[][][]; // Multiple independent segment coordinate arrays
    pointLocations?: Array<{lat: number; lng: number}>;
    productName: string;
    productColor: string;
    value: number;
    unit: string;
    isDimensional?: boolean;
    dimensions?: {
      width: number;
      length: number;
      unit: string;
    };
  }>;
  center?: { lat: number; lng: number };
  className?: string;
}

export default function MeasurementMap({ measurements, center, className = "" }: MeasurementMapProps) {
  const mapRef = useRef<HTMLDivElement>(null);
  const mapInstanceRef = useRef<google.maps.Map | null>(null);
  const pointMarkersRef = useRef<google.maps.Marker[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [currentZoom, setCurrentZoom] = useState(18);

  useEffect(() => {
    const initMap = async () => {
      try {
        console.log('MeasurementMap: Starting map initialization');
        
        // Load Google Maps API using shared loader
        console.log('MeasurementMap: Loading Google Maps API');
        await loadGoogleMapsAPI();

        if (!mapRef.current) return;

        // Calculate bounds from all measurements
        const bounds = new google.maps.LatLngBounds();
        let hasCoordinates = false;

        measurements.forEach(measurement => {
          // Process segments (for multi-segment area/linear)
          if (measurement.segments && measurement.segments.length > 0) {
            measurement.segments.forEach(segment => {
              segment.forEach(([lat, lng]) => {
                bounds.extend({ lat, lng });
                hasCoordinates = true;
              });
            });
          }
          // Process coordinates (for area/linear)
          else if (measurement.coordinates && measurement.coordinates.length > 0) {
            measurement.coordinates.forEach(([lat, lng]) => {
              bounds.extend({ lat, lng });
              hasCoordinates = true;
            });
          }
          // Process pointLocations (for point/each)
          if (measurement.pointLocations && measurement.pointLocations.length > 0) {
            measurement.pointLocations.forEach(({lat, lng}) => {
              bounds.extend({ lat, lng });
              hasCoordinates = true;
            });
          }
        });

        // Use provided center or default to first coordinate
        let mapCenter = center;
        if (!mapCenter && hasCoordinates) {
          const firstCoord = measurements.find(m => m.coordinates && m.coordinates.length > 0)?.coordinates?.[0];
          if (firstCoord) {
            mapCenter = { lat: firstCoord[0], lng: firstCoord[1] };
          }
        }

        const map = new google.maps.Map(mapRef.current, {
          zoom: 18,
          center: mapCenter || { lat: 39.8283, lng: -98.5795 }, // Center of US as fallback
          mapTypeId: 'satellite',
          mapTypeControl: true,
          streetViewControl: false,
        });

        mapInstanceRef.current = map;

        // Track zoom changes for dynamic font and marker sizing
        map.addListener('zoom_changed', () => {
          const newZoom = map.getZoom();
          if (newZoom) {
            setCurrentZoom(newZoom);
            // Update point marker scales
            const newScale = getZoomBasedMarkerScale(newZoom);
            pointMarkersRef.current.forEach(marker => {
              const currentIcon = marker.getIcon() as google.maps.Symbol;
              if (currentIcon) {
                marker.setIcon({
                  ...currentIcon,
                  scale: newScale,
                });
              }
            });
          }
        });

        // Track marker numbers by product name for consistent numbering
        const markerCounters: Record<string, number> = {};

        // Draw measurements
        measurements.forEach((measurement, index) => {
          // Skip if no location data
          const hasSegments = measurement.segments && measurement.segments.length > 0;
          const hasCoords = measurement.coordinates && measurement.coordinates.length > 0;
          const hasPoints = measurement.pointLocations && measurement.pointLocations.length > 0;
          
          if (!hasSegments && !hasCoords && !hasPoints) {
            return;
          }

          const color = measurement.productColor || '#3B82F6';

          if (measurement.type === 'area') {
            // Determine segments to render
            const segmentsToRender = hasSegments 
              ? measurement.segments! 
              : hasCoords ? [measurement.coordinates!] : [];

            segmentsToRender.forEach((segmentCoords, segIdx) => {
              const path = segmentCoords.map(([lat, lng]) => ({ lat, lng }));

              // Draw polygon for area measurements
              const polygon = new google.maps.Polygon({
                paths: path,
                strokeColor: color,
                strokeOpacity: 0.8,
                strokeWeight: 3,
                fillColor: color,
                fillOpacity: 0.35,
                map: map,
              });

              // Add center label with total area (only on first segment)
              if (segIdx === 0) {
                const center = getPolygonCenter(path);
                new google.maps.Marker({
                  position: center,
                  map: map,
                  icon: { path: google.maps.SymbolPath.CIRCLE, scale: 0 },
                  label: {
                    text: `${measurement.value.toLocaleString()} sq ft`,
                    color: color,
                    fontSize: `${getZoomBasedFontSize(currentZoom)}px`,
                    fontWeight: 'bold',
                  },
                });

                // Add side dimension labels for dimensional products
                if (measurement.isDimensional && measurement.dimensions) {
                  renderDimensionalProductLabels(
                    map,
                    path,
                    measurement.dimensions.width,
                    measurement.dimensions.length,
                    color,
                    currentZoom
                  );
                }
              }
            });
          } else if (measurement.type === 'linear') {
            // Determine segments to render
            const segmentsToRender = hasSegments 
              ? measurement.segments! 
              : hasCoords ? [measurement.coordinates!] : [];

            segmentsToRender.forEach((segmentCoords, segIdx) => {
              const path = segmentCoords.map(([lat, lng]) => ({ lat, lng }));

              // Draw polyline for linear measurements
              const polyline = new google.maps.Polyline({
                path: path,
                strokeColor: color,
                strokeOpacity: 0.8,
                strokeWeight: 4,
                map: map,
              });

              // Calculate this segment's total length
              let segmentTotalLength = 0;
              for (let i = 0; i < path.length - 1; i++) {
                const edgeDistance = google.maps.geometry.spherical.computeLength([path[i], path[i + 1]]);
                segmentTotalLength += edgeDistance * 3.28084; // Convert to feet
              }

              // Add vertex markers at each point
              path.forEach((point, idx) => {
                new google.maps.Marker({
                  position: point,
                  map: map,
                  icon: {
                    path: google.maps.SymbolPath.CIRCLE,
                    scale: 6,
                    fillColor: color,
                    fillOpacity: 1,
                    strokeColor: '#ffffff',
                    strokeWeight: 2,
                  },
                });
              });

              // Add edge measurements for multi-point lines (only if >2 points in this segment)
              if (path.length > 2) {
                for (let i = 0; i < path.length - 1; i++) {
                  const edgeDistance = google.maps.geometry.spherical.computeLength([path[i], path[i + 1]]);
                  const edgeDistanceFt = edgeDistance * 3.28084;
                  
                  const midLat = (path[i].lat + path[i + 1].lat) / 2;
                  const midLng = (path[i].lng + path[i + 1].lng) / 2;
                  
                  new google.maps.Marker({
                    position: { lat: midLat, lng: midLng },
                    map: map,
                    icon: { path: google.maps.SymbolPath.CIRCLE, scale: 0 },
                    label: {
                      text: `${edgeDistanceFt.toFixed(1)} ft`,
                      color: color,
                      fontSize: `${Math.max(11, getZoomBasedFontSize(currentZoom) - 2)}px`,
                      fontWeight: 'normal',
                    },
                  });
                }
              }

              // Add segment total label at middle of this segment's path
              const midIndex = Math.floor(path.length / 2);
              
              new google.maps.Marker({
                position: path[midIndex],
                map: map,
                icon: { path: google.maps.SymbolPath.CIRCLE, scale: 0 },
                label: {
                  text: `${Math.round(segmentTotalLength).toLocaleString()} ft`,
                  color: color,
                  fontSize: `${getZoomBasedFontSize(currentZoom)}px`,
                  fontWeight: 'bold',
                },
              });
            });
          } else if (measurement.type === 'point') {
            // Draw markers for point measurements (e.g., individual trees)
            const pointPath = measurement.pointLocations || [];
            
            // Initialize counter for this product if not exists
            if (!markerCounters[measurement.productName]) {
              markerCounters[measurement.productName] = 0;
            }
            
            pointPath.forEach((position) => {
              markerCounters[measurement.productName]++;
              const markerNumber = markerCounters[measurement.productName];
              
              const marker = new google.maps.Marker({
                position: position,
                map: map,
                icon: {
                  path: google.maps.SymbolPath.CIRCLE,
                  scale: getZoomBasedMarkerScale(currentZoom),
                  fillColor: color,
                  fillOpacity: 1,
                  strokeColor: '#ffffff',
                  strokeWeight: 2,
                },
                label: {
                  text: `${markerNumber}`,
                  color: '#ffffff',
                  fontSize: '11px',
                  fontWeight: 'normal',
                },
              });
              pointMarkersRef.current.push(marker);

              const infoWindow = new google.maps.InfoWindow({
                content: `
                  <div style="padding: 8px;">
                    <strong>${measurement.productName}</strong><br/>
                    Location ${markerNumber}
                  </div>
                `,
              });

              marker.addListener('click', () => {
                infoWindow.open(map, marker);
              });
            });
          }
        });

        // Fit bounds if we have coordinates with padding
        if (hasCoordinates) {
          map.fitBounds(bounds, {
            top: 50,
            bottom: 50,
            left: 50,
            right: 50
          });
          
          // Set a max zoom level to prevent being too close
          const listener = google.maps.event.addListener(map, 'idle', () => {
            if (map.getZoom()! > 20) {
              map.setZoom(20);
            }
            google.maps.event.removeListener(listener);
          });
        }

        setLoading(false);
      } catch (err) {
        console.error('Error initializing map:', err);
        setError('Failed to load map');
        setLoading(false);
      }
    };

    initMap();
  }, [measurements, center]);

  // Helper function to calculate polygon center
  const getPolygonCenter = (path: google.maps.LatLngLiteral[]) => {
    let lat = 0;
    let lng = 0;
    path.forEach(point => {
      lat += point.lat;
      lng += point.lng;
    });
    return { lat: lat / path.length, lng: lng / path.length };
  };

  if (error) {
    return (
      <div className={`rounded-lg border bg-muted/50 flex items-center justify-center p-8 ${className}`}>
        <p className="text-muted-foreground">{error}</p>
      </div>
    );
  }

  return (
    <div className={`relative rounded-lg overflow-hidden border ${className}`}>
      {loading && (
        <div className="absolute inset-0 flex items-center justify-center bg-background/80 z-10">
          <p className="text-muted-foreground">Loading map...</p>
        </div>
      )}
      <div ref={mapRef} className="w-full h-full min-h-[400px]" />
    </div>
  );
}