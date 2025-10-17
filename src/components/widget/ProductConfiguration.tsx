import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
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
  formatExactPrice,
  calculateQuantityWithBaseHeight
} from '@/lib/priceUtils';

interface Product {
  id: string;
  name: string;
  description?: string;
  unit_type: string;
  unit_price: number;
  use_tiered_pricing: boolean;
  min_order_quantity: number;
  base_height?: number | null;
  base_height_unit?: string;
  use_height_in_calculation?: boolean;
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
  calculation_type: 'total' | 'per_unit' | 'area_calculation';
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
  const [depth, setDepth] = useState<string>(measurement.depth?.toString() || '');
  const [isAdded, setIsAdded] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Check if product is volume-based
  const isVolumeBased = product && (
    product.unit_type.toLowerCase().includes('cubic') || 
    product.unit_type.toLowerCase().includes('cu_') || 
    product.unit_type.toLowerCase().includes('yard')
  );

  // Check if product is 'each' type (point measurement)
  const isEachType = measurement.type === 'point';

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

    // If depth is provided for volume-based products, calculate cubic yards
    const depthValue = parseFloat(depth);
    if (depthValue && !isNaN(depthValue) && isVolumeBased && measurement.type === 'area') {
      // Convert: sq ft × depth (inches) / 324 = cubic yards
      // 324 = 12 inches/foot × 27 cubic feet/cubic yard
      quantity = (measurement.value * depthValue) / 324;
    }
    // Base product uses raw measurement value (linear feet, square feet, etc.)
    // Height calculation is only applied to add-ons with 'area_calculation' type

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
      }
    }

    let subtotal = basePrice * quantity;

    Object.entries(selectedAddons).forEach(([addonId, addonQuantity]) => {
      if (addonQuantity > 0) {
        const addon = addons.find(a => a.id === addonId);
        if (addon) {
          // For area-based addons, use the original measurement value (linear feet)
          // For per-unit addons on volume products, use the calculated cubic yards
          let addonBaseQuantity = measurement.value;
          
          if (addon.calculation_type !== 'area_calculation') {
            const depthValue = parseFloat(depth);
            if (depthValue && !isNaN(depthValue) && isVolumeBased && measurement.type === 'area') {
              addonBaseQuantity = (measurement.value * depthValue) / 324;
            }
          }
          
          // Get variation data directly from the selected variation
          const variation = selectedVariation ? variations.find(v => v.id === selectedVariation) : null;
          const variationData = variation ? {
            height: variation.height_value || null,
            unit: variation.unit_of_measurement || 'ft',
            affects_area_calculation: variation.affects_area_calculation || false
          } : undefined;
          
          const addonPrice = calculateAddonWithAreaData(
            addon.price_value,
            addonBaseQuantity,
            addon.calculation_type,
            variationData,
            {
              base_height: product.base_height,
              base_height_unit: product.base_height_unit,
              use_height_in_calculation: product.use_height_in_calculation
            }
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
          adjustmentType: variation.adjustment_type,
          height_value: variation.height_value,
          unit_of_measurement: variation.unit_of_measurement,
          affects_area_calculation: variation.affects_area_calculation
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
    const depthValue = parseFloat(depth);
    
    // Calculate the actual quantity (convert to cubic yards if depth is provided)
    let actualQuantity = measurement.value;
    if (depthValue && !isNaN(depthValue) && isVolumeBased && measurement.type === 'area') {
      actualQuantity = (measurement.value * depthValue) / 324;
    }
    
    const measurementWithOptions: MeasurementData = {
      ...measurement,
      depth: (depthValue && !isNaN(depthValue) && isVolumeBased) ? depthValue : undefined,
      variations: selectedVariationObjects.length > 0 ? selectedVariationObjects : undefined,
      addons: selectedAddonObjects.length > 0 ? selectedAddonObjects : undefined
    };

    const quoteItem: QuoteItem = {
      id: Date.now().toString(),
      productId: product.id,
      productName: product.name,
      measurement: measurementWithOptions,
      unitPrice: product.unit_price,
      quantity: actualQuantity,
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

  const formatPrice = (price: number) => {
    return price.toFixed(settings.decimal_precision || 2);
  };

  if (isAdded) {
    return null;
  }

  return (
    <div className="w-full bg-background">
      {/* Main Content */}
      <div className="max-w-7xl mx-auto px-6 py-3 space-y-6">
      {/* Configure Product Options Section */}
      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            <Calculator className="h-5 w-5 text-primary" />
            <CardTitle>Configure Product Options</CardTitle>
          </div>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Depth Input for Volume-Based Products */}
          {isVolumeBased && measurement.type === 'area' && (
            <div className="space-y-2 p-4 bg-muted/50 rounded-lg border-2 border-primary/20">
              <Label htmlFor="depth-input" className="text-base font-semibold text-primary">
                Depth (inches) *
              </Label>
              <Input
                id="depth-input"
                type="number"
                placeholder="Enter depth in inches"
                value={depth}
                onChange={(e) => setDepth(e.target.value)}
                min="0.1"
                step="0.5"
                className="text-lg"
                required
              />
              <p className="text-xs text-muted-foreground">
                Required for volume-based products
              </p>
            </div>
          )}

          {/* Variations Dropdown */}
          {variations.length > 0 && (
            <div className="space-y-2">
              <Label htmlFor="variation-select" className="text-base font-semibold">
                Select Option
              </Label>
              <Select value={selectedVariation} onValueChange={setSelectedVariation}>
                <SelectTrigger id="variation-select" className="w-full">
                  <SelectValue placeholder="Choose an option" />
                </SelectTrigger>
                <SelectContent className="bg-background border border-border shadow-lg z-50">
                  {variations.map((variation) => (
                    <SelectItem key={variation.id} value={variation.id}>
                      <span className="flex items-center justify-between w-full gap-3">
                        <span>{variation.name}</span>
                        <span className="text-muted-foreground text-sm font-medium">
                          {variation.adjustment_type === 'percentage' 
                            ? `+${variation.price_adjustment}%`
                            : `+${formatExactPrice(variation.price_adjustment, {
                                currency_symbol: settings.currency_symbol,
                                decimal_precision: settings.decimal_precision
                              })}`
                          }
                        </span>
                      </span>
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
       <Card className="border-l-4 shadow-sm border-primary">
         <CardContent className="p-6">
           <div className="space-y-3">
             {settings.pricing_visibility !== 'after_submit' && (
               <>
                 <div className="flex justify-between items-center">
                   <div className="flex-1">
                     <h3 className="font-semibold">{product.name}</h3>
                     <div className="text-sm text-muted-foreground">
                       {isEachType && `${measurement.value} ${measurement.value === 1 ? 'item' : 'items'}`}
                       {!isEachType && measurement.type === 'area' && !isVolumeBased && `${measurement.value.toFixed(2)} ${measurement.unit}`}
                       {!isEachType && measurement.type === 'linear' && `${measurement.value.toFixed(2)} ${measurement.unit}`}
                       {isVolumeBased && depth && `${((measurement.value * parseFloat(depth)) / 324).toFixed(2)} cu yd`}
                     </div>
                   </div>
                   <span className="font-semibold ml-4">
                     {settings.use_price_ranges 
                       ? `$${formatPrice(calculateItemPrice() * 0.8)} - $${formatPrice(calculateItemPrice() * 1.2)}`
                       : `$${formatPrice(calculateItemPrice())}`
                     }
                   </span>
                 </div>

                 {selectedVariation && (
                   <div className="pl-4 space-y-0.5">
                     {variations
                       .filter(v => v.id === selectedVariation)
                       .map(v => (
                         <div key={v.id} className="text-sm text-muted-foreground">• {v.name}</div>
                       ))}
                   </div>
                 )}

                 {Object.entries(selectedAddons).filter(([_, qty]) => qty > 0).length > 0 && (
                   <div className="space-y-1">
                     {Object.entries(selectedAddons)
                       .filter(([_, qty]) => qty > 0)
                       .map(([addonId, qty]) => {
                         const addon = addons.find(a => a.id === addonId)!;
                         const addonTotal = addon.price_value * qty;
                         return (
                           <div key={addonId} className="flex justify-between items-center text-sm pl-4">
                             <span className="text-muted-foreground">
                               {addon.name}
                               {addon.calculation_type === 'area_calculation' && measurement.type === 'area' 
                                 ? ` ${measurement.value.toFixed(0)} ${measurement.unit}`
                                 : qty > 1 
                                   ? ` (${qty})`
                                   : ''
                               }
                             </span>
                             <span className="text-muted-foreground">
                               {settings.use_price_ranges 
                                 ? `$${formatPrice(addonTotal * 0.8)} - $${formatPrice(addonTotal * 1.2)}`
                                 : `$${formatPrice(addonTotal)}`
                               }
                             </span>
                           </div>
                         );
                       })}
                   </div>
                 )}

                 <div className="flex justify-between items-center pt-2 border-t">
                   <span className="font-semibold">Total</span>
                   <span className="font-semibold">
                     {settings.use_price_ranges 
                       ? `$${formatPrice(calculateItemPrice() * 0.8)} - $${formatPrice(calculateItemPrice() * 1.2)}`
                       : `$${formatPrice(calculateItemPrice())}`
                     }
                   </span>
                 </div>
               </>
             )}
           </div>

           <div className="flex justify-between items-center gap-4 mt-6 pt-4 border-t">
             {onRemove && (
               <Button
                 onClick={onRemove}
                 variant="outline"
                 className="flex-1"
                 disabled={isSubmitting}
               >
                 <Trash2 className="h-4 w-4 mr-2" />
                 Remove
               </Button>
             )}
             <Button
               onClick={handleAddToQuote}
               className="flex-1"
               disabled={isSubmitting || (isVolumeBased && !depth)}
             >
               <Package className="h-4 w-4 mr-2" />
               Add to Quote
             </Button>
           </div>
         </CardContent>
       </Card>
      </div>
    </div>
  );
};

export default ProductConfiguration;