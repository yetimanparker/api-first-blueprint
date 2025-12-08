import { formatExactPrice } from '@/lib/priceUtils';

export interface VariationInput {
  name?: string;
  priceAdjustment: number;
  adjustmentType: 'fixed' | 'percentage';
  height_value?: number | null;
  unit_of_measurement?: string;
  affects_area_calculation?: boolean;
}

export interface ProductPriceContext {
  baseUnitPrice: number;
  quantity: number;
  unitType: string;
  variations?: VariationInput[];
}

export interface PriceSettings {
  currency_symbol: string;
  decimal_precision: number;
}

export interface ProductPriceResult {
  adjustedUnitPrice: number;  // Base + variation adjustments
  totalPrice: number;         // quantity × adjustedUnitPrice
  displayEquation: string;    // "45 LF × $35.00/LF = $1,575.00"
}

/**
 * Get unit abbreviation consistently across all views
 */
export function getUnitAbbreviation(unitType: string): string {
  const abbreviations: Record<string, string> = {
    'sq_ft': 'SF',
    'linear_ft': 'LF',
    'cubic_yard': 'cu yd',
    'each': 'ea',
    'hour': 'hr',
    'pound': 'lb',
    'ton': 'ton',
    'pallet': 'pallet'
  };
  return abbreviations[unitType] || unitType?.replace('_', ' ') || 'unit';
}

/**
 * Calculate variation-adjusted unit price from base price and variations
 */
export function calculateAdjustedUnitPrice(
  baseUnitPrice: number,
  variations?: VariationInput[]
): number {
  let adjustedPrice = baseUnitPrice;
  
  if (variations && variations.length > 0) {
    variations.forEach((variation) => {
      if (variation.adjustmentType === 'percentage') {
        adjustedPrice += baseUnitPrice * (variation.priceAdjustment / 100);
      } else {
        // fixed
        adjustedPrice += variation.priceAdjustment;
      }
    });
  }
  
  return adjustedPrice;
}

/**
 * Calculate complete product pricing with variation adjustments
 * Use this as the single source of truth for all quote display views
 */
export function calculateProductPrice(
  product: ProductPriceContext,
  settings: PriceSettings
): ProductPriceResult {
  const adjustedUnitPrice = calculateAdjustedUnitPrice(product.baseUnitPrice, product.variations);
  const totalPrice = product.quantity * adjustedUnitPrice;
  const unitAbbr = getUnitAbbreviation(product.unitType);
  
  const displayEquation = `${product.quantity.toLocaleString()} ${unitAbbr} × ${formatExactPrice(adjustedUnitPrice, settings)}/${unitAbbr} = ${formatExactPrice(totalPrice, settings)}`;
  
  return {
    adjustedUnitPrice,
    totalPrice,
    displayEquation
  };
}
