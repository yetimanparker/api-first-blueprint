import { useEffect, useRef, useState } from "react";
import { loadGoogleMapsAPI } from "@/lib/googleMapsLoader";

interface MeasurementMapProps {
  measurements: Array<{
    type: 'area' | 'linear' | 'point';
    coordinates?: number[][];
    productName: string;
    productColor: string;
    value: number;
    unit: string;
  }>;
  center?: { lat: number; lng: number };
  className?: string;
}

export default function MeasurementMap({ measurements, center, className = "" }: MeasurementMapProps) {
  const mapRef = useRef<HTMLDivElement>(null);
  const mapInstanceRef = useRef<google.maps.Map | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

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
          if (measurement.coordinates && measurement.coordinates.length > 0) {
            measurement.coordinates.forEach(([lat, lng]) => {
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

        // Draw measurements
        measurements.forEach((measurement, index) => {
          if (!measurement.coordinates || measurement.coordinates.length === 0) return;

          const path = measurement.coordinates.map(([lat, lng]) => ({ lat, lng }));
          const color = measurement.productColor || '#3B82F6';

          if (measurement.type === 'area') {
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

            // Add info window
            const center = getPolygonCenter(path);
            const infoWindow = new google.maps.InfoWindow({
              content: `
                <div style="padding: 8px;">
                  <strong>${measurement.productName}</strong><br/>
                  ${measurement.value.toLocaleString()} ${measurement.unit}
                </div>
              `,
              position: center,
            });

            polygon.addListener('click', () => {
              infoWindow.open(map);
            });
          } else if (measurement.type === 'linear') {
            // Draw polyline for linear measurements
            const polyline = new google.maps.Polyline({
              path: path,
              strokeColor: color,
              strokeOpacity: 0.8,
              strokeWeight: 4,
              map: map,
            });

            // Add markers at endpoints
            new google.maps.Marker({
              position: path[0],
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

            new google.maps.Marker({
              position: path[path.length - 1],
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

            // Add info window at midpoint
            const midIndex = Math.floor(path.length / 2);
            const infoWindow = new google.maps.InfoWindow({
              content: `
                <div style="padding: 8px;">
                  <strong>${measurement.productName}</strong><br/>
                  ${measurement.value.toLocaleString()} ${measurement.unit}
                </div>
              `,
              position: path[midIndex],
            });

            polyline.addListener('click', () => {
              infoWindow.open(map);
            });
          } else if (measurement.type === 'point') {
            // Draw markers for point measurements (e.g., individual trees)
            path.forEach((position, idx) => {
              const marker = new google.maps.Marker({
                position: position,
                map: map,
                icon: {
                  path: google.maps.SymbolPath.CIRCLE,
                  scale: 8,
                  fillColor: color,
                  fillOpacity: 1,
                  strokeColor: '#ffffff',
                  strokeWeight: 2,
                },
                label: {
                  text: `${idx + 1}`,
                  color: '#ffffff',
                  fontSize: '11px',
                  fontWeight: 'bold',
                },
              });

              const infoWindow = new google.maps.InfoWindow({
                content: `
                  <div style="padding: 8px;">
                    <strong>${measurement.productName}</strong><br/>
                    Location ${idx + 1} of ${path.length}
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
