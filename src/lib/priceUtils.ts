export interface PriceRangeSettings {
  use_price_ranges: boolean;
  price_range_percentage: number;
  price_range_display_format: 'percentage' | 'dollar_amounts';
  currency_symbol: string;
  decimal_precision: number;
}

export interface PriceRange {
  lower: number;
  upper: number;
  original: number;
}

export function calculatePriceRange(
  basePrice: number, 
  percentage: number
): PriceRange {
  const lower = Math.round(basePrice * (1 - percentage / 100));
  const upper = Math.round(basePrice * (1 + percentage / 100));
  
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
  const { currency_symbol, decimal_precision, price_range_display_format, price_range_percentage } = settings;
  
  const formatPrice = (amount: number) => {
    return `${currency_symbol}${amount.toLocaleString(undefined, {
      minimumFractionDigits: decimal_precision,
      maximumFractionDigits: decimal_precision
    })}`;
  };

  const lowerFormatted = formatPrice(range.lower);
  const upperFormatted = formatPrice(range.upper);

  if (price_range_display_format === 'percentage') {
    return `${lowerFormatted} - ${upperFormatted} (±${price_range_percentage}%)`;
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
    const range = calculatePriceRange(basePrice, settings.price_range_percentage);
    return formatPriceRange(range, settings);
  } else {
    return formatExactPrice(basePrice, settings);
  }
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