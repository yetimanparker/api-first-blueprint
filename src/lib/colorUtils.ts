// Predefined distinct colors that work well on maps
export const DISTINCT_ADDON_COLORS = [
  '#10B981', // green
  '#F59E0B', // amber
  '#EF4444', // red
  '#8B5CF6', // purple
  '#EC4899', // pink
  '#14B8A6', // teal
  '#F97316', // orange
  '#06B6D4', // cyan
  '#84CC16', // lime
  '#A855F7', // violet
  '#F43F5E', // rose
  '#0EA5E9', // sky
];

// Convert hex color to RGB values
function hexToRgb(hex: string): { r: number; g: number; b: number } | null {
  const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
  return result
    ? {
        r: parseInt(result[1], 16),
        g: parseInt(result[2], 16),
        b: parseInt(result[3], 16),
      }
    : null;
}

// Calculate Euclidean distance between two colors in RGB space
export function calculateColorDistance(color1: string, color2: string): number {
  const rgb1 = hexToRgb(color1);
  const rgb2 = hexToRgb(color2);
  
  if (!rgb1 || !rgb2) return 0;
  
  // Euclidean distance in RGB space
  return Math.sqrt(
    Math.pow(rgb1.r - rgb2.r, 2) +
    Math.pow(rgb1.g - rgb2.g, 2) +
    Math.pow(rgb1.b - rgb2.b, 2)
  );
}

// Minimum distance threshold - colors closer than this are considered "too similar"
const MIN_COLOR_DISTANCE = 80;

/**
 * Get a visually distinct color that's different from all used colors
 * @param usedColors - Array of hex colors already in use
 * @returns A hex color string that's visually distinct from used colors
 */
export function getDistinctAddonColor(usedColors: string[]): string {
  // Normalize used colors to lowercase for comparison
  const normalizedUsedColors = usedColors.map(c => c.toLowerCase());
  
  // Find the best available color from our predefined set
  let bestColor = DISTINCT_ADDON_COLORS[0];
  let bestMinDistance = 0;
  
  for (const candidateColor of DISTINCT_ADDON_COLORS) {
    // Check if this exact color is already used
    if (normalizedUsedColors.includes(candidateColor.toLowerCase())) {
      continue;
    }
    
    // Calculate minimum distance to any used color
    let minDistanceToUsed = Infinity;
    for (const usedColor of normalizedUsedColors) {
      const distance = calculateColorDistance(candidateColor, usedColor);
      if (distance < minDistanceToUsed) {
        minDistanceToUsed = distance;
      }
    }
    
    // If no used colors, use the first available
    if (normalizedUsedColors.length === 0) {
      return candidateColor;
    }
    
    // Track the color with the greatest minimum distance (most distinct)
    if (minDistanceToUsed > bestMinDistance) {
      bestMinDistance = minDistanceToUsed;
      bestColor = candidateColor;
    }
  }
  
  // If best color is still too similar, generate a random distinct color
  if (bestMinDistance < MIN_COLOR_DISTANCE && normalizedUsedColors.length > 0) {
    return generateRandomDistinctColor(normalizedUsedColors);
  }
  
  return bestColor;
}

/**
 * Generate a random color that's distinct from all used colors
 */
function generateRandomDistinctColor(usedColors: string[]): string {
  let attempts = 0;
  const maxAttempts = 50;
  
  while (attempts < maxAttempts) {
    // Generate random HSL color with good saturation and lightness for visibility
    const hue = Math.floor(Math.random() * 360);
    const saturation = 60 + Math.floor(Math.random() * 30); // 60-90%
    const lightness = 45 + Math.floor(Math.random() * 15); // 45-60%
    
    const color = hslToHex(hue, saturation, lightness);
    
    // Check if distinct enough from all used colors
    let isDistinct = true;
    for (const usedColor of usedColors) {
      if (calculateColorDistance(color, usedColor) < MIN_COLOR_DISTANCE) {
        isDistinct = false;
        break;
      }
    }
    
    if (isDistinct) {
      return color;
    }
    
    attempts++;
  }
  
  // Fallback - return a random color from our list
  return DISTINCT_ADDON_COLORS[Math.floor(Math.random() * DISTINCT_ADDON_COLORS.length)];
}

/**
 * Convert HSL to Hex color
 */
function hslToHex(h: number, s: number, l: number): string {
  s /= 100;
  l /= 100;
  
  const c = (1 - Math.abs(2 * l - 1)) * s;
  const x = c * (1 - Math.abs((h / 60) % 2 - 1));
  const m = l - c / 2;
  
  let r = 0, g = 0, b = 0;
  
  if (0 <= h && h < 60) {
    r = c; g = x; b = 0;
  } else if (60 <= h && h < 120) {
    r = x; g = c; b = 0;
  } else if (120 <= h && h < 180) {
    r = 0; g = c; b = x;
  } else if (180 <= h && h < 240) {
    r = 0; g = x; b = c;
  } else if (240 <= h && h < 300) {
    r = x; g = 0; b = c;
  } else if (300 <= h && h < 360) {
    r = c; g = 0; b = x;
  }
  
  const toHex = (n: number) => {
    const hex = Math.round((n + m) * 255).toString(16);
    return hex.length === 1 ? '0' + hex : hex;
  };
  
  return `#${toHex(r)}${toHex(g)}${toHex(b)}`.toUpperCase();
}
