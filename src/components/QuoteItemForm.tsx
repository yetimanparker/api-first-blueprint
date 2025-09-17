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
import { useToast } from "@/components/ui/use-toast";
import { useGlobalSettings } from "@/hooks/useGlobalSettings";
import { displayPrice } from "@/lib/priceUtils";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";

const quoteItemSchema = z.object({
  product_id: z.string().min(1, "Product is required"),
  quantity: z.number().min(0.01, "Quantity must be greater than 0"),
  unit_price: z.number().min(0, "Price must be positive"),
  notes: z.string().optional(),
});

type QuoteItemFormData = z.infer<typeof quoteItemSchema>;

interface Product {
  id: string;
  name: string;
  unit_price: number;
  unit_type: string;
  category?: string;
}

interface QuoteItemFormProps {
  quoteId: string;
  onItemAdded: () => void;
}

export function QuoteItemForm({ quoteId, onItemAdded }: QuoteItemFormProps) {
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(false);
  const [loadingProducts, setLoadingProducts] = useState(true);
  const { toast } = useToast();
  const { settings } = useGlobalSettings();

  const form = useForm<QuoteItemFormData>({
    resolver: zodResolver(quoteItemSchema),
    defaultValues: {
      product_id: "",
      quantity: 1,
      unit_price: 0,
      notes: "",
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
        .select('id, name, unit_price, unit_type, category')
        .eq('is_active', true)
        .order('name');

      if (error) throw error;
      setProducts(data || []);
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
  const quantity = form.watch("quantity");
  const unitPrice = form.watch("unit_price");

  useEffect(() => {
    const selectedProduct = products.find(p => p.id === selectedProductId);
    if (selectedProduct) {
      form.setValue("unit_price", selectedProduct.unit_price);
    }
  }, [selectedProductId, products, form]);

  const lineTotal = quantity * unitPrice;

  const onSubmit = async (data: QuoteItemFormData) => {
    setLoading(true);
    try {
      const { error } = await supabase
        .from('quote_items')
        .insert({
          quote_id: quoteId,
          product_id: data.product_id,
          quantity: data.quantity,
          unit_price: data.unit_price,
          line_total: data.quantity * data.unit_price,
          notes: data.notes || null,
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
                  <Select onValueChange={field.onChange} value={field.value}>
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue placeholder="Select a product" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      {products.map((product) => (
                        <SelectItem key={product.id} value={product.id}>
                          {product.name} - {settings ? displayPrice(product.unit_price, settings) : `$${product.unit_price}`}/{product.unit_type}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />

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
                        onChange={(e) => field.onChange(parseFloat(e.target.value) || 0)}
                      />
                    </FormControl>
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
                    {settings ? displayPrice(lineTotal, settings) : `$${lineTotal.toFixed(2)}`}
                  </span>
                </div>
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