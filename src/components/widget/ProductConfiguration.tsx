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

// Helper function to get display unit abbreviation
const getDisplayUnit = (unitType: string, isVolumeBased: boolean = false) => {
  if (isVolumeBased) return 'cu yd';
  
  const unitMap: Record<string, string> = {
    'sq_ft': 'SF',
    'linear_ft': 'LF',
    'each': 'each',
    'cubic_yard': 'cu yd',
    'hour': 'hr',
    'pound': 'lb',
    'ton': 'ton',
    'pallet': 'pallet'
  };
  
  return unitMap[unitType] || unitType;
};

interface AddonOption {
  id: string;
  name: string;
  description?: string;
  price_adjustment: number;
  adjustment_type: 'fixed' | 'percentage';
  image_url?: string;
}

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
  sold_in_increments_of?: number | null;
  increment_unit_label?: string | null;
  increment_description?: string | null;
  allow_partial_increments?: boolean;
  allow_addon_map_placement?: boolean;
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
  is_required?: boolean;
  is_default?: boolean;
}

interface Addon {
  id: string;
  name: string;
  description?: string;
  price_value: number;
  calculation_type: 'total' | 'per_unit' | 'area_calculation';
  price_type: string;
  addon_options?: AddonOption[];
  linked_product_id?: string | null;
  allow_map_placement?: boolean;
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
  contractorId: string;
  measurement: MeasurementData;
  onAddToQuote: (item: QuoteItem) => void;
  settings: GlobalSettings;
  onRemove?: () => void;
  cachedProducts?: any[];
  onAddonPlacementStart?: (addon: {
    addonId: string;
    addonName: string;
    priceValue: number;
    calculationType?: string;
    selectedOptionId?: string;
    selectedOptionName?: string;
    selectedVariations?: any[];
    linkedProductId?: string;
  }, mainItem: QuoteItem) => void;
}

const ProductConfiguration = ({ 
  productId,
  contractorId, 
  measurement, 
  onAddToQuote, 
  settings,
  onRemove,
  cachedProducts,
  onAddonPlacementStart
}: ProductConfigurationProps) => {
  const [product, setProduct] = useState<Product | null>(null);
  const [variations, setVariations] = useState<Variation[]>([]);
  const [addons, setAddons] = useState<Addon[]>([]);
  const [addonOptions, setAddonOptions] = useState<Record<string, any[]>>({});
  const [selectedAddonOptions, setSelectedAddonOptions] = useState<Record<string, string>>({});
  const [pricingTiers, setPricingTiers] = useState<PricingTier[]>([]);
  const [loading, setLoading] = useState(true);
  
  const [selectedVariationId, setSelectedVariationId] = useState<string>('');
  const [variationError, setVariationError] = useState<string>('');
  const [selectedAddons, setSelectedAddons] = useState<Record<string, number>>({});
  const [notes, setNotes] = useState('');
  const [depth, setDepth] = useState<string>(measurement.depth?.toString() || '');
  const [isAdded, setIsAdded] = useState(false);

  // Check if product is volume-based
  const isVolumeBased = product && (
    product.unit_type === 'cubic_yard' ||
    product.unit_type.includes('cubic')
  );

  // Check if product is 'each' type (point measurement)
  const isEachType = measurement.type === 'point';

  useEffect(() => {
    fetchProductData();
  }, [productId]);

  const fetchProductData = async () => {
    try {
      setLoading(true);
      
      // Use cached products if available (much faster!)
      let productData;
      if (cachedProducts && cachedProducts.length > 0) {
        productData = cachedProducts.find((p: any) => p.id === productId);
      } else {
        // Fallback to edge function if no cached products
        const { data, error } = await supabase.functions.invoke('get-widget-products', {
          body: { contractor_id: contractorId }
        });

        if (error || !data?.success) {
          throw new Error('Failed to load product details');
        }
        
        productData = data.products.find((p: any) => p.id === productId);
      }
      
      if (!productData) {
        throw new Error('Product not found');
      }

      setProduct(productData);

      // Variations are now included in the product data
      const variationsData = productData.product_variations || [];
      const hasRequiredVariations = variationsData.some((v: any) => v.is_required);
      const defaultVariation = variationsData.find((v: any) => v.is_default);
      
      setVariations(variationsData as Variation[]);
      
      // Auto-select default variation if exists
      if (defaultVariation) {
        setSelectedVariationId(defaultVariation.id);
      }
      
      // Show error if required but no default and has variations
      if (hasRequiredVariations && !defaultVariation && variationsData.length > 0) {
        setVariationError("Please select a variation");
      }

      // Addons are now included in the product data
      const addonsData = productData.product_addons || [];

      // Filter addons based on product compatibility
      const manualInputUnits = ['each', 'ton', 'pound', 'pallet', 'hour'];
      const isManualInputProduct = manualInputUnits.includes(productData.unit_type);

      // For manual input products, only show 'total' calculation type addons
      const compatibleAddons = isManualInputProduct 
        ? (addonsData || []).filter(addon => addon.calculation_type === 'total')
        : (addonsData || []);

      setAddons(compatibleAddons as Addon[]);
      
      // Load addon options
      const optionsMap: Record<string, any[]> = {};
      for (const addon of compatibleAddons) {
        const addonOpts = addon.addon_options || [];
        optionsMap[addon.id] = addonOpts;
        
        // Auto-select default option if exists
        const defaultOption = addonOpts.find((opt: any) => opt.is_default);
        if (defaultOption) {
          setSelectedAddonOptions(prev => ({
            ...prev,
            [addon.id]: defaultOption.id
          }));
        }
      }
      setAddonOptions(optionsMap);

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

    // Check if required variation is selected
    const hasRequiredVariations = variations.some(v => v.is_required);
    const selectedVariation = variations.find(v => v.id === selectedVariationId);
    
    if (hasRequiredVariations && !selectedVariation) {
      return 0; // Don't calculate price if required variation not selected
    }

    // If depth is provided for volume-based products, calculate cubic yards
    const depthValue = parseFloat(depth);
    if (depthValue && !isNaN(depthValue) && isVolumeBased && measurement.type === 'area') {
      quantity = (measurement.value * depthValue) / 324;
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
      if (selectedVariation.adjustment_type === 'percentage') {
        basePrice += basePrice * (selectedVariation.price_adjustment / 100);
      } else {
        basePrice += selectedVariation.price_adjustment;
      }
    }

    let subtotal = basePrice * quantity;

    Object.entries(selectedAddons).forEach(([addonId, addonQuantity]) => {
      if (addonQuantity > 0) {
        const addon = addons.find(a => a.id === addonId);
        if (addon) {
          let addonPrice = addon.price_value;
          
          // Apply addon option price adjustment
          const selectedOptionId = selectedAddonOptions[addonId];
          if (selectedOptionId) {
            const optionData = addonOptions[addonId]?.find(opt => opt.id === selectedOptionId);
            if (optionData) {
              if (optionData.adjustment_type === 'percentage') {
                addonPrice += addonPrice * (optionData.price_adjustment / 100);
              } else {
                addonPrice += optionData.price_adjustment;
              }
            }
          }
          
          let addonBaseQuantity = measurement.value;
          
          if (addon.calculation_type !== 'area_calculation') {
            const depthValue = parseFloat(depth);
            if (depthValue && !isNaN(depthValue) && isVolumeBased && measurement.type === 'area') {
              addonBaseQuantity = (measurement.value * depthValue) / 324;
            }
          }
          
          const variation = selectedVariation;
          const variationData = variation ? {
            height: variation.height_value || null,
            unit: variation.unit_of_measurement || 'ft',
            affects_area_calculation: variation.affects_area_calculation || false
          } : undefined;
          
          const addonPriceWithCalc = calculateAddonWithAreaData(
            addonPrice,
            addonBaseQuantity,
            addon.calculation_type,
            variationData,
            {
              base_height: product.base_height,
              base_height_unit: product.base_height_unit,
              use_height_in_calculation: product.use_height_in_calculation
            }
          );
          subtotal += addonPriceWithCalc * addonQuantity;
        }
      }
    });

    return subtotal;
  };

  const handleAddToQuote = () => {
    if (!product) {
      console.error('❌ handleAddToQuote: No product found');
      return;
    }

    console.log('🟡 ProductConfiguration.handleAddToQuote - Starting');
    console.log('📊 Measurement prop:', {
      isDimensional: measurement.isDimensional,
      centerPoint: measurement.centerPoint,
      rotation: measurement.rotation,
      value: measurement.value,
      type: measurement.type,
      unit: measurement.unit,
      coordinates: measurement.coordinates?.length
    });
    console.log('📦 Product:', {
      id: product.id,
      name: product.name,
      unit_type: product.unit_type
    });

    // Validate required variation
    const hasRequiredVariations = variations.some(v => v.is_required);
    if (hasRequiredVariations && !selectedVariationId) {
      console.error('❌ Required variation not selected');
      setVariationError("Please select a variation");
      return;
    }

    const selectedVariationObjects: ProductVariation[] = [];
    if (selectedVariationId) {
      const variation = variations.find(v => v.id === selectedVariationId);
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
        const selectedOptionId = selectedAddonOptions[addonId];
        const optionData = selectedOptionId 
          ? addonOptions[addonId]?.find(opt => opt.id === selectedOptionId)
          : null;
        
        return {
          id: addon.id,
          name: addon.name,
          priceValue: addon.price_value,
          calculationType: addon.calculation_type,
          quantity,
          selectedOptionId: selectedOptionId,
          selectedOptionName: optionData?.name
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
      unitType: product.unit_type,
      measurement: measurementWithOptions,
      unitPrice: product.unit_price,
      quantity: actualQuantity,
      lineTotal: calculateItemPrice(),
      notes: notes || undefined,
      variations: selectedVariationObjects,
      addons: selectedAddonObjects
    };

    console.log('🔴 ProductConfiguration - Created quoteItem:', {
      productName: quoteItem.productName,
      quantity: quoteItem.quantity,
      lineTotal: quoteItem.lineTotal,
      isDimensional: quoteItem.measurement.isDimensional,
      centerPoint: quoteItem.measurement.centerPoint,
      rotation: quoteItem.measurement.rotation,
      coordinates: quoteItem.measurement.coordinates?.length
    });

    console.log('🚀 Calling onAddToQuote with quoteItem');
    onAddToQuote(quoteItem);
    console.log('✅ onAddToQuote completed, setting isAdded to true');
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
  const selectedVariationObj = selectedVariationId ? variations.find(v => v.id === selectedVariationId) : null;

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

          {/* Measurement Summary with Increment Info */}
          {measurement.wasRoundedForIncrements && measurement.incrementsApplied && (
            <div className="p-4 bg-blue-50 border-l-4 border-blue-500 rounded-lg">
              <div className="flex items-start gap-3">
                <Package className="h-5 w-5 text-blue-600 mt-0.5" />
                <div className="flex-1">
                  <p className="font-semibold text-blue-900 mb-1">Quantity Rounded for Increments</p>
                  <div className="text-sm text-blue-800 space-y-1">
                    <p>
                      <strong>You measured:</strong> {measurement.originalMeasurement} {getDisplayUnit(product.unit_type)}
                    </p>
                    <p>
                      <strong>Rounded to:</strong> {measurement.value} {getDisplayUnit(product.unit_type)} 
                      ({measurement.incrementsApplied.unitsNeeded} {measurement.incrementsApplied.incrementLabel}
                      {measurement.incrementsApplied.unitsNeeded > 1 && !measurement.incrementsApplied.incrementLabel.endsWith('s') && 's'})
                    </p>
                    <p className="text-blue-600">
                      <strong>Extra coverage:</strong> {(measurement.value - measurement.originalMeasurement!).toFixed(0)} {getDisplayUnit(product.unit_type)}
                    </p>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Variations Dropdown */}
          {variations.length > 0 && (
            <div className="space-y-2">
              <Label htmlFor="variation-select" className="text-base font-semibold flex items-center gap-2">
                Select Option
                {variations.some(v => v.is_required) && (
                  <Badge variant="destructive" className="text-xs">Required</Badge>
                )}
              </Label>
              <Select value={selectedVariationId} onValueChange={(value) => {
                setSelectedVariationId(value);
                setVariationError("");
              }}>
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
              {variationError && (
                <p className="text-sm text-destructive">{variationError}</p>
              )}
            </div>
          )}

          {/* Add-ons Section */}
          {addons.length > 0 && (
            <div className="space-y-4">
              <h3 className="text-base font-semibold">Available Add-ons</h3>
              <div className="space-y-3">
                {addons.map((addon) => {
                  const hasOptions = (addonOptions[addon.id] || []).length > 0;
                  const selectedOption = selectedAddonOptions[addon.id];
                  const optionData = hasOptions 
                    ? addonOptions[addon.id].find(opt => opt.id === selectedOption)
                    : null;
                  
                  return (
                    <div key={addon.id} className="p-4 border rounded-lg bg-card space-y-3">
                      <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-2 sm:gap-4">
                        <div className="flex-1">
                          <p className="font-medium">{addon.name}</p>
                          {addon.description && (
                            <p className="text-sm text-muted-foreground mt-1">
                              {addon.description}
                            </p>
                          )}
                          <p className="text-xs text-muted-foreground mt-1">
                            Base: {formatExactPrice(addon.price_value, {
                              currency_symbol: settings.currency_symbol,
                              decimal_precision: settings.decimal_precision
                            })} {addon.calculation_type === 'per_unit' ? 'per unit' : addon.calculation_type === 'area_calculation' ? 'per SF' : 'total'}
                            {optionData && optionData.price_adjustment !== 0 && (
                              <span className="text-primary font-medium">
                                {' '}+ {optionData.adjustment_type === 'percentage'
                                  ? `${optionData.price_adjustment}%`
                                  : formatExactPrice(optionData.price_adjustment, {
                                      currency_symbol: settings.currency_symbol,
                                      decimal_precision: settings.decimal_precision
                                    })
                                }
                              </span>
                            )}
                          </p>
                        </div>
                        
                        {/* Addon controls - map placement or quantity */}
                        {(() => {
                          const canPlaceOnMap = product?.allow_addon_map_placement && addon.allow_map_placement;
                          
                          if (canPlaceOnMap && onAddonPlacementStart) {
                            // Map-placeable addon - show "Place on Map" button
                            return (
                              <Button
                                type="button"
                                variant="default"
                                size="sm"
                                onClick={() => {
                                  // Build main product quote item using same logic as handleAddToQuote
                                  const selectedVariationObjects: ProductVariation[] = [];
                                  if (selectedVariationId) {
                                    const variation = variations.find(v => v.id === selectedVariationId);
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

                                  const depthValue = parseFloat(depth);
                                  let actualQuantity = measurement.value;
                                  if (depthValue && !isNaN(depthValue) && isVolumeBased && measurement.type === 'area') {
                                    actualQuantity = (measurement.value * depthValue) / 324;
                                  }

                                  const measurementWithOptions: MeasurementData = {
                                    ...measurement,
                                    depth: (depthValue && !isNaN(depthValue) && isVolumeBased) ? depthValue : undefined,
                                    variations: selectedVariationObjects.length > 0 ? selectedVariationObjects : undefined,
                                  };

                                  const mainItem: QuoteItem = {
                                    id: Date.now().toString(),
                                    productId: product.id,
                                    productName: product.name,
                                    unitType: product.unit_type,
                                    measurement: measurementWithOptions,
                                    unitPrice: product.unit_price,
                                    quantity: actualQuantity,
                                    lineTotal: calculateItemPrice(),
                                    variations: selectedVariationObjects,
                                  };
                                  
                                  // Calculate addon price with any option adjustments
                                  const selectedOption = hasOptions ? addonOptions[addon.id].find(opt => opt.id === selectedAddonOptions[addon.id]) : null;
                                  const optionPrice = selectedOption?.price_adjustment || 0;
                                  const totalAddonPrice = addon.price_value + optionPrice;
                                  
                                  onAddonPlacementStart(
                                    {
                                      addonId: addon.id,
                                      addonName: addon.name,
                                      priceValue: totalAddonPrice,
                                      calculationType: addon.calculation_type,
                                      selectedOptionId: selectedAddonOptions[addon.id],
                                      selectedOptionName: selectedOption?.name,
                                      linkedProductId: addon.linked_product_id || undefined,
                                    },
                                    mainItem
                                  );
                                }}
                              >
                                Place on Map
                              </Button>
                            );
                          }
                          
                          // Normal addon behavior - show quantity controls
                          return (
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
                          );
                        })()}
                      </div>
                      
                      {/* Option Selector (only show if addon has options and quantity > 0) */}
                      {hasOptions && (selectedAddons[addon.id] || 0) > 0 && (
                        <div className="space-y-2 pt-2 border-t">
                          <Label className="text-sm font-medium">Select {addon.name} Option:</Label>
                          <Select
                            value={selectedAddonOptions[addon.id] || ""}
                            onValueChange={(val) => setSelectedAddonOptions(prev => ({
                              ...prev,
                              [addon.id]: val
                            }))}
                          >
                            <SelectTrigger className="w-full bg-background">
                              <SelectValue placeholder={`Choose ${addon.name} option`} />
                            </SelectTrigger>
                            <SelectContent className="bg-background border shadow-lg z-[100] max-h-[300px]">
                              {addonOptions[addon.id].map((option: any) => (
                                <SelectItem key={option.id} value={option.id}>
                                  <div className="flex items-center gap-3 py-1">
                                    {option.image_url && (
                                      <img 
                                        src={option.image_url} 
                                        alt={option.name}
                                        className="w-10 h-10 rounded object-cover flex-shrink-0"
                                      />
                                    )}
                                    <div className="flex-1 min-w-0">
                                      <span className="block font-medium">{option.name}</span>
                                      {option.description && (
                                        <span className="block text-xs text-muted-foreground truncate">{option.description}</span>
                                      )}
                                      {option.price_adjustment !== 0 && (
                                        <span className="text-xs text-primary font-medium">
                                          {option.adjustment_type === 'percentage'
                                            ? `+${option.price_adjustment}%`
                                            : `+${formatExactPrice(option.price_adjustment, {
                                                currency_symbol: settings.currency_symbol,
                                                decimal_precision: settings.decimal_precision
                                              })}`
                                          }
                                        </span>
                                      )}
                                    </div>
                                  </div>
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Product Summary Card at Bottom */}
      <Card className="border-l-4 shadow-sm border-primary">
        <CardContent className="p-6">
          <div className="space-y-4">
            {/* Product Header with measurement inline */}
            <div className="flex-1">
              <h3 className="font-semibold text-lg">
                {product.name}
                <span className="text-sm text-muted-foreground font-normal ml-2">
                  ({isVolumeBased && depth && parseFloat(depth) > 0
                    ? `${((measurement.value * parseFloat(depth)) / 324).toLocaleString()} cu yd`
                    : `${measurement.value.toLocaleString()} ${measurement.unit.replace('_', ' ')}`})
                </span>
              </h3>
            </div>

            {/* Itemized Pricing Breakdown */}
            {settings.pricing_visibility === 'before_submit' && !settings.use_price_ranges &&
             (!isVolumeBased || (isVolumeBased && depth && parseFloat(depth) > 0)) && (
              <div className="space-y-1">
                {/* Selection Header */}
                {selectedVariationObj && (
                <div className="text-sm font-bold text-muted-foreground">
                  Selection:
                </div>
                )}

                {/* Product Line with integrated variation */}
                <div className="text-base">
                  <div>
                    {selectedVariationObj ? `${selectedVariationObj.name} ` : ''}{product.name}:
                  </div>
                  <div className="text-sm text-muted-foreground">
                    {(() => {
                      const depthValue = parseFloat(depth);
                      if (depthValue && !isNaN(depthValue) && isVolumeBased) {
                        return `${((measurement.value * depthValue) / 324).toFixed(0)} cu yd`;
                      }
                      const displayUnit = getDisplayUnit(product.unit_type, false);
                      
                      // Show increment info if rounded
                      if (measurement.wasRoundedForIncrements && measurement.incrementsApplied) {
                        return `${measurement.value.toFixed(0)} ${displayUnit} (rounded)`;
                      }
                      
                      return `${measurement.value.toFixed(0)} ${displayUnit}`;
                    })()} × {(() => {
                      // Calculate unit price with variation included
                      let unitPrice = product.unit_price;
                      if (selectedVariationObj) {
                        if (selectedVariationObj.adjustment_type === 'percentage') {
                          unitPrice = unitPrice + (unitPrice * selectedVariationObj.price_adjustment / 100);
                        } else {
                          unitPrice = unitPrice + selectedVariationObj.price_adjustment;
                        }
                      }
                      return formatExactPrice(unitPrice, {
                        currency_symbol: settings.currency_symbol,
                        decimal_precision: settings.decimal_precision
                      });
                    })()} = <span className="font-bold">{(() => {
                      // Calculate line total (product + variation)
                      const depthValue = parseFloat(depth);
                      const qty = (depthValue && !isNaN(depthValue) && isVolumeBased) 
                        ? (measurement.value * depthValue) / 324 
                        : measurement.value;
                      
                      let basePrice = product.unit_price * qty;
                      if (selectedVariationObj) {
                        if (selectedVariationObj.adjustment_type === 'percentage') {
                          basePrice = basePrice + (basePrice * selectedVariationObj.price_adjustment / 100);
                        } else {
                          basePrice = basePrice + (selectedVariationObj.price_adjustment * qty);
                        }
                      }
                      return formatExactPrice(basePrice, {
                        currency_symbol: settings.currency_symbol,
                        decimal_precision: settings.decimal_precision
                      });
                    })()}</span>
                  </div>
                  {/* Show increment breakdown */}
                  {measurement.wasRoundedForIncrements && measurement.incrementsApplied && (
                    <div className="text-xs text-muted-foreground mt-1 pl-4">
                      = {measurement.incrementsApplied.unitsNeeded} {measurement.incrementsApplied.incrementLabel}
                      {measurement.incrementsApplied.unitsNeeded > 1 && !measurement.incrementsApplied.incrementLabel.endsWith('s') && 's'}
                      {' × '}{measurement.incrementsApplied.incrementSize} {getDisplayUnit(product.unit_type)}
                    </div>
                  )}
                </div>

                {/* Add-ons Section */}
                {Object.entries(selectedAddons).filter(([_, quantity]) => quantity > 0).length > 0 && (
                  <div className="space-y-1">
                    <div className="text-sm font-bold text-muted-foreground">Add-ons:</div>
                    {Object.entries(selectedAddons)
                      .filter(([_, quantity]) => quantity > 0)
                      .map(([addonId, addonQuantity]) => {
                        const addon = addons.find(a => a.id === addonId);
                        if (!addon) return null;
                        
                        let quantity = measurement.value;
                        
                        if (addon.calculation_type !== 'area_calculation') {
                          const depthValue = parseFloat(depth);
                          if (depthValue && !isNaN(depthValue) && isVolumeBased && measurement.type === 'area') {
                            quantity = (measurement.value * depthValue) / 324;
                          }
                        }
                        
                        const variationData = selectedVariationObj ? {
                          height: selectedVariationObj.height_value || null,
                          unit: selectedVariationObj.unit_of_measurement || 'ft',
                          affects_area_calculation: selectedVariationObj.affects_area_calculation || false
                        } : undefined;

                        const addonPrice = calculateAddonWithAreaData(
                          addon.price_value,
                          quantity,
                          addon.calculation_type,
                          variationData,
                          {
                            base_height: product.base_height,
                            base_height_unit: product.base_height_unit,
                            use_height_in_calculation: product.use_height_in_calculation
                          }
                        );
                        const addonTotal = addonPrice * addonQuantity;
                        
                        // Calculate display quantity and unit
                        let displayQuantity = '';
                        let displayUnit = '';
                        if (addon.calculation_type === 'area_calculation') {
                          const height = selectedVariationObj?.height_value || product.base_height || 1;
                          const area = quantity * height;
                          displayQuantity = Math.round(area).toLocaleString();
                          displayUnit = 'SF';
                        } else if (addon.calculation_type === 'per_unit') {
                          displayQuantity = quantity.toLocaleString();
                          displayUnit = getDisplayUnit(product.unit_type, isVolumeBased);
                        } else {
                          displayQuantity = '1';
                          displayUnit = 'ea';
                        }

                        return (
                          <div key={addonId} className="text-base">
                            <div>{addon.name}:</div>
                            <div className="text-sm text-muted-foreground">
                              {displayQuantity} {displayUnit} × {formatExactPrice(addon.price_value, {
                                currency_symbol: settings.currency_symbol,
                                decimal_precision: settings.decimal_precision
                              })}/{displayUnit} = <span className="font-bold">{formatExactPrice(addonTotal, {
                                currency_symbol: settings.currency_symbol,
                                decimal_precision: settings.decimal_precision
                              })}</span>
                            </div>
                          </div>
                        );
                      })}
                  </div>
                )}

                {/* Separator and Total */}
                <div className="border-t-2 border-border pt-3">
                  <div className="flex justify-end">
                    <span className="text-2xl font-bold">
                      Total: {formatExactPrice(lineTotal, {
                        currency_symbol: settings.currency_symbol,
                        decimal_precision: settings.decimal_precision
                      })}
                    </span>
                  </div>
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
              <Button 
                onClick={handleAddToQuote} 
                variant="success" 
                size="lg" 
                className="flex-1 w-full"
                disabled={
                  (isVolumeBased && (!depth || parseFloat(depth) <= 0)) ||
                  (variations.some(v => v.is_required) && !selectedVariationId)
                }
              >
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