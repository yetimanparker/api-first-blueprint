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
  
  if (zoomLevel <= 10) return 10;
  if (zoomLevel <= 12) return 11;
  if (zoomLevel <= 14) return 12;
  if (zoomLevel <= 16) return 14;
  if (zoomLevel <= 18) return 15;
  if (zoomLevel <= 20) return 16;
  return 17;
}
