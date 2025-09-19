import { useState, useEffect } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { useToast } from "@/components/ui/use-toast";
import { useGlobalSettings } from "@/hooks/useGlobalSettings";
import { formatExactPrice, calculateTieredPrice, PricingTier, displayTieredPrice } from "@/lib/priceUtils";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage, FormDescription } from "@/components/ui/form";

const quoteItemSchema = z.object({
  product_id: z.string().min(1, "Product is required"),
  variation_id: z.string().optional(),
  quantity: z.number().min(0.01, "Quantity must be greater than 0"),
  unit_price: z.number().min(0, "Price must be positive"),
  notes: z.string().optional(),
  selected_addons: z.array(z.string()).optional(),
}).refine((data) => {
  // This will be dynamically validated in the component
  return true;
}, {
  message: "Quantity must meet minimum order requirements",
  path: ["quantity"],
});

type QuoteItemFormData = z.infer<typeof quoteItemSchema>;

interface ProductVariation {
  id: string;
  name: string;
  description: string | null;
  price_adjustment: number;
  adjustment_type: "fixed" | "percentage";
  display_order: number;
  is_active: boolean;
  height_value?: number | null;
  unit_of_measurement: string;
  affects_area_calculation: boolean;
}

interface ProductAddon {
  id: string;
  name: string;
  description: string | null;
  price_value: number;
  price_type: "fixed" | "percentage";
  calculation_type: "per_unit" | "total";
  is_active: boolean;
  display_order: number;
}

interface Product {
  id: string;
  name: string;
  unit_price: number;
  min_order_quantity: number;
  unit_type: string;
  category?: string;
  use_tiered_pricing?: boolean;
  product_variations?: ProductVariation[];
  pricing_tiers?: PricingTier[];
  product_addons?: ProductAddon[];
}

interface QuoteItemFormProps {
  quoteId: string;
  onItemAdded: () => void;
}

export function QuoteItemForm({ quoteId, onItemAdded }: QuoteItemFormProps) {
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(false);
  const [loadingProducts, setLoadingProducts] = useState(true);
  const [selectedAddons, setSelectedAddons] = useState<string[]>([]);
  const { toast } = useToast();
  const { settings } = useGlobalSettings();

  const form = useForm<QuoteItemFormData>({
    resolver: zodResolver(quoteItemSchema),
    defaultValues: {
      product_id: "",
      variation_id: "",
      quantity: 1,
      unit_price: 0,
      notes: "",
      selected_addons: [],
    },
  });

  useEffect(() => {
    fetchProducts();
  }, []);

  const fetchProducts = async () => {
    try {
      setLoadingProducts(true);
      const { data, error } = await supabase
        .from('products')
        .select(`
          id, 
          name, 
          unit_price,
          min_order_quantity, 
          unit_type, 
          category,
          use_tiered_pricing,
          product_variations(
            id,
            name,
            description,
            price_adjustment,
            adjustment_type,
            display_order,
            is_active,
            height_value,
            unit_of_measurement,
            affects_area_calculation
          ),
          product_pricing_tiers(
            id,
            tier_name,
            min_quantity,
            max_quantity,
            tier_price,
            is_active,
            display_order
          ),
          product_addons(
            id,
            name,
            description,
            price_value,
            price_type,
            calculation_type,
            is_active,
            display_order
          )
        `)
        .eq('is_active', true)
        .order('name');

      if (error) throw error;
      
      // Type cast the data to ensure proper typing
      const typedProducts = (data || []).map(product => ({
        ...product,
        product_variations: product.product_variations?.map(variation => ({
          ...variation,
          adjustment_type: variation.adjustment_type as "fixed" | "percentage"
        })) || [],
        product_addons: product.product_addons?.map(addon => ({
          ...addon,
          price_type: addon.price_type as "fixed" | "percentage",
          calculation_type: addon.calculation_type as "per_unit" | "total"
        })) || []
      }));
      
      setProducts(typedProducts);
    } catch (error) {
      console.error('Error fetching products:', error);
      toast({
        title: "Error",
        description: "Failed to load products",
        variant: "destructive",
      });
    } finally {
      setLoadingProducts(false);
    }
  };

  const selectedProductId = form.watch("product_id");
  const selectedVariationId = form.watch("variation_id");
  const quantity = form.watch("quantity");
  const unitPrice = form.watch("unit_price");

  const selectedProduct = products.find(p => p.id === selectedProductId);
  const selectedVariation = selectedProduct?.product_variations?.find(v => v.id === selectedVariationId);

  // Calculate addon costs
  const addonCosts = selectedAddons.reduce((total, addonId) => {
    const addon = selectedProduct?.product_addons?.find(a => a.id === addonId);
    if (!addon) return total;
    
    if (addon.price_type === "fixed") {
      return total + (addon.calculation_type === "per_unit" ? addon.price_value * quantity : addon.price_value);
    } else {
      // Percentage addon
      const baseAmount = addon.calculation_type === "per_unit" ? unitPrice * quantity : unitPrice;
      return total + (baseAmount * addon.price_value / 100);
    }
  }, 0);

  useEffect(() => {
    // Reset selected addons when product changes
    if (selectedProductId) {
      setSelectedAddons([]);
      form.setValue("selected_addons", []);
    }
  }, [selectedProductId, form]);

  useEffect(() => {
    if (selectedProduct) {
      let basePrice = selectedProduct.unit_price;
      
      // Apply variation price adjustment if selected
      if (selectedVariation) {
        if (selectedVariation.adjustment_type === "percentage") {
          basePrice = basePrice * (1 + selectedVariation.price_adjustment / 100);
        } else {
          basePrice = basePrice + selectedVariation.price_adjustment;
        }
      }

      // Apply tiered pricing if enabled
      if (selectedProduct.use_tiered_pricing && selectedProduct.pricing_tiers && quantity > 0) {
        const tieredPrice = calculateTieredPrice(quantity, selectedProduct.pricing_tiers, basePrice);
        form.setValue("unit_price", tieredPrice);
      } else {
        form.setValue("unit_price", basePrice);
      }
    }
  }, [selectedProduct, selectedVariation, quantity, form]);

  const lineTotal = (quantity * unitPrice) + addonCosts;

  const onSubmit = async (data: QuoteItemFormData) => {
    setLoading(true);
    try {
      // Prepare addon data
      let addonData = null;
      if (selectedAddons.length > 0 && selectedProduct) {
        addonData = selectedAddons.map(addonId => {
          const addon = selectedProduct.product_addons?.find(a => a.id === addonId);
          if (!addon) return null;
          
          let addonCost = 0;
          if (addon.price_type === "fixed") {
            addonCost = addon.calculation_type === "per_unit" ? addon.price_value * data.quantity : addon.price_value;
          } else {
            const baseAmount = addon.calculation_type === "per_unit" ? data.unit_price * data.quantity : data.unit_price;
            addonCost = baseAmount * addon.price_value / 100;
          }
          
          return {
            addon_id: addon.id,
            addon_name: addon.name,
            addon_price: addon.price_value,
            addon_cost: addonCost,
            price_type: addon.price_type,
            calculation_type: addon.calculation_type,
          };
        }).filter(Boolean);
      }

      // Prepare measurement data with variation info
      let measurementData = null;
      if (selectedVariation) {
        measurementData = {
          variation_id: selectedVariation.id,
          variation_name: selectedVariation.name,
          height: selectedVariation.height_value,
          unit: selectedVariation.unit_of_measurement,
          affects_area_calculation: selectedVariation.affects_area_calculation,
          addons: addonData,
        };
      } else if (addonData) {
        measurementData = {
          addons: addonData,
        };
      }

      const { error } = await supabase
        .from('quote_items')
        .insert({
          quote_id: quoteId,
          product_id: data.product_id,
          quantity: data.quantity,
          unit_price: data.unit_price,
          line_total: (data.quantity * data.unit_price) + addonCosts,
          notes: data.notes || null,
          measurement_data: measurementData,
        });

      if (error) throw error;

      // Update quote total
      const { data: quoteItems, error: itemsError } = await supabase
        .from('quote_items')
        .select('line_total')
        .eq('quote_id', quoteId);

      if (itemsError) throw itemsError;

      const totalAmount = quoteItems.reduce((sum, item) => sum + item.line_total, 0);

      const { error: updateError } = await supabase
        .from('quotes')
        .update({ total_amount: totalAmount })
        .eq('id', quoteId);

      if (updateError) throw updateError;

      toast({
        title: "Success",
        description: "Item added to quote successfully",
      });

      form.reset();
      setSelectedAddons([]);
      onItemAdded();
    } catch (error: any) {
      console.error('Error adding quote item:', error);
      toast({
        title: "Error",
        description: error.message || "Failed to add item to quote",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  if (loadingProducts) {
    return (
      <Card>
        <CardContent className="p-6">
          <div className="text-center">Loading products...</div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Add Item to Quote</CardTitle>
      </CardHeader>
      <CardContent>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            <FormField
              control={form.control}
              name="product_id"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Product</FormLabel>
                  <Select onValueChange={(value) => {
                    field.onChange(value);
                    form.setValue("variation_id", ""); // Reset variation when product changes
                  }} value={field.value}>
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue placeholder="Select a product" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      {products.map((product) => (
                        <SelectItem key={product.id} value={product.id}>
                          {product.name} - {settings ? formatExactPrice(product.unit_price, {
                            currency_symbol: settings.currency_symbol || '$',
                            decimal_precision: settings.decimal_precision || 2
                          }) : `$${product.unit_price}`}/{product.unit_type}
                          {product.min_order_quantity > 1 && ` (Min: ${product.min_order_quantity} ${product.unit_type})`}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />

            {selectedProduct?.product_variations && selectedProduct.product_variations.length > 0 && (
              <FormField
                control={form.control}
                name="variation_id"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Variation (Optional)</FormLabel>
                    <Select onValueChange={field.onChange} value={field.value}>
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="Select a variation" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value="">No variation</SelectItem>
                        {selectedProduct.product_variations.map((variation) => (
                          <SelectItem key={variation.id} value={variation.id}>
                            {variation.name} 
                            {variation.height_value && ` (${variation.height_value}${variation.unit_of_measurement})`}
                            {variation.adjustment_type === "fixed" 
                              ? ` (+$${variation.price_adjustment})`
                              : ` (+${variation.price_adjustment}%)`
                            }
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />
            )}

            {selectedProduct?.product_addons && selectedProduct.product_addons.length > 0 && (
              <FormItem>
                <FormLabel>Add-ons (Optional)</FormLabel>
                <div className="space-y-2">
                  {selectedProduct.product_addons
                    .filter(addon => addon.is_active)
                    .sort((a, b) => a.display_order - b.display_order)
                    .map((addon) => (
                     <div key={addon.id} className="flex items-center space-x-2">
                       <Checkbox
                         id={addon.id}
                         checked={selectedAddons.includes(addon.id)}
                         onCheckedChange={(checked) => {
                           const newSelectedAddons = checked
                             ? [...selectedAddons, addon.id]
                             : selectedAddons.filter(id => id !== addon.id);
                           setSelectedAddons(newSelectedAddons);
                           form.setValue("selected_addons", newSelectedAddons);
                         }}
                       />
                       <label htmlFor={addon.id} className="flex-1 cursor-pointer">
                         <div className="flex justify-between items-center">
                           <span className="font-medium">{addon.name}</span>
                           <span className="text-sm text-muted-foreground">
                             {addon.price_type === "fixed" 
                               ? `+${settings ? formatExactPrice(addon.price_value, {
                                   currency_symbol: settings.currency_symbol || '$',
                                   decimal_precision: settings.decimal_precision || 2
                                 }) : `$${addon.price_value}`}${addon.calculation_type === "per_unit" ? ` per ${selectedProduct.unit_type}` : ""}`
                               : `+${addon.price_value}%`
                             }
                           </span>
                         </div>
                         {addon.description && (
                           <div className="text-sm text-muted-foreground">{addon.description}</div>
                         )}
                       </label>
                     </div>
                  ))}
                </div>
              </FormItem>
            )}

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <FormField
                control={form.control}
                name="quantity"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Quantity</FormLabel>
                    <FormControl>
                      <Input
                        type="number"
                        step="0.01"
                        placeholder="1.00"
                        {...field}
                        onChange={(e) => {
                          const value = parseFloat(e.target.value) || 0;
                          field.onChange(value);
                          
                          // Validate minimum order quantity
                          if (selectedProduct && value < selectedProduct.min_order_quantity) {
                            form.setError("quantity", {
                              message: `Minimum order quantity is ${selectedProduct.min_order_quantity} ${selectedProduct.unit_type}`
                            });
                          } else {
                            form.clearErrors("quantity");
                          }
                        }}
                      />
                    </FormControl>
                    {selectedProduct && selectedProduct.min_order_quantity > 1 && (
                      <FormDescription>
                        Minimum order: {selectedProduct.min_order_quantity} {selectedProduct.unit_type}
                      </FormDescription>
                    )}
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="unit_price"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Unit Price ($)</FormLabel>
                    <FormControl>
                      <Input
                        type="number"
                        step="0.01"
                        placeholder="0.00"
                        {...field}
                        onChange={(e) => field.onChange(parseFloat(e.target.value) || 0)}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            <FormField
              control={form.control}
              name="notes"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Notes (Optional)</FormLabel>
                  <FormControl>
                    <Textarea
                      placeholder="Additional notes for this item..."
                      {...field}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            {selectedProductId && quantity > 0 && unitPrice > 0 && (
              <div className="p-4 bg-muted rounded-lg">
                <div className="flex justify-between items-center">
                  <span className="font-medium">Line Total:</span>
                  <span className="text-lg font-bold text-primary">
                    {settings ? formatExactPrice(lineTotal, {
                      currency_symbol: settings.currency_symbol || '$',
                      decimal_precision: settings.decimal_precision || 2
                    }) : `$${lineTotal.toFixed(2)}`}
                  </span>
                </div>
                 {selectedVariation && selectedVariation.height_value && (
                   <div className="text-sm text-muted-foreground mt-2">
                     Height: {selectedVariation.height_value}{selectedVariation.unit_of_measurement}
                     {selectedVariation.affects_area_calculation && " (Used in area calculations)"}
                   </div>
                 )}
                 {selectedAddons.length > 0 && (
                   <div className="text-sm text-muted-foreground mt-2">
                     <div className="font-medium">Add-ons:</div>
                     {selectedAddons.map(addonId => {
                       const addon = selectedProduct?.product_addons?.find(a => a.id === addonId);
                       if (!addon) return null;
                       
                       let addonCost = 0;
                       if (addon.price_type === "fixed") {
                         addonCost = addon.calculation_type === "per_unit" ? addon.price_value * quantity : addon.price_value;
                       } else {
                         const baseAmount = addon.calculation_type === "per_unit" ? unitPrice * quantity : unitPrice;
                         addonCost = baseAmount * addon.price_value / 100;
                       }
                       
                       return (
                         <div key={addon.id} className="flex justify-between">
                           <span>{addon.name}</span>
                           <span>
                             +{settings ? formatExactPrice(addonCost, {
                               currency_symbol: settings.currency_symbol || '$',
                               decimal_precision: settings.decimal_precision || 2
                             }) : `$${addonCost.toFixed(2)}`}
                           </span>
                         </div>
                       );
                     })}
                   </div>
                 )}
              </div>
            )}

            <div className="flex justify-end">
              <Button type="submit" disabled={loading}>
                {loading ? "Adding..." : "Add to Quote"}
              </Button>
            </div>
          </form>
        </Form>
      </CardContent>
    </Card>
  );
}