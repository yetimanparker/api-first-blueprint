import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { Slider } from '@/components/ui/slider';
import { Switch } from '@/components/ui/switch';
import { Plus, Minus, Package, Loader2, Trash2 } from 'lucide-react';
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
  const [notes, setNotes] = useState('');

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

    if (product.use_tiered_pricing && pricingTiers.length > 0) {
      const simplifiedTiers: any[] = pricingTiers.map(tier => ({
        min_quantity: tier.min_quantity,
        max_quantity: tier.max_quantity,
        tier_price: tier.tier_price
      }));
      basePrice = calculateTieredPrice(quantity, simplifiedTiers, product.unit_price);
    }

    selectedVariations.forEach(variationId => {
      const variation = variations.find(v => v.id === variationId);
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
    });

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
  const perimeter = measurement.type === 'area' ? Math.sqrt(measurement.value) * 4 : undefined;

  return (
    <div className="max-w-4xl mx-auto px-4 py-6 space-y-6">
      {/* Product Summary Card */}
      <Card className="border-2 shadow-lg" style={{ borderColor: product.color_hex }}>
        <CardContent className="p-6">
          <div className="flex items-start gap-4">
            <div 
              className="w-3 h-3 rounded-full flex-shrink-0 mt-2"
              style={{ backgroundColor: product.color_hex }}
            />
            <div className="flex-1">
              <h2 className="text-2xl font-bold mb-2">{product.name}</h2>
              {product.description && (
                <p className="text-sm text-muted-foreground mb-4">{product.description}</p>
              )}
              
              <div className="flex flex-wrap gap-2 text-sm">
                <Badge variant="secondary" className="text-base px-3 py-1">
                  {measurement.value.toLocaleString()} {measurement.unit.replace('_', ' ')}
                </Badge>
                {perimeter && (
                  <Badge variant="outline" className="text-base px-3 py-1">
                    {Math.ceil(perimeter).toLocaleString()} ft perimeter
                  </Badge>
                )}
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Variations Section */}
      {variations.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2">
              <Badge className="bg-purple-500">Height Options</Badge>
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {variations.map((variation) => (
              <Card 
                key={variation.id}
                className={`cursor-pointer transition-all ${
                  selectedVariations.includes(variation.id) 
                    ? 'ring-2 ring-primary bg-primary/5' 
                    : 'hover:bg-accent'
                }`}
                onClick={() => toggleVariation(variation.id)}
              >
                <CardContent className="p-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="font-semibold">{variation.name}</p>
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
          </CardContent>
        </Card>
      )}

      {/* Add-ons Section */}
      {addons.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2">
              <Badge className="bg-orange-500">Available Add-ons</Badge>
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {addons.map((addon) => (
              <Card key={addon.id} className="bg-muted/30">
                <CardContent className="p-4">
                  <div className="flex items-center justify-between mb-3">
                    <div className="flex-1">
                      <p className="font-semibold">{addon.name}</p>
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
                  
                  <div className="flex items-center justify-between">
                    <Label className="text-sm">Quantity:</Label>
                    <div className="flex items-center gap-2">
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => updateAddonQuantity(addon.id, (selectedAddons[addon.id] || 0) - 1)}
                        disabled={(selectedAddons[addon.id] || 0) <= 0}
                      >
                        <Minus className="h-4 w-4" />
                      </Button>
                      <span className="w-12 text-center font-medium">
                        {selectedAddons[addon.id] || 0}
                      </span>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => updateAddonQuantity(addon.id, (selectedAddons[addon.id] || 0) + 1)}
                      >
                        <Plus className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </CardContent>
        </Card>
      )}

      {/* Notes */}
      <Card>
        <CardContent className="p-4">
          <Label htmlFor="notes" className="text-base font-semibold mb-2 block">Special Notes</Label>
          <Textarea
            id="notes"
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder="Any special requirements or notes for this item..."
            rows={3}
          />
        </CardContent>
      </Card>

      {/* Action Card */}
      <Card className="border-2 shadow-lg bg-muted/20" style={{ borderColor: product.color_hex }}>
        <CardContent className="p-6">
          <div className="flex items-center justify-between mb-4">
            <div>
              <p className="text-sm text-muted-foreground mb-1">Total Price</p>
              <p className="text-3xl font-bold text-primary">
                {formatExactPrice(lineTotal, {
                  currency_symbol: settings.currency_symbol,
                  decimal_precision: settings.decimal_precision
                })}
              </p>
            </div>
          </div>

          <div className="flex gap-3">
            <Button variant="destructive" size="lg" className="flex-1">
              <Trash2 className="h-4 w-4 mr-2" />
              Remove
            </Button>
            <Button onClick={handleAddToQuote} size="lg" className="flex-1">
              <Plus className="h-4 w-4 mr-2" />
              Add to Quote
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default ProductConfiguration;