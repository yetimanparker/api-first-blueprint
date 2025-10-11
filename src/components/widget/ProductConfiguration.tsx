import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { Plus, Minus, Package, Loader2, Trash2, Calculator } from 'lucide-react';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { supabase } from '@/integrations/supabase/client';
import { QuoteItem, MeasurementData, ProductVariation, ProductAddon } from '@/types/widget';
import { GlobalSettings } from '@/hooks/useGlobalSettings';
import { 
  calculateTieredPrice, 
  calculateAddonWithAreaData, 
  applyGlobalMarkup, 
  formatExactPrice 
} from '@/lib/priceUtils';

interface Product {
  id: string;
  name: string;
  description?: string;
  unit_type: string;
  unit_price: number;
  use_tiered_pricing: boolean;
  min_order_quantity: number;
  color_hex: string;
}

interface Variation {
  id: string;
  name: string;
  description?: string;
  price_adjustment: number;
  adjustment_type: 'fixed' | 'percentage';
  height_value?: number;
  unit_of_measurement?: string;
  affects_area_calculation?: boolean;
}

interface Addon {
  id: string;
  name: string;
  description?: string;
  price_value: number;
  calculation_type: 'total' | 'per_unit';
  price_type: string;
}

interface PricingTier {
  id: string;
  min_quantity: number;
  max_quantity?: number;
  tier_price: number;
  tier_name: string;
}

interface ProductConfigurationProps {
  productId: string;
  measurement: MeasurementData;
  onAddToQuote: (item: QuoteItem) => void;
  settings: GlobalSettings;
  onRemove?: () => void;
}

const ProductConfiguration = ({ 
  productId, 
  measurement, 
  onAddToQuote, 
  settings,
  onRemove
}: ProductConfigurationProps) => {
  const [product, setProduct] = useState<Product | null>(null);
  const [variations, setVariations] = useState<Variation[]>([]);
  const [addons, setAddons] = useState<Addon[]>([]);
  const [pricingTiers, setPricingTiers] = useState<PricingTier[]>([]);
  const [loading, setLoading] = useState(true);
  
  const [selectedVariation, setSelectedVariation] = useState<string>('');
  const [selectedAddons, setSelectedAddons] = useState<Record<string, number>>({});
  const [notes, setNotes] = useState('');
  const [isAdded, setIsAdded] = useState(false);

  useEffect(() => {
    fetchProductData();
  }, [productId]);

  const fetchProductData = async () => {
    try {
      setLoading(true);
      
      const { data: productData, error: productError } = await supabase
        .from('products')
        .select('*')
        .eq('id', productId)
        .single();

      if (productError) throw productError;
      setProduct(productData);

      const { data: variationsData } = await supabase
        .from('product_variations')
        .select('*')
        .eq('product_id', productId)
        .eq('is_active', true)
        .order('display_order');

      setVariations((variationsData || []) as Variation[]);

      const { data: addonsData } = await supabase
        .from('product_addons')
        .select('*')
        .eq('product_id', productId)
        .eq('is_active', true)
        .order('display_order');

      setAddons((addonsData || []) as Addon[]);

      if (productData.use_tiered_pricing) {
        const { data: tiersData } = await supabase
          .from('product_pricing_tiers')
          .select('*')
          .eq('product_id', productId)
          .eq('is_active', true)
          .order('display_order');

        setPricingTiers(tiersData || []);
      }

    } catch (error) {
      console.error('Error fetching product data:', error);
    } finally {
      setLoading(false);
    }
  };

  const calculateItemPrice = () => {
    if (!product) return 0;

    let basePrice = product.unit_price;
    let quantity = measurement.value;

    // If depth is provided for volume-based products (sq_yd), calculate cubic yards
    if (measurement.depth && measurement.type === 'area') {
      // Convert: sq ft × depth (inches) / 324 = cubic yards
      // 324 = 12 inches/foot × 27 cubic feet/cubic yard
      quantity = (measurement.value * measurement.depth) / 324;
    }

    if (product.use_tiered_pricing && pricingTiers.length > 0) {
      const simplifiedTiers: any[] = pricingTiers.map(tier => ({
        min_quantity: tier.min_quantity,
        max_quantity: tier.max_quantity,
        tier_price: tier.tier_price
      }));
      basePrice = calculateTieredPrice(quantity, simplifiedTiers, product.unit_price);
    }

    if (selectedVariation) {
      const variation = variations.find(v => v.id === selectedVariation);
      if (variation) {
        if (variation.adjustment_type === 'percentage') {
          basePrice += basePrice * (variation.price_adjustment / 100);
        } else {
          basePrice += variation.price_adjustment;
        }
        
        if (variation.affects_area_calculation && variation.height_value) {
          if (measurement.type === 'area') {
            quantity = quantity * variation.height_value;
          }
        }
      }
    }

    let subtotal = basePrice * quantity;

    Object.entries(selectedAddons).forEach(([addonId, addonQuantity]) => {
      if (addonQuantity > 0) {
        const addon = addons.find(a => a.id === addonId);
        if (addon) {
          const addonPrice = calculateAddonWithAreaData(
            addon.price_value,
            quantity,
            addon.calculation_type
          );
          subtotal += addonPrice * addonQuantity;
        }
      }
    });

    return subtotal;
  };

  const handleAddToQuote = () => {
    if (!product) return;

    const selectedVariationObjects: ProductVariation[] = [];
    if (selectedVariation) {
      const variation = variations.find(v => v.id === selectedVariation);
      if (variation) {
        selectedVariationObjects.push({
          id: variation.id,
          name: variation.name,
          priceAdjustment: variation.price_adjustment,
          adjustmentType: variation.adjustment_type
        });
      }
    }

    const selectedAddonObjects: ProductAddon[] = Object.entries(selectedAddons)
      .filter(([_, quantity]) => quantity > 0)
      .map(([addonId, quantity]) => {
        const addon = addons.find(a => a.id === addonId)!;
        return {
          id: addon.id,
          name: addon.name,
          priceValue: addon.price_value,
          calculationType: addon.calculation_type,
          quantity
        };
      });

    // Create measurement with variations and addons nested inside
    const measurementWithOptions: MeasurementData = {
      ...measurement,
      variations: selectedVariationObjects.length > 0 ? selectedVariationObjects : undefined,
      addons: selectedAddonObjects.length > 0 ? selectedAddonObjects : undefined
    };

    const quoteItem: QuoteItem = {
      id: Date.now().toString(),
      productId: product.id,
      productName: product.name,
      measurement: measurementWithOptions,
      unitPrice: product.unit_price,
      quantity: measurement.value,
      lineTotal: calculateItemPrice(),
      notes: notes || undefined
    };

    onAddToQuote(quoteItem);
    setIsAdded(true);
  };


  const updateAddonQuantity = (addonId: string, quantity: number) => {
    setSelectedAddons(prev => ({
      ...prev,
      [addonId]: Math.max(0, quantity)
    }));
  };

  if (loading) {
    return (
      <div className="w-full h-screen flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!product) {
    return (
      <div className="max-w-4xl mx-auto px-4 py-12 text-center">
        <Package className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
        <p className="text-muted-foreground">Product not found</p>
      </div>
    );
  }

  const lineTotal = calculateItemPrice();
  const selectedVariationObj = selectedVariation ? variations.find(v => v.id === selectedVariation) : null;

  if (isAdded) {
    return null;
  }

  return (
    <div className="w-full bg-background">
      {/* Main Content */}
      <div className="max-w-7xl mx-auto px-6 py-6 space-y-6">
      {/* Configure Product Options Section */}
      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            <Calculator className="h-5 w-5 text-primary" />
            <CardTitle>Configure Product Options</CardTitle>
          </div>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Variations Dropdown */}
          {variations.length > 0 && (
            <div className="space-y-2">
              <Label htmlFor="variation-select" className="text-base font-semibold">
                Select Height for {product.name}
              </Label>
              <Select value={selectedVariation} onValueChange={setSelectedVariation}>
                <SelectTrigger id="variation-select" className="w-full">
                  <SelectValue placeholder="Select a height option" />
                </SelectTrigger>
                <SelectContent>
                  {variations.map((variation) => (
                    <SelectItem key={variation.id} value={variation.id}>
                      {variation.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}

          {/* Add-ons Section */}
          {addons.length > 0 && (
            <div className="space-y-4">
              <h3 className="text-base font-semibold">Available Add-ons</h3>
              <div className="space-y-3">
                {addons.map((addon) => (
                  <div key={addon.id} className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 sm:gap-4 p-3 border rounded-lg bg-card">
                    <div className="flex-1">
                      <p className="font-medium">{addon.name}</p>
                      <p className="text-xs text-muted-foreground">
                        {formatExactPrice(addon.price_value, {
                          currency_symbol: settings.currency_symbol,
                          decimal_precision: settings.decimal_precision
                        })} per {addon.calculation_type === 'per_unit' ? 'unit' : 'each'}
                      </p>
                    </div>
                    <div className="flex items-center gap-2 justify-end sm:justify-start flex-shrink-0">
                      <Button
                        size="icon"
                        variant="outline"
                        onClick={() => updateAddonQuantity(addon.id, (selectedAddons[addon.id] || 0) - 1)}
                        disabled={(selectedAddons[addon.id] || 0) <= 0}
                        className="h-8 w-8"
                      >
                        <Minus className="h-3 w-3" />
                      </Button>
                      <span className="w-6 text-center text-sm font-semibold">
                        {selectedAddons[addon.id] || 0}
                      </span>
                      <Button
                        size="icon"
                        variant="outline"
                        onClick={() => updateAddonQuantity(addon.id, (selectedAddons[addon.id] || 0) + 1)}
                        className="h-8 w-8"
                      >
                        <Plus className="h-3 w-3" />
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Product Summary Card at Bottom */}
      <Card className="border-l-4 shadow-sm" style={{ borderLeftColor: product.color_hex }}>
        <CardContent className="p-6">
          <div className="space-y-4">
            {/* Product Header */}
            <div className="flex items-start gap-3">
              <div 
                className="w-3 h-3 rounded-full flex-shrink-0 mt-1.5"
                style={{ backgroundColor: product.color_hex }}
              />
              <div className="flex-1">
                <h3 className="font-semibold text-lg">{product.name}</h3>
                <p className="text-sm text-muted-foreground">
                  {measurement.value.toLocaleString()} {measurement.unit.replace('_', ' ')}
                  {measurement.depth && ` × ${measurement.depth}" depth`}
                  {measurement.depth && ` = ${((measurement.value * measurement.depth) / 324).toFixed(2)} cubic yards`}
                </p>
              </div>
            </div>

            {/* Itemized Pricing Breakdown */}
            {settings.pricing_visibility === 'before_submit' && !settings.use_price_ranges && (
              <div className="space-y-2 pl-6">
                {/* Base Price */}
                <div className="flex justify-between items-center text-sm">
                  <span className="text-muted-foreground">
                    Base Price ({measurement.value.toLocaleString()} {measurement.unit.replace('_', ' ')} × {formatExactPrice(product.unit_price, {
                      currency_symbol: settings.currency_symbol,
                      decimal_precision: settings.decimal_precision
                    })})
                  </span>
                  <span className="font-medium">
                    {formatExactPrice(product.unit_price * measurement.value, {
                      currency_symbol: settings.currency_symbol,
                      decimal_precision: settings.decimal_precision
                    })}
                  </span>
                </div>

                {/* Variation Adjustment */}
                {selectedVariationObj && (
                  <div className="flex justify-between items-center text-sm">
                    <span className="text-muted-foreground">
                      {selectedVariationObj.name} {selectedVariationObj.adjustment_type === 'percentage' 
                        ? `(+${selectedVariationObj.price_adjustment}%)`
                        : `(+${formatExactPrice(selectedVariationObj.price_adjustment, {
                            currency_symbol: settings.currency_symbol,
                            decimal_precision: settings.decimal_precision
                          })})`
                      }
                    </span>
                    <span className="font-medium text-primary">
                      +{formatExactPrice(
                        selectedVariationObj.adjustment_type === 'percentage'
                          ? (product.unit_price * measurement.value * selectedVariationObj.price_adjustment / 100)
                          : (selectedVariationObj.price_adjustment * measurement.value),
                        {
                          currency_symbol: settings.currency_symbol,
                          decimal_precision: settings.decimal_precision
                        }
                      )}
                    </span>
                  </div>
                )}

                {/* Add-ons */}
                {Object.entries(selectedAddons)
                  .filter(([_, quantity]) => quantity > 0)
                  .map(([addonId, addonQuantity]) => {
                    const addon = addons.find(a => a.id === addonId);
                    if (!addon) return null;
                    
                    let quantity = measurement.value;
                    if (selectedVariationObj?.affects_area_calculation && selectedVariationObj.height_value) {
                      if (measurement.type === 'area') {
                        quantity = quantity * selectedVariationObj.height_value;
                      }
                    }

                    const addonPrice = calculateAddonWithAreaData(
                      addon.price_value,
                      quantity,
                      addon.calculation_type
                    );
                    const addonTotal = addonPrice * addonQuantity;

                    return (
                      <div key={addonId} className="flex justify-between items-center text-sm">
                        <span className="text-muted-foreground">
                          {addon.name} {addonQuantity > 1 ? `(×${addonQuantity})` : ''}
                        </span>
                        <span className="font-medium text-primary">
                          +{formatExactPrice(addonTotal, {
                            currency_symbol: settings.currency_symbol,
                            decimal_precision: settings.decimal_precision
                          })}
                        </span>
                      </div>
                    );
                  })}

                <Separator className="my-2" />

                {/* Total */}
                <div className="flex justify-between items-center">
                  <span className="font-semibold">Total</span>
                  <span className="text-2xl font-bold text-green-600">
                    {formatExactPrice(lineTotal, {
                      currency_symbol: settings.currency_symbol,
                      decimal_precision: settings.decimal_precision
                    })}
                  </span>
                </div>
              </div>
            )}
            
            {settings.pricing_visibility === 'after_submit' && (
              <div className="space-y-2 pl-6">
                <p className="text-sm text-muted-foreground">
                  Pricing will be shown after you submit your quote request
                </p>
              </div>
            )}

            {/* Action Buttons */}
            <div className="flex flex-col sm:flex-row gap-2 sm:gap-3 pt-4">
              <Button variant="destructive" size="lg" className="flex-1 w-full" onClick={onRemove}>
                <Trash2 className="h-4 w-4 mr-2" />
                Remove
              </Button>
              <Button onClick={handleAddToQuote} variant="success" size="lg" className="flex-1 w-full">
                <Plus className="h-4 w-4 mr-2" />
                Add to Quote
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>
      </div>
    </div>
  );
};

export default ProductConfiguration;