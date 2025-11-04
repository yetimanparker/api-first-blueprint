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
