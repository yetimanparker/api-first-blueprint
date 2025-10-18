import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { Loader2 } from "lucide-react";
import { calculateAddonWithAreaData } from "@/lib/priceUtils";

interface QuoteItem {
  id: string;
  product_id: string;
  quantity: number;
  unit_price: number;
  line_total: number;
  notes?: string;
  measurement_data?: {
    variations?: Array<{ 
      id: string; 
      name: string; 
      priceAdjustment: number; 
      adjustmentType: string;
      height_value?: number;
      unit_of_measurement?: string;
      affects_area_calculation?: boolean;
      [key: string]: any;
    }>;
    addons?: Array<{ 
      id?: string; 
      name?: string; 
      priceValue?: number; 
      calculationType?: 'total' | 'per_unit' | 'area_calculation';
      quantity?: number;
      addon_id?: string;
      addon_name?: string;
      addon_price?: number;
      calculation_type?: string;
      [key: string]: any;
    }>;
    [key: string]: any;
  };
}

interface Product {
  id: string;
  name: string;
  unit_price: number;
  unit_type: string;
  base_height?: number | null;
  base_height_unit?: string | null;
  use_height_in_calculation?: boolean | null;
  product_variations?: Array<{
    id: string;
    name: string;
    price_adjustment: number;
    adjustment_type: string;
    height_value?: number | null;
    unit_of_measurement?: string | null;
    affects_area_calculation?: boolean | null;
  }>;
  product_addons?: Array<{
    id: string;
    name: string;
    price_value: number;
    calculation_type: string;
  }>;
  product_pricing_tiers?: Array<{
    id: string;
    min_quantity: number;
    max_quantity: number | null;
    tier_price: number;
  }>;
}

interface EditQuoteItemDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  item: QuoteItem;
  onSuccess: () => void;
}

export function EditQuoteItemDialog({ open, onOpenChange, item, onSuccess }: EditQuoteItemDialogProps) {
  const [product, setProduct] = useState<Product | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  
  // Form state
  const [variationId, setVariationId] = useState<string>("none");
  const [quantity, setQuantity] = useState<number>(item.quantity);
  const [unitPrice, setUnitPrice] = useState<number>(item.unit_price);
  const [notes, setNotes] = useState<string>(item.notes || "");
  const [selectedAddonIds, setSelectedAddonIds] = useState<string[]>([]);
  
  const { toast } = useToast();

  // Load product data when dialog opens
  useEffect(() => {
    if (open && item.product_id) {
      loadProductData();
    }
  }, [open, item.product_id]);

  const loadProductData = async () => {
    setLoading(true);
    try {
      const { data: productData, error } = await supabase
        .from("products")
        .select(`
          *,
          product_variations (*),
          product_addons (*),
          product_pricing_tiers (*)
        `)
        .eq("id", item.product_id)
        .single();

      if (error) throw error;
      
      setProduct(productData);
      
      // Initialize form with existing item data
      if (item.measurement_data?.variations && item.measurement_data.variations.length > 0) {
        setVariationId(item.measurement_data.variations[0].id);
      } else {
        setVariationId("none");
      }
      
      if (item.measurement_data?.addons) {
        const addonIds = item.measurement_data.addons
          .filter(a => a.quantity && a.quantity > 0)
          .map(a => a.id || a.addon_id)
          .filter(Boolean) as string[];
        setSelectedAddonIds(addonIds);
      } else {
        setSelectedAddonIds([]);
      }
      
      setQuantity(item.quantity);
      setUnitPrice(item.unit_price);
      setNotes(item.notes || "");
      
    } catch (error) {
      console.error("Error loading product:", error);
      toast({
        title: "Error",
        description: "Failed to load product data",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  // Calculate addon costs
  const calculateAddonCosts = () => {
    if (!product || selectedAddonIds.length === 0) return 0;
    
    // Get variation data if selected
    const selectedVariation = variationId !== "none" && product.product_variations
      ? product.product_variations.find(v => v.id === variationId)
      : null;
    
    const variationData = selectedVariation ? {
      height: selectedVariation.height_value,
      unit: selectedVariation.unit_of_measurement,
      affects_area_calculation: selectedVariation.affects_area_calculation
    } : undefined;
    
    const productData = {
      base_height: product.base_height,
      base_height_unit: product.base_height_unit,
      use_height_in_calculation: product.use_height_in_calculation
    };
    
    return selectedAddonIds.reduce((total, addonId) => {
      const addon = product.product_addons?.find(a => a.id === addonId);
      if (!addon) return total;
      
      // Use the same calculation as the quote summary
      const addonCost = calculateAddonWithAreaData(
        addon.price_value,
        quantity,
        addon.calculation_type,
        variationData,
        productData
      );
      
      return total + addonCost;
    }, 0);
  };

  // Calculate line total
  const calculateLineTotal = () => {
    const addonCosts = calculateAddonCosts();
    return (unitPrice * quantity) + addonCosts;
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      // Prepare variation data
      let variationData = null;
      if (variationId !== "none" && product) {
        const variation = product.product_variations?.find(v => v.id === variationId);
        if (variation) {
          variationData = [{
            id: variation.id,
            name: variation.name,
            priceAdjustment: variation.price_adjustment,
            adjustmentType: variation.adjustment_type,
          }];
        }
      }

      // Prepare addon data
      let addonData = null;
      if (selectedAddonIds.length > 0 && product) {
        addonData = selectedAddonIds.map(addonId => {
          const addon = product.product_addons?.find(a => a.id === addonId);
          if (!addon) return null;
          
          let addonQuantity = 1;
          if (addon.calculation_type === 'per_unit') {
            addonQuantity = quantity;
          }
          
          return {
            id: addon.id,
            name: addon.name,
            priceValue: addon.price_value,
            calculationType: addon.calculation_type,
            quantity: addonQuantity,
          };
        }).filter(Boolean);
      }

      // Update quote item
      const { error: updateError } = await supabase
        .from("quote_items")
        .update({
          quantity,
          unit_price: unitPrice,
          line_total: calculateLineTotal(),
          notes,
          measurement_data: {
            ...item.measurement_data,
            variations: variationData,
            addons: addonData,
          },
        })
        .eq("id", item.id);

      if (updateError) throw updateError;

      // Recalculate quote total
      const { data: allItems, error: itemsError } = await supabase
        .from("quote_items")
        .select("line_total")
        .eq("quote_id", item.id);

      if (itemsError) throw itemsError;

      const newTotal = allItems?.reduce((sum, qi) => sum + Number(qi.line_total), 0) || 0;

      const { error: quoteError } = await supabase
        .from("quotes")
        .update({ total_amount: newTotal })
        .eq("id", item.id);

      if (quoteError) throw quoteError;

      toast({
        title: "Success",
        description: "Quote item updated successfully",
      });

      onSuccess();
      onOpenChange(false);
    } catch (error) {
      console.error("Error updating quote item:", error);
      toast({
        title: "Error",
        description: "Failed to update quote item",
        variant: "destructive",
      });
    } finally {
      setSaving(false);
    }
  };

  const toggleAddon = (addonId: string, checked: boolean) => {
    setSelectedAddonIds(prev => 
      checked ? [...prev, addonId] : prev.filter(id => id !== addonId)
    );
  };

  const selectedVariation = product?.product_variations?.find(v => v.id === variationId);
  const addonCosts = calculateAddonCosts();
  const lineTotal = calculateLineTotal();

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Edit Quote Item</DialogTitle>
        </DialogHeader>

        {loading ? (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="h-8 w-8 animate-spin" />
          </div>
        ) : !product ? (
          <div className="text-center py-8 text-muted-foreground">
            Failed to load product data
          </div>
        ) : (
          <div className="space-y-6">
            {/* Product Info */}
            <div className="p-4 bg-muted rounded-lg">
              <h3 className="font-semibold">{product.name}</h3>
              <p className="text-sm text-muted-foreground">
                Base Price: ${product.unit_price} per {product.unit_type}
              </p>
            </div>

            {/* Variation Selection */}
            {product.product_variations && product.product_variations.length > 0 && (
              <div className="space-y-2">
                <Label>Variation</Label>
                <Select value={variationId} onValueChange={setVariationId}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">No Variation</SelectItem>
                    {product.product_variations.map(variation => (
                      <SelectItem key={variation.id} value={variation.id}>
                        {variation.name} ({variation.adjustment_type === 'percentage' ? `${variation.price_adjustment}%` : `$${variation.price_adjustment}`})
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {selectedVariation && (
                  <p className="text-sm text-muted-foreground">
                    Adjustment: {selectedVariation.adjustment_type === 'percentage' 
                      ? `${selectedVariation.price_adjustment}%` 
                      : `$${selectedVariation.price_adjustment}`}
                  </p>
                )}
              </div>
            )}

            {/* Add-ons */}
            {product.product_addons && product.product_addons.length > 0 && (
              <div className="space-y-2">
                <Label>Add-ons</Label>
                <div className="space-y-2 border rounded-lg p-4">
                  {product.product_addons.map(addon => (
                    <div key={addon.id} className="flex items-start space-x-2">
                      <Checkbox
                        id={`addon-${addon.id}`}
                        checked={selectedAddonIds.includes(addon.id)}
                        onCheckedChange={(checked) => toggleAddon(addon.id, checked as boolean)}
                      />
                      <div className="flex-1">
                        <label htmlFor={`addon-${addon.id}`} className="text-sm font-medium cursor-pointer">
                          {addon.name}
                        </label>
                        <p className="text-xs text-muted-foreground">
                          ${addon.price_value} {addon.calculation_type === 'per_unit' ? 'per unit' : 'total'}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Quantity */}
            <div className="space-y-2">
              <Label>Quantity</Label>
              <Input
                type="number"
                value={quantity}
                onChange={(e) => setQuantity(Number(e.target.value))}
                min={1}
                step={0.01}
              />
            </div>

            {/* Unit Price */}
            <div className="space-y-2">
              <Label>Unit Price</Label>
              <Input
                type="number"
                value={unitPrice}
                onChange={(e) => setUnitPrice(Number(e.target.value))}
                min={0}
                step={0.01}
              />
            </div>

            {/* Notes */}
            <div className="space-y-2">
              <Label>Notes</Label>
              <Textarea
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="Additional notes..."
                rows={3}
              />
            </div>

            {/* Summary */}
            <div className="p-4 bg-muted rounded-lg space-y-2">
              <div className="flex justify-between text-sm">
                <span>Subtotal:</span>
                <span>${(unitPrice * quantity).toFixed(2)}</span>
              </div>
              {addonCosts > 0 && (
                <div className="flex justify-between text-sm">
                  <span>Add-ons:</span>
                  <span>${addonCosts.toFixed(2)}</span>
                </div>
              )}
              <div className="flex justify-between font-semibold pt-2 border-t">
                <span>Line Total:</span>
                <span>${lineTotal.toFixed(2)}</span>
              </div>
            </div>

            {/* Actions */}
            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => onOpenChange(false)} disabled={saving}>
                Cancel
              </Button>
              <Button onClick={handleSave} disabled={saving}>
                {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Save Changes
              </Button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
