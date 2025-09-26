import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { Plus, Package, Calculator, Loader2 } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { QuoteItem, MeasurementData, ProductVariation, ProductAddon } from '@/types/widget';
import { GlobalSettings } from '@/hooks/useGlobalSettings';
import { 
  calculateTieredPrice, 
  calculateAddonWithAreaData, 
  applyGlobalMarkup, 
  displayPrice, 
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
}

const ProductConfiguration = ({ 
  productId, 
  measurement, 
  onAddToQuote, 
  settings 
}: ProductConfigurationProps) => {
  const [product, setProduct] = useState<Product | null>(null);
  const [variations, setVariations] = useState<Variation[]>([]);
  const [addons, setAddons] = useState<Addon[]>([]);
  const [pricingTiers, setPricingTiers] = useState<PricingTier[]>([]);
  const [loading, setLoading] = useState(true);
  
  const [selectedVariations, setSelectedVariations] = useState<string[]>([]);
  const [selectedAddons, setSelectedAddons] = useState<Record<string, number>>({});
  const [customName, setCustomName] = useState('');
  const [notes, setNotes] = useState('');

  useEffect(() => {
    fetchProductData();
  }, [productId]);

  const fetchProductData = async () => {
    try {
      setLoading(true);
      
      // Fetch product details
      const { data: productData, error: productError } = await supabase
        .from('products')
        .select('*')
        .eq('id', productId)
        .single();

      if (productError) throw productError;
      setProduct(productData);
      setCustomName(productData.name);

      // Fetch variations
      const { data: variationsData } = await supabase
        .from('product_variations')
        .select('*')
        .eq('product_id', productId)
        .eq('is_active', true)
        .order('display_order');

      setVariations((variationsData || []) as Variation[]);

      // Fetch addons
      const { data: addonsData } = await supabase
        .from('product_addons')
        .select('*')
        .eq('product_id', productId)
        .eq('is_active', true)
        .order('display_order');

      setAddons((addonsData || []) as Addon[]);

      // Fetch pricing tiers if tiered pricing is enabled
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

    // Apply tiered pricing if enabled
    if (product.use_tiered_pricing && pricingTiers.length > 0) {
      basePrice = calculateTieredPrice(quantity, pricingTiers, product.unit_price);
    }

    // Apply variations
    selectedVariations.forEach(variationId => {
      const variation = variations.find(v => v.id === variationId);
      if (variation) {
        if (variation.adjustment_type === 'percentage') {
          basePrice += basePrice * (variation.price_adjustment / 100);
        } else {
          basePrice += variation.price_adjustment;
        }
        
        // Handle area calculation effects
        if (variation.affects_area_calculation && variation.height_value) {
          // Recalculate quantity based on height
          if (measurement.type === 'area') {
            quantity = quantity * variation.height_value;
          }
        }
      }
    });

    let subtotal = basePrice * quantity;

    // Apply addons
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

    // Apply global markup
    if (settings.global_markup_percentage > 0) {
      subtotal = applyGlobalMarkup(subtotal, settings.global_markup_percentage);
    }

    return subtotal;
  };

  const handleAddToQuote = () => {
    if (!product) return;

    const selectedVariationObjects: ProductVariation[] = selectedVariations.map(variationId => {
      const variation = variations.find(v => v.id === variationId)!;
      return {
        id: variation.id,
        name: variation.name,
        priceAdjustment: variation.price_adjustment,
        adjustmentType: variation.adjustment_type
      };
    });

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

    const quoteItem: QuoteItem = {
      id: Date.now().toString(),
      productId: product.id,
      productName: product.name,
      measurement,
      unitPrice: product.unit_price,
      quantity: measurement.value,
      lineTotal: calculateItemPrice(),
      customName: customName || product.name,
      notes: notes || undefined,
      variations: selectedVariationObjects.length > 0 ? selectedVariationObjects : undefined,
      addons: selectedAddonObjects.length > 0 ? selectedAddonObjects : undefined
    };

    onAddToQuote(quoteItem);
  };

  const toggleVariation = (variationId: string) => {
    setSelectedVariations(prev => 
      prev.includes(variationId)
        ? prev.filter(id => id !== variationId)
        : [...prev, variationId]
    );
  };

  const updateAddonQuantity = (addonId: string, quantity: number) => {
    setSelectedAddons(prev => ({
      ...prev,
      [addonId]: Math.max(0, quantity)
    }));
  };

  if (loading) {
    return (
      <Card className="max-w-4xl mx-auto">
        <CardContent className="flex items-center justify-center py-12">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </CardContent>
      </Card>
    );
  }

  if (!product) {
    return (
      <Card className="max-w-4xl mx-auto">
        <CardContent className="text-center py-12">
          <Package className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
          <p className="text-muted-foreground">Product not found</p>
        </CardContent>
      </Card>
    );
  }

  const lineTotal = calculateItemPrice();

  return (
    <Card className="max-w-4xl mx-auto">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Calculator className="h-5 w-5 text-primary" />
          Configure Your Selection
        </CardTitle>
        <p className="text-sm text-muted-foreground">
          Customize your product options and add it to your quote
        </p>
      </CardHeader>
      
      <CardContent className="space-y-6">
        {/* Product Summary */}
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between mb-3">
              <h3 className="font-semibold">{product.name}</h3>
              <Badge variant="secondary">
                {measurement.value.toLocaleString()} {measurement.unit.replace('_', ' ')}
              </Badge>
            </div>
            
            {product.description && (
              <p className="text-sm text-muted-foreground mb-3">{product.description}</p>
            )}
            
            <div className="text-right">
              <p className="text-sm text-muted-foreground">Base Price</p>
              <p className="text-lg font-semibold text-primary">
                {formatExactPrice(product.unit_price, {
                  currency_symbol: settings.currency_symbol,
                  decimal_precision: settings.decimal_precision
                })} per {product.unit_type}
              </p>
            </div>
          </CardContent>
        </Card>

        {/* Custom Name */}
        <div>
          <Label htmlFor="customName">Item Name (Optional)</Label>
          <Input
            id="customName"
            value={customName}
            onChange={(e) => setCustomName(e.target.value)}
            placeholder={`e.g., "Back Yard ${product.name}"`}
          />
          <p className="text-xs text-muted-foreground mt-1">
            Give this item a custom name to identify it in your quote
          </p>
        </div>

        {/* Variations */}
        {variations.length > 0 && (
          <div>
            <h4 className="font-semibold mb-3">Product Variations</h4>
            <div className="space-y-2">
              {variations.map((variation) => (
                <Card 
                  key={variation.id}
                  className={`cursor-pointer transition-colors ${
                    selectedVariations.includes(variation.id) 
                      ? 'ring-2 ring-primary bg-primary/5' 
                      : 'hover:bg-accent'
                  }`}
                  onClick={() => toggleVariation(variation.id)}
                >
                  <CardContent className="p-3">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="font-medium">{variation.name}</p>
                        {variation.description && (
                          <p className="text-sm text-muted-foreground">{variation.description}</p>
                        )}
                      </div>
                      <div className="text-right">
                        <p className="text-sm font-medium">
                          {variation.adjustment_type === 'percentage' ? '+' : ''}
                          {formatExactPrice(variation.price_adjustment, {
                            currency_symbol: settings.currency_symbol,
                            decimal_precision: settings.decimal_precision
                          })}
                          {variation.adjustment_type === 'percentage' && '%'}
                        </p>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          </div>
        )}

        {/* Add-ons */}
        {addons.length > 0 && (
          <div>
            <h4 className="font-semibold mb-3">Add-On Items</h4>
            <div className="space-y-3">
              {addons.map((addon) => (
                <Card key={addon.id}>
                  <CardContent className="p-3">
                    <div className="flex items-center justify-between mb-2">
                      <div className="flex-1">
                        <p className="font-medium">{addon.name}</p>
                        {addon.description && (
                          <p className="text-sm text-muted-foreground">{addon.description}</p>
                        )}
                      </div>
                      <div className="text-right">
                        <p className="text-sm font-medium">
                          {formatExactPrice(addon.price_value, {
                            currency_symbol: settings.currency_symbol,
                            decimal_precision: settings.decimal_precision
                          })}
                          {addon.calculation_type === 'per_unit' && ` per ${product.unit_type}`}
                        </p>
                      </div>
                    </div>
                    
                    <div className="flex items-center gap-2">
                      <Label className="text-sm">Quantity:</Label>
                      <div className="flex items-center gap-1">
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => updateAddonQuantity(addon.id, (selectedAddons[addon.id] || 0) - 1)}
                          disabled={(selectedAddons[addon.id] || 0) <= 0}
                        >
                          -
                        </Button>
                        <Input
                          type="number"
                          min="0"
                          value={selectedAddons[addon.id] || 0}
                          onChange={(e) => updateAddonQuantity(addon.id, parseInt(e.target.value) || 0)}
                          className="w-16 text-center"
                        />
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => updateAddonQuantity(addon.id, (selectedAddons[addon.id] || 0) + 1)}
                        >
                          +
                        </Button>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          </div>
        )}

        {/* Notes */}
        <div>
          <Label htmlFor="notes">Special Notes (Optional)</Label>
          <Textarea
            id="notes"
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder="Any special requirements or notes for this item..."
            rows={3}
          />
        </div>

        <Separator />

        {/* Price Summary */}
        <Card className="bg-primary/5 border-primary/20">
          <CardContent className="p-4">
            <div className="flex items-center justify-between mb-2">
              <span className="text-lg font-semibold">Total for this item:</span>
              <span className="text-xl font-bold text-primary">
                {formatExactPrice(lineTotal, {
                  currency_symbol: settings.currency_symbol,
                  decimal_precision: settings.decimal_precision
                })}
              </span>
            </div>
            
            <div className="text-sm text-muted-foreground">
              {measurement.value.toLocaleString()} {measurement.unit.replace('_', ' ')} × {formatExactPrice(product.unit_price, {
                currency_symbol: settings.currency_symbol,
                decimal_precision: settings.decimal_precision
              })}
              {selectedVariations.length > 0 && ' + variations'}
              {Object.values(selectedAddons).some(q => q > 0) && ' + add-ons'}
              {settings.global_markup_percentage > 0 && ` + ${settings.global_markup_percentage}% markup`}
            </div>
          </CardContent>
        </Card>

        {/* Add to Quote Button */}
        <Button onClick={handleAddToQuote} className="w-full" size="lg">
          <Plus className="h-4 w-4 mr-2" />
          Add to Quote
        </Button>
      </CardContent>
    </Card>
  );
};

export default ProductConfiguration;