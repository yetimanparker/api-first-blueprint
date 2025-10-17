export interface PriceRangeSettings {
  use_price_ranges: boolean;
  price_range_lower_percentage: number;
  price_range_upper_percentage: number;
  price_range_display_format: 'percentage' | 'dollar_amounts';
  currency_symbol: string;
  decimal_precision: number;
}

export interface PricingTier {
  id: string;
  tier_name: string;
  min_quantity: number;
  max_quantity: number | null;
  tier_price: number;
  is_active: boolean;
  display_order: number;
}

export interface PriceRange {
  lower: number;
  upper: number;
  original: number;
}

export function calculatePriceRange(
  basePrice: number, 
  lowerPercentage: number,
  upperPercentage: number
): PriceRange {
  const lower = Math.round(basePrice * (1 - lowerPercentage / 100));
  const upper = Math.round(basePrice * (1 + upperPercentage / 100));
  
  return {
    lower,
    upper,
    original: basePrice
  };
}

export function formatPriceRange(
  range: PriceRange,
  settings: PriceRangeSettings
): string {
  const { currency_symbol, decimal_precision, price_range_display_format, price_range_lower_percentage, price_range_upper_percentage } = settings;
  
  const formatPrice = (amount: number) => {
    return `${currency_symbol}${amount.toLocaleString(undefined, {
      minimumFractionDigits: decimal_precision,
      maximumFractionDigits: decimal_precision
    })}`;
  };

  const lowerFormatted = formatPrice(range.lower);
  const upperFormatted = formatPrice(range.upper);

  if (price_range_display_format === 'percentage') {
    return `${lowerFormatted} - ${upperFormatted} (-${price_range_lower_percentage}% / +${price_range_upper_percentage}%)`;
  } else {
    return `${lowerFormatted} - ${upperFormatted}`;
  }
}

export function formatExactPrice(
  price: number,
  settings: Pick<PriceRangeSettings, 'currency_symbol' | 'decimal_precision'>
): string {
  return `${settings.currency_symbol}${price.toLocaleString(undefined, {
    minimumFractionDigits: settings.decimal_precision,
    maximumFractionDigits: settings.decimal_precision
  })}`;
}

export function displayPrice(
  basePrice: number,
  settings: PriceRangeSettings
): string {
  if (settings.use_price_ranges) {
    const range = calculatePriceRange(basePrice, settings.price_range_lower_percentage, settings.price_range_upper_percentage);
    return formatPriceRange(range, settings);
  } else {
    return formatExactPrice(basePrice, settings);
  }
}

export function displayQuoteTotal(
  basePrice: number,
  settings: PriceRangeSettings,
  quoteStatus: string = 'draft'
): string {
  // Only show price ranges for submitted quotes (not draft)
  const isSubmittedQuote = ['pending', 'accepted', 'declined', 'expired'].includes(quoteStatus);
  
  if (settings.use_price_ranges && isSubmittedQuote) {
    const range = calculatePriceRange(basePrice, settings.price_range_lower_percentage, settings.price_range_upper_percentage);
    return formatPriceRange(range, settings);
  } else {
    return formatExactPrice(basePrice, settings);
  }
}

export function displayLineItemPrice(
  basePrice: number,
  settings: PriceRangeSettings
): string {
  // Always show exact prices for line items
  return formatExactPrice(basePrice, settings);
}

export function applyGlobalMarkup(
  basePrice: number,
  markupPercentage: number
): number {
  return basePrice * (1 + markupPercentage / 100);
}

export function applyGlobalTax(
  price: number,
  taxRate: number
): number {
  return price * (1 + taxRate / 100);
}

export function calculateAreaWithHeight(
  baseQuantity: number,
  heightValue?: number | null,
  unitOfMeasurement: string = "ft"
): number {
  if (!heightValue) return baseQuantity;
  
  // Convert height to feet if needed for consistent calculation
  let heightInFeet = heightValue;
  if (unitOfMeasurement === "inches") {
    heightInFeet = heightValue / 12;
  } else if (unitOfMeasurement === "m") {
    heightInFeet = heightValue * 3.28084;
  } else if (unitOfMeasurement === "cm") {
    heightInFeet = heightValue * 0.0328084;
  }
  
  return baseQuantity * heightInFeet;
}

export function calculateAddonWithAreaData(
  addonPrice: number,
  baseQuantity: number,
  calculationType: string,
  variationData?: {
    height?: number | null;
    unit?: string;
    affects_area_calculation?: boolean;
  },
  productData?: {
    base_height?: number | null;
    base_height_unit?: string;
    use_height_in_calculation?: boolean;
  }
): number {
  if (calculationType === "area_calculation") {
    // Priority 1: Use variation height if available
    if (variationData?.affects_area_calculation && variationData.height) {
      const totalArea = calculateAreaWithHeight(baseQuantity, variationData.height, variationData.unit);
      return addonPrice * totalArea;
    }
    
    // Priority 2: Use base product height if enabled
    if (productData?.use_height_in_calculation && productData.base_height) {
      const totalArea = calculateAreaWithHeight(baseQuantity, productData.base_height, productData.base_height_unit || 'ft');
      return addonPrice * totalArea;
    }
    
    // Priority 3: No height calculation, use base quantity
    return addonPrice * baseQuantity;
  }
  
  // Default calculation for non-area based add-ons
  if (calculationType === "per_unit") {
    return addonPrice * baseQuantity;
  }
  
  // For "total" calculation type
  return addonPrice;
}

/**
 * Calculate quantity considering base product height or variation height
 * Priority: Variation height > Base product height > Original measurement
 */
export function calculateQuantityWithBaseHeight(
  baseQuantity: number,
  product: { 
    base_height?: number | null;
    base_height_unit?: string;
    use_height_in_calculation?: boolean;
  },
  selectedVariation?: {
    height_value?: number | null;
    unit_of_measurement?: string;
    affects_area_calculation?: boolean;
  }
): number {
  // Priority 1: Variation height (if selected and affects calculation)
  if (selectedVariation?.affects_area_calculation && selectedVariation?.height_value) {
    return calculateAreaWithHeight(
      baseQuantity, 
      selectedVariation.height_value, 
      selectedVariation.unit_of_measurement || 'ft'
    );
  }
  
  // Priority 2: Base product height (if enabled)
  if (product.use_height_in_calculation && product.base_height) {
    return calculateAreaWithHeight(
      baseQuantity,
      product.base_height,
      product.base_height_unit || 'ft'
    );
  }
  
  // Priority 3: Original measurement (no height applied)
  return baseQuantity;
}

export function calculateTieredPrice(
  quantity: number,
  tiers: PricingTier[],
  fallbackPrice: number
): number {
  if (!tiers.length) return fallbackPrice;
  
  const applicableTier = tiers
    .filter(tier => tier.is_active)
    .sort((a, b) => a.min_quantity - b.min_quantity)
    .find(tier => 
      quantity >= tier.min_quantity && 
      (tier.max_quantity === null || quantity <= tier.max_quantity)
    );
  
  return applicableTier ? applicableTier.tier_price : fallbackPrice;
}

export function getTierForQuantity(
  quantity: number,
  tiers: PricingTier[]
): PricingTier | null {
  if (!tiers.length) return null;
  
  return tiers
    .filter(tier => tier.is_active)
    .sort((a, b) => a.min_quantity - b.min_quantity)
    .find(tier => 
      quantity >= tier.min_quantity && 
      (tier.max_quantity === null || quantity <= tier.max_quantity)
    ) || null;
}

export function formatTierInfo(
  tier: PricingTier,
  settings: Pick<PriceRangeSettings, 'currency_symbol' | 'decimal_precision'>
): string {
  const { currency_symbol, decimal_precision } = settings;
  const price = `${currency_symbol}${tier.tier_price.toLocaleString(undefined, {
    minimumFractionDigits: decimal_precision,
    maximumFractionDigits: decimal_precision
  })}`;
  
  const range = tier.max_quantity 
    ? `${tier.min_quantity}-${tier.max_quantity}`
    : `${tier.min_quantity}+`;
    
  return `${tier.tier_name}: ${range} @ ${price}`;
}

export function validateTiers(tiers: PricingTier[]): string[] {
  const errors: string[] = [];
  const sortedTiers = [...tiers].sort((a, b) => a.min_quantity - b.min_quantity);
  
  for (let i = 0; i < sortedTiers.length; i++) {
    const tier = sortedTiers[i];
    
    // Check for gaps or overlaps
    if (i > 0) {
      const prevTier = sortedTiers[i - 1];
      if (prevTier.max_quantity !== null && prevTier.max_quantity < tier.min_quantity - 1) {
        errors.push(`Gap between ${prevTier.tier_name} and ${tier.tier_name}`);
      }
      if (prevTier.max_quantity !== null && prevTier.max_quantity >= tier.min_quantity) {
        errors.push(`Overlap between ${prevTier.tier_name} and ${tier.tier_name}`);
      }
    }
    
    // Check for invalid ranges
    if (tier.max_quantity !== null && tier.max_quantity <= tier.min_quantity) {
      errors.push(`${tier.tier_name}: max quantity must be greater than min quantity`);
    }
  }
  
  return errors;
}

export function displayTieredPrice(
  quantity: number,
  basePrice: number,
  tiers: PricingTier[],
  useTieredPricing: boolean,
  settings: PriceRangeSettings
): string {
  if (useTieredPricing && tiers.length > 0) {
    const tieredPrice = calculateTieredPrice(quantity, tiers, basePrice);
    return formatExactPrice(tieredPrice, settings);
  } else {
    return displayPrice(basePrice, settings);
  }
}

export function calculateFinalPrice(
  basePrice: number,
  markupPercentage: number = 0,
  taxRate: number = 0
): number {
  let finalPrice = basePrice;
  
  // Apply markup first
  if (markupPercentage > 0) {
    finalPrice = applyGlobalMarkup(finalPrice, markupPercentage);
  }
  
  // Then apply tax
  if (taxRate > 0) {
    finalPrice = applyGlobalTax(finalPrice, taxRate);
  }
  
  return Math.round(finalPrice * 100) / 100; // Round to 2 decimal places
}

/**
 * Calculate price with required variation applied
 */
export function calculatePriceWithVariation(
  basePrice: number,
  variation: {
    price_adjustment: number;
    adjustment_type: 'fixed' | 'percentage';
  }
): number {
  if (variation.adjustment_type === 'percentage') {
    return basePrice * (1 + variation.price_adjustment / 100);
  } else {
    return basePrice + variation.price_adjustment;
  }
}

/**
 * Get minimum price for product with required variations
 */
export function getMinimumProductPrice(
  basePrice: number,
  variations: Array<{
    is_required?: boolean;
    price_adjustment: number;
    adjustment_type: 'fixed' | 'percentage';
  }>
): number {
  const requiredVariations = variations.filter(v => v.is_required);
  
  if (requiredVariations.length === 0) {
    return basePrice;
  }
  
  // Find the lowest-priced required variation
  const lowestPrice = requiredVariations.reduce((min, variation) => {
    const price = calculatePriceWithVariation(basePrice, variation);
    return Math.min(min, price);
  }, Infinity);
  
  return lowestPrice;
}