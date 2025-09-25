import React, { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Checkbox } from '@/components/ui/checkbox';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { Plus, Minus, Package, Calculator } from 'lucide-react';
import { MeasurementData, QuoteItem } from './MeasurementWidget';
import { useToast } from '@/hooks/use-toast';


interface Product {
  id: string;
  name: string;
  unit_price: number;
  unit_type: string;
  color_hex: string;
  show_pricing_before_submit: boolean;
}

interface ProductVariation {
  id: string;
  name: string;
  description?: string;
  price_adjustment: number;
  adjustment_type: string;
}

interface ProductAddon {
  id: string;
  name: string;
  description?: string;
  price_type: string;
  price_value: number;
  calculation_type: string;
}

interface QuoteBuilderProps {
  product: Product;
  measurement: MeasurementData;
  onSave: (item: QuoteItem) => void;
  contractorId: string;
}

export const QuoteBuilder: React.FC<QuoteBuilderProps> = ({
  product,
  measurement,
  onSave,
  contractorId
}) => {
  const [customName, setCustomName] = useState('');
  const [notes, setNotes] = useState('');
  const [variations, setVariations] = useState<ProductVariation[]>([]);
  const [addons, setAddons] = useState<ProductAddon[]>([]);
  const [selectedVariations, setSelectedVariations] = useState<string[]>([]);
  const [selectedAddons, setSelectedAddons] = useState<Record<string, number>>({});
  const [loading, setLoading] = useState(true);
  const { toast } = useToast();

  useEffect(() => {
    loadProductOptions();
  }, [product.id]);

  const loadProductOptions = async () => {
    try {
      setLoading(true);

      // Load variations
      const { data: variationsData, error: variationsError } = await supabase
        .from('product_variations')
        .select('*')
        .eq('product_id', product.id)
        .eq('is_active', true)
        .order('display_order');

      if (variationsError) throw variationsError;

      // Load addons
      const { data: addonsData, error: addonsError } = await supabase
        .from('product_addons')
        .select('*')
        .eq('product_id', product.id)
        .eq('is_active', true)
        .order('display_order');

      if (addonsError) throw addonsError;

      setVariations(variationsData || []);
      setAddons(addonsData || []);
    } catch (error) {
      console.error('Error loading product options:', error);
      toast({
        title: "Error Loading Options",
        description: "Unable to load product variations and add-ons.",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const calculatePrice = () => {
    let basePrice = product.unit_price * measurement.value;
    
    // Apply variations
    selectedVariations.forEach(variationId => {
      const variation = variations.find(v => v.id === variationId);
      if (variation) {
        if (variation.adjustment_type === 'fixed') {
          basePrice += variation.price_adjustment;
        } else {
          basePrice *= (1 + variation.price_adjustment / 100);
        }
      }
    });

    // Apply addons
    let addonTotal = 0;
    Object.entries(selectedAddons).forEach(([addonId, quantity]) => {
      const addon = addons.find(a => a.id === addonId);
      if (addon && quantity > 0) {
        let addonPrice = 0;
        
        switch (addon.price_type) {
          case 'fixed':
            addonPrice = addon.price_value * quantity;
            break;
          case 'per_unit':
            addonPrice = addon.price_value * quantity * measurement.value;
            break;
          case 'percentage':
            const calculationBase = addon.calculation_type === 'total' ? basePrice : (product.unit_price * measurement.value);
            addonPrice = (calculationBase * addon.price_value / 100) * quantity;
            break;
        }
        
        addonTotal += addonPrice;
      }
    });

    return Math.round((basePrice + addonTotal) * 100) / 100;
  };

  const handleVariationToggle = (variationId: string) => {
    setSelectedVariations(prev => 
      prev.includes(variationId)
        ? prev.filter(id => id !== variationId)
        : [...prev, variationId]
    );
  };

  const handleAddonQuantityChange = (addonId: string, quantity: number) => {
    setSelectedAddons(prev => ({
      ...prev,
      [addonId]: Math.max(0, quantity)
    }));
  };

  const handleSave = () => {
    const selectedVariationData = selectedVariations.map(id => {
      const variation = variations.find(v => v.id === id);
      return variation ? {
        id: variation.id,
        name: variation.name,
        price: variation.price_adjustment
      } : null;
    }).filter(Boolean) as Array<{ id: string; name: string; price: number }>;

    const selectedAddonData = Object.entries(selectedAddons)
      .filter(([_, quantity]) => quantity > 0)
      .map(([id, quantity]) => {
        const addon = addons.find(a => a.id === id);
        return addon ? {
          id: addon.id,
          name: addon.name,
          quantity,
          price: addon.price_value
        } : null;
      }).filter(Boolean) as Array<{ id: string; name: string; quantity: number; price: number }>;

    const quoteItem: QuoteItem = {
      id: crypto.randomUUID(),
      productId: product.id,
      productName: product.name,
      measurement,
      unitPrice: product.unit_price,
      subtotal: calculatePrice(),
      customName: customName.trim() || undefined,
      notes: notes.trim() || undefined,
      variations: selectedVariationData.length > 0 ? selectedVariationData : undefined,
      addons: selectedAddonData.length > 0 ? selectedAddonData : undefined
    };

    onSave(quoteItem);
  };

  if (loading) {
    return (
      <div className="space-y-4">
        <div className="h-20 bg-muted animate-pulse rounded-lg" />
        <div className="h-32 bg-muted animate-pulse rounded-lg" />
      </div>
    );
  }

  const totalPrice = calculatePrice();

  return (
    <div className="space-y-4">
      {/* Product Summary */}
      <Card className="p-4">
        <div className="flex items-center gap-3 mb-3">
          <div 
            className="w-4 h-4 rounded-full border-2 border-border"
            style={{ backgroundColor: product.color_hex }}
          />
          <h3 className="font-semibold">{product.name}</h3>
        </div>
        
        <div className="space-y-2 text-sm">
          <div className="flex justify-between">
            <span>Measurement:</span>
            <span className="font-medium">
              {measurement.value.toLocaleString()} {measurement.unit.replace('_', ' ')}
            </span>
          </div>
          
          <div className="flex justify-between">
            <span>Unit Price:</span>
            <span className="font-medium">${product.unit_price.toFixed(2)}</span>
          </div>
          
          <Separator />
          
          <div className="flex justify-between text-base font-semibold">
            <span>Total:</span>
            <span className="text-primary">${totalPrice.toFixed(2)}</span>
          </div>
        </div>
      </Card>

      {/* Customization */}
      <div className="space-y-4">
        <div>
          <Label htmlFor="custom-name">Custom Name (optional)</Label>
          <Input
            id="custom-name"
            value={customName}
            onChange={(e) => setCustomName(e.target.value)}
            placeholder={`e.g., "Front Yard ${product.name}"`}
            className="mt-1"
          />
        </div>

        <div>
          <Label htmlFor="notes">Notes (optional)</Label>
          <Textarea
            id="notes"
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder="Any special requirements or notes..."
            className="mt-1"
            rows={3}
          />
        </div>
      </div>

      {/* Variations */}
      {variations.length > 0 && (
        <Card className="p-4">
          <h4 className="font-semibold mb-3 flex items-center gap-2">
            <Package className="h-4 w-4" />
            Product Variations
          </h4>
          
          <div className="space-y-3">
            {variations.map(variation => (
              <div key={variation.id} className="flex items-start space-x-3">
                <Checkbox
                  id={`variation-${variation.id}`}
                  checked={selectedVariations.includes(variation.id)}
                  onCheckedChange={() => handleVariationToggle(variation.id)}
                />
                <div className="flex-1">
                  <Label htmlFor={`variation-${variation.id}`} className="text-sm font-medium">
                    {variation.name}
                  </Label>
                  {variation.description && (
                    <p className="text-xs text-muted-foreground mt-1">
                      {variation.description}
                    </p>
                  )}
                  <div className="text-xs text-primary mt-1">
                    {variation.adjustment_type === 'fixed' 
                      ? `+$${variation.price_adjustment.toFixed(2)}`
                      : `+${variation.price_adjustment}%`
                    }
                  </div>
                </div>
              </div>
            ))}
          </div>
        </Card>
      )}

      {/* Add-ons */}
      {addons.length > 0 && (
        <Card className="p-4">
          <h4 className="font-semibold mb-3 flex items-center gap-2">
            <Plus className="h-4 w-4" />
            Add-ons
          </h4>
          
          <div className="space-y-4">
            {addons.map(addon => (
              <div key={addon.id} className="flex items-center justify-between">
                <div className="flex-1">
                  <h5 className="text-sm font-medium">{addon.name}</h5>
                  {addon.description && (
                    <p className="text-xs text-muted-foreground mt-1">
                      {addon.description}
                    </p>
                  )}
                  <div className="text-xs text-primary mt-1">
                    {addon.price_type === 'fixed' && `$${addon.price_value.toFixed(2)} each`}
                    {addon.price_type === 'per_unit' && `$${addon.price_value.toFixed(2)} per ${measurement.unit.replace('_', ' ')}`}
                    {addon.price_type === 'percentage' && `${addon.price_value}% of ${addon.calculation_type === 'total' ? 'total' : 'base price'}`}
                  </div>
                </div>
                
                <div className="flex items-center gap-2">
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => handleAddonQuantityChange(addon.id, (selectedAddons[addon.id] || 0) - 1)}
                    disabled={(selectedAddons[addon.id] || 0) <= 0}
                  >
                    <Minus className="h-3 w-3" />
                  </Button>
                  
                  <span className="w-8 text-center text-sm">
                    {selectedAddons[addon.id] || 0}
                  </span>
                  
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => handleAddonQuantityChange(addon.id, (selectedAddons[addon.id] || 0) + 1)}
                  >
                    <Plus className="h-3 w-3" />
                  </Button>
                </div>
              </div>
            ))}
          </div>
        </Card>
      )}

      {/* Save Button */}
      <Button onClick={handleSave} className="w-full">
        <Calculator className="h-4 w-4 mr-2" />
        Add to Quote - ${totalPrice.toFixed(2)}
      </Button>
    </div>
  );
};