/**
 * IMPORTANT: When adding new map rendering features, ensure they are applied to ALL map locations:
 * 1. src/components/widget/MeasurementTools.tsx - Widget measurement tool
 * 2. src/components/widget/QuoteSuccess.tsx - Quote confirmation page
 * 3. src/components/crm/QuoteDetailView.tsx - CRM quote detail view
 * 4. src/components/quote/MeasurementMap.tsx - General measurement map component
 * 
 * Use helper functions from this file to maintain consistency across all rendering locations.
 */

/**
 * Calculate font size for map labels based on zoom level
 * This ensures labels scale proportionally with the map
 * 
 * @param zoomLevel - Current map zoom level (typically 1-22)
 * @returns Font size in pixels
 */
export function getZoomBasedFontSize(zoomLevel: number): number {
  // Scale font size based on zoom level
  // Lower zoom (zoomed out) = smaller text
  // Higher zoom (zoomed in) = larger text
  // Cap at 12px for full zoom to prevent oversized labels
  
  if (zoomLevel <= 10) return 8;
  if (zoomLevel <= 12) return 9;
  if (zoomLevel <= 14) return 10;
  if (zoomLevel <= 16) return 11;
  if (zoomLevel <= 18) return 12;
  // Cap at 12px even for zoom levels above 18
  return 12;
}

/**
 * Calculate marker scale based on zoom level
 * This ensures markers maintain the same relative size on the map
 * 
 * @param zoomLevel - Current map zoom level (typically 1-22)
 * @returns Scale value for marker icon
 */
export function getZoomBasedMarkerScale(zoomLevel: number): number {
  // Scale marker size based on zoom level to maintain relative size on map
  // Lower zoom (zoomed out) = smaller marker
  // Higher zoom (zoomed in) = larger marker
  
  if (zoomLevel <= 10) return 3;
  if (zoomLevel <= 12) return 4;
  if (zoomLevel <= 14) return 5;
  if (zoomLevel <= 16) return 6;
  if (zoomLevel <= 18) return 7;
  if (zoomLevel <= 20) return 8;
  return 9;
}

/**
 * Render dimensional product side labels (width and length) on a Google Map
 * This ensures consistent display of dimensional measurements across all maps
 * 
 * @param map - Google Maps instance
 * @param coordinates - Array of 4 corner coordinates defining the rectangle
 * @param width - Width dimension in feet
 * @param length - Length dimension in feet
 * @param color - Color for the labels
 * @param currentZoom - Current map zoom level for font sizing
 * @returns Array of marker references [widthLabel, lengthLabel]
 */
export function renderDimensionalProductLabels(
  map: google.maps.Map,
  coordinates: Array<{lat: number, lng: number}>,
  width: number,
  length: number,
  color: string,
  currentZoom: number
): google.maps.Marker[] {
  // Calculate midpoints for width and length labels
  const topMid = {
    lat: (coordinates[0].lat + coordinates[1].lat) / 2,
    lng: (coordinates[0].lng + coordinates[1].lng) / 2
  };
  const rightMid = {
    lat: (coordinates[1].lat + coordinates[2].lat) / 2,
    lng: (coordinates[1].lng + coordinates[2].lng) / 2
  };
  
  // Create width label (top side)
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
    zIndex: 1
  });
  
  // Create length label (right side)
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
    zIndex: 1
  });
  
  return [widthLabel, lengthLabel];
}

/**
 * Calculate distance between two lat/lng points in feet using Haversine formula
 * 
 * @param point1 - First coordinate {lat, lng}
 * @param point2 - Second coordinate {lat, lng}
 * @returns Distance in feet
 */
export function calculateDistanceInFeet(
  point1: {lat: number, lng: number},
  point2: {lat: number, lng: number}
): number {
  const R = 20925721.784; // Earth's radius in feet
  const dLat = (point2.lat - point1.lat) * Math.PI / 180;
  const dLng = (point2.lng - point1.lng) * Math.PI / 180;
  
  const a = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(point1.lat * Math.PI / 180) * Math.cos(point2.lat * Math.PI / 180) *
    Math.sin(dLng / 2) * Math.sin(dLng / 2);
  
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  const distance = R * c;
  
  return distance;
}

/**
 * Calculate a midpoint offset perpendicular to an edge
 * This positions labels away from the line so they don't overlap with nodes
 * 
 * @param point1 - First coordinate {lat, lng}
 * @param point2 - Second coordinate {lat, lng}
 * @param offsetMeters - Distance to offset in meters (default: 8)
 * @returns Offset midpoint position
 */
export function calculateOffsetMidpoint(
  point1: {lat: number, lng: number},
  point2: {lat: number, lng: number},
  offsetMeters: number = 5
): {lat: number, lng: number} {
  // Calculate midpoint
  const midLat = (point1.lat + point2.lat) / 2;
  const midLng = (point1.lng + point2.lng) / 2;
  
  // Direction vector along the segment
  const dx = point2.lng - point1.lng;
  const dy = point2.lat - point1.lat;
  
  // Get length of vector
  const length = Math.sqrt(dx * dx + dy * dy);
  if (length === 0) return { lat: midLat, lng: midLng };
  
  // Perpendicular vector (rotate 90°): for (dx, dy), perpendicular is (-dy, dx)
  // Normalize it
  const perpLng = -dy / length;
  const perpLat = dx / length;
  
  // Convert offset from meters to degrees
  // 1 degree latitude ≈ 111,320 meters
  // 1 degree longitude ≈ 111,320 * cos(lat) meters
  const latRadians = midLat * Math.PI / 180;
  const metersPerDegreeLat = 111320;
  const metersPerDegreeLng = 111320 * Math.cos(latRadians);
  
  // Apply small offset perpendicular to the line
  return {
    lat: midLat + perpLat * (offsetMeters / metersPerDegreeLat),
    lng: midLng + perpLng * (offsetMeters / metersPerDegreeLng)
  };
}

/**
 * Render edge measurements (distance labels) between nodes of a polygon or polyline
 * 
 * @param map - Google Maps instance
 * @param coordinates - Array of coordinates defining the shape
 * @param color - Color for the labels
 * @param currentZoom - Current map zoom level for font sizing
 * @param isClosedShape - Whether to connect last point to first (true for polygons)
 * @returns Array of marker references for edge labels
 */
export function renderEdgeMeasurements(
  map: google.maps.Map,
  coordinates: Array<{lat: number, lng: number}>,
  color: string,
  currentZoom: number,
  isClosedShape: boolean = true
): google.maps.Marker[] {
  const edgeLabels: google.maps.Marker[] = [];
  
  // Calculate and render label for each edge
  for (let i = 0; i < coordinates.length; i++) {
    const point1 = coordinates[i];
    const point2 = isClosedShape 
      ? coordinates[(i + 1) % coordinates.length]  // Wrap to start for closed shapes
      : coordinates[i + 1];  // Don't wrap for open shapes (polylines)
    
    // Skip if point2 doesn't exist (end of polyline)
    if (!point2) continue;
    
    // Calculate distance in feet
    const distanceFeet = calculateDistanceInFeet(point1, point2);
    
    // Skip very small edges (< 0.5 ft)
    if (distanceFeet < 0.5) continue;
    
    // Position label at midpoint with small perpendicular offset (2 meters)
    const labelPosition = calculateOffsetMidpoint(point1, point2, 2);
    
    // Format distance with appropriate precision
    let distanceText: string;
    if (distanceFeet < 1) {
      distanceText = `${distanceFeet.toFixed(1)} ft`;
    } else if (distanceFeet < 10) {
      distanceText = `${Math.round(distanceFeet * 10) / 10} ft`;
    } else {
      distanceText = `${Math.round(distanceFeet)} ft`;
    }
    
    // Create edge label marker
    const edgeLabel = new google.maps.Marker({
      position: labelPosition,
      map: map,
      icon: {
        path: google.maps.SymbolPath.CIRCLE,
        scale: 0,
      },
      label: {
        text: distanceText,
        color: color,
        fontSize: `${getZoomBasedFontSize(currentZoom)}px`,
        fontWeight: '500',
      },
      zIndex: 2
    });
    
    edgeLabels.push(edgeLabel);
  }
  
  return edgeLabels;
}
