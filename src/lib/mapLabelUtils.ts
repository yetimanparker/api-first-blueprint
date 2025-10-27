/**
 * Calculate font size for map labels based on zoom level
 * This ensures labels scale proportionally with the map
 * 
 * @param zoomLevel - Current map zoom level (typically 1-22)
 * @returns Font size in pixels
 */
export function getZoomBasedFontSize(zoomLevel: number): number {
  // Scale font size based on zoom level - larger sizes for better readability
  // Lower zoom (zoomed out) = smaller text
  // Higher zoom (zoomed in) = larger text
  // Cap at 20px for full zoom for excellent readability
  
  if (zoomLevel <= 10) return 12;
  if (zoomLevel <= 12) return 14;
  if (zoomLevel <= 14) return 16;
  if (zoomLevel <= 16) return 18;
  if (zoomLevel <= 18) return 20;
  // Cap at 20px for excellent readability
  return 20;
}
