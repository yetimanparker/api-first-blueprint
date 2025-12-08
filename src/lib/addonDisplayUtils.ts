import { formatExactPrice } from '@/lib/priceUtils';

export interface AddonDisplayConfig {
  name: string;
  priceValue: number;
  priceType: 'fixed' | 'percentage';
  calculationType: string;
  quantity: number;
  selectedOption?: string;
  selectedOptionPriceAdjustment?: number;
}

export interface ProductContext {
  totalQuantity: number;
  unitPrice: number;
  unitType: string;
  variations?: Array<{
    height_value?: number | null;
    unit_of_measurement?: string;
    affects_area_calculation?: boolean;
  }>;
}

export interface PriceSettings {
  currency_symbol: string;
  decimal_precision: number;
}

export interface AddonDisplayResult {
  displayName: string;
  displayEquation: string;
  total: number;
}

// Get unit abbreviation consistently
export function getUnitAbbreviation(unitType: string): string {
  const abbreviations: Record<string, string> = {
    'sq_ft': 'SF',
    'linear_ft': 'LF',
    'cubic_yard': 'CY',
    'each': 'ea',
  };
  return abbreviations[unitType] || unitType;
}

/**
 * Calculate addon display information consistently across all quote views
 */
export function calculateAddonDisplay(
  addon: AddonDisplayConfig,
  product: ProductContext,
  settings: PriceSettings
): AddonDisplayResult {
  const displayName = addon.selectedOption 
    ? `${addon.name} (${addon.selectedOption})`
    : addon.name;
  
  // Calculate effective addon price including option adjustment
  const effectiveAddonPrice = addon.priceValue + (addon.selectedOptionPriceAdjustment || 0);
  const unitAbbr = getUnitAbbreviation(product.unitType);
  const baseProdTotal = product.totalQuantity * product.unitPrice;
  
  // Handle percentage addons
  if (addon.priceType === 'percentage') {
    const addonTotal = (baseProdTotal * effectiveAddonPrice / 100) * addon.quantity;
    const qtyMultiplier = addon.quantity > 1 ? ` × ${addon.quantity}` : '';
    
    return {
      displayName,
      displayEquation: `${effectiveAddonPrice}% of ${formatExactPrice(baseProdTotal, settings)}${qtyMultiplier}`,
      total: addonTotal
    };
  }
  
  // Handle area_calculation type
  if (addon.calculationType === 'area_calculation') {
    const variation = product.variations?.[0];
    if (variation?.height_value && variation.affects_area_calculation) {
      const linearFeet = product.totalQuantity;
      const heightFeet = variation.height_value;
      const area = linearFeet * heightFeet;
      const addonTotal = effectiveAddonPrice * area * addon.quantity;
      const qtyMultiplier = addon.quantity > 1 ? `${addon.quantity} × ` : '';
      
      return {
        displayName,
        displayEquation: `${qtyMultiplier}${area.toLocaleString()} SF × ${formatExactPrice(effectiveAddonPrice, settings)}/SF`,
        total: addonTotal
      };
    }
  }
  
  // Handle per_unit type - addon applies per parent product unit
  if (addon.calculationType === 'per_unit') {
    const displayQty = product.totalQuantity;
    const addonTotal = effectiveAddonPrice * displayQty * addon.quantity;
    const qtyMultiplier = addon.quantity > 1 ? `${addon.quantity} × ` : '';
    
    return {
      displayName,
      displayEquation: `${qtyMultiplier}${displayQty.toLocaleString()} ${unitAbbr} × ${formatExactPrice(effectiveAddonPrice, settings)}/${unitAbbr}`,
      total: addonTotal
    };
  }
  
  // Default: 'total' or other - flat price per addon quantity
  const addonTotal = effectiveAddonPrice * addon.quantity;
  const qtyMultiplier = addon.quantity > 1 ? `${addon.quantity} × ` : '';
  
  return {
    displayName,
    displayEquation: `${qtyMultiplier}${formatExactPrice(effectiveAddonPrice, settings)}`,
    total: addonTotal
  };
}
