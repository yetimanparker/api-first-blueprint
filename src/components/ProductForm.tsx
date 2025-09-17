import { useState, useEffect } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { Plus, Trash2, GripVertical, Upload, Image } from "lucide-react";
import { Form, FormControl, FormDescription, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";

const productSchema = z.object({
  name: z.string().min(1, "Product name is required"),
  description: z.string().optional(),
  unit_price: z.number().min(0, "Price must be positive"),
  unit_type: z.enum(["sq_ft", "linear_ft", "cu_ft", "each"]),
  color_hex: z.string().regex(/^#[0-9A-F]{6}$/i, "Invalid hex color"),
  is_active: z.boolean(),
  show_pricing_before_submit: z.boolean(),
  display_order: z.number().optional(),
  photo_url: z.string().optional(),
});

type ProductFormData = z.infer<typeof productSchema>;

interface ProductAddon {
  id?: string;
  name: string;
  description: string;
  price_type: "fixed" | "percentage";
  price_value: number;
  display_order: number;
  is_active: boolean;
  calculation_type: "total" | "per_unit" | "area_calculation";
  calculation_formula?: string;
}

interface ProductVariation {
  id?: string;
  name: string;
  description: string;
  price_adjustment: number;
  adjustment_type: "fixed" | "percentage";
  display_order: number;
  is_active: boolean;
}

interface Product {
  id: string;
  name: string;
  description: string | null;
  unit_price: number;
  unit_type: string;
  color_hex: string;
  is_active: boolean;
  show_pricing_before_submit: boolean;
  display_order: number | null;
  photo_url?: string | null;
  product_addons?: ProductAddon[];
  product_variations?: ProductVariation[];
}

interface ProductFormProps {
  product?: Product | null;
  onSaved: () => void;
  onCancel: () => void;
}

export function ProductForm({ product, onSaved, onCancel }: ProductFormProps) {
  const [addons, setAddons] = useState<ProductAddon[]>([]);
  const [variations, setVariations] = useState<ProductVariation[]>([]);
  const [loading, setLoading] = useState(false);
  const [photoFile, setPhotoFile] = useState<File | null>(null);
  const [photoPreview, setPhotoPreview] = useState<string | null>(null);
  const { toast } = useToast();

  const form = useForm<ProductFormData>({
    resolver: zodResolver(productSchema),
    defaultValues: {
      name: product?.name || "",
      description: product?.description || "",
      unit_price: product?.unit_price || 0,
      unit_type: (product?.unit_type as any) || "sq_ft",
      color_hex: product?.color_hex || "#3B82F6",
      is_active: product?.is_active ?? true,
      show_pricing_before_submit: product?.show_pricing_before_submit ?? true,
      display_order: product?.display_order || 0,
      photo_url: product?.photo_url || "",
    },
  });

  useEffect(() => {
    if (product?.product_addons) {
      setAddons(product.product_addons.map((addon, index) => ({
        ...addon,
        display_order: addon.display_order || index,
        calculation_type: addon.calculation_type || "total",
        calculation_formula: addon.calculation_formula || "",
      })));
    }
    if (product?.product_variations) {
      setVariations(product.product_variations.map((variation, index) => ({
        ...variation,
        display_order: variation.display_order || index,
      })));
    }
    if (product?.photo_url) {
      setPhotoPreview(product.photo_url);
    }
  }, [product]);

  const addNewAddon = () => {
    const newAddon: ProductAddon = {
      name: "",
      description: "",
      price_type: "fixed",
      price_value: 0,
      display_order: addons.length,
      is_active: true,
      calculation_type: "total",
      calculation_formula: "",
    };
    setAddons([...addons, newAddon]);
  };

  const addNewVariation = () => {
    const newVariation: ProductVariation = {
      name: "",
      description: "",
      price_adjustment: 0,
      adjustment_type: "fixed",
      display_order: variations.length,
      is_active: true,
    };
    setVariations([...variations, newVariation]);
  };

  const updateAddon = (index: number, field: keyof ProductAddon, value: any) => {
    const updatedAddons = [...addons];
    updatedAddons[index] = { ...updatedAddons[index], [field]: value };
    setAddons(updatedAddons);
  };

  const removeAddon = (index: number) => {
    setAddons(addons.filter((_, i) => i !== index));
  };

  const updateVariation = (index: number, field: keyof ProductVariation, value: any) => {
    const updatedVariations = [...variations];
    updatedVariations[index] = { ...updatedVariations[index], [field]: value };
    setVariations(updatedVariations);
  };

  const removeVariation = (index: number) => {
    setVariations(variations.filter((_, i) => i !== index));
  };

  const handlePhotoChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setPhotoFile(file);
      const reader = new FileReader();
      reader.onload = (e) => {
        setPhotoPreview(e.target?.result as string);
      };
      reader.readAsDataURL(file);
    }
  };

  const onSubmit = async (data: ProductFormData) => {
    setLoading(true);
    try {
      // Get current contractor ID for new products
      const { data: contractorData, error: contractorError } = await supabase
        .from("contractors")
        .select("id")
        .maybeSingle();

      if (contractorError) throw contractorError;

      if (!contractorData) {
        throw new Error("Please set up your contractor profile first by going to Settings");
      }

      let productData = {
        name: data.name,
        description: data.description || null,
        unit_price: Number(data.unit_price),
        unit_type: data.unit_type,
        color_hex: data.color_hex,
        is_active: data.is_active,
        show_pricing_before_submit: data.show_pricing_before_submit,
        display_order: data.display_order || 0,
        photo_url: data.photo_url || null,
        contractor_id: contractorData.id,
      };

      let productId = product?.id;

      if (product) {
        // Update existing product
        const { contractor_id, ...updateData } = productData;
        const { error } = await supabase
          .from("products")
          .update(updateData)
          .eq("id", product.id);

        if (error) throw error;
      } else {
        // Create new product
        const { data: newProduct, error } = await supabase
          .from("products")
          .insert(productData)
          .select()
          .single();

        if (error) throw error;
        productId = newProduct.id;
      }

      // Handle addons
      if (productId) {
        // Delete existing addons if editing
        if (product) {
          await supabase
            .from("product_addons")
            .delete()
            .eq("product_id", productId);
        }

        // Insert new/updated addons
        const validAddons = addons.filter(addon => addon.name.trim() && addon.price_value >= 0);
        if (validAddons.length > 0) {
          const addonsToInsert = validAddons.map((addon, index) => ({
            product_id: productId,
            name: addon.name.trim(),
            description: addon.description.trim() || null,
            price_type: addon.price_type,
            price_value: Number(addon.price_value),
            display_order: index,
            is_active: addon.is_active,
            calculation_type: addon.calculation_type,
            calculation_formula: addon.calculation_formula?.trim() || null,
          }));

          const { error: addonError } = await supabase
            .from("product_addons")
            .insert(addonsToInsert);

          if (addonError) throw addonError;
        }

        // Handle variations
        if (product) {
          await supabase
            .from("product_variations")
            .delete()
            .eq("product_id", productId);
        }

        const validVariations = variations.filter(variation => variation.name.trim());
        if (validVariations.length > 0) {
          const variationsToInsert = validVariations.map((variation, index) => ({
            product_id: productId,
            name: variation.name.trim(),
            description: variation.description.trim() || null,
            price_adjustment: Number(variation.price_adjustment),
            adjustment_type: variation.adjustment_type,
            display_order: index,
            is_active: variation.is_active,
          }));

          const { error: variationError } = await supabase
            .from("product_variations")
            .insert(variationsToInsert);

          if (variationError) throw variationError;
        }
      }

      toast({
        title: "Success",
        description: `Product ${product ? 'updated' : 'created'} successfully`,
      });

      onSaved();
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const unitTypeOptions = [
    { value: "sq_ft", label: "Square Feet" },
    { value: "linear_ft", label: "Linear Feet" },
    { value: "cu_ft", label: "Cubic Feet" },
    { value: "each", label: "Each" },
  ];

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <FormField
            control={form.control}
            name="name"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Product Name</FormLabel>
                <FormControl>
                  <Input placeholder="e.g., Premium Flooring" {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name="unit_type"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Unit Type</FormLabel>
                <Select onValueChange={field.onChange} defaultValue={field.value}>
                  <FormControl>
                    <SelectTrigger>
                      <SelectValue placeholder="Select unit type" />
                    </SelectTrigger>
                  </FormControl>
                  <SelectContent>
                    {unitTypeOptions.map((option) => (
                      <SelectItem key={option.value} value={option.value}>
                        {option.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <FormMessage />
              </FormItem>
            )}
          />
        </div>

        <FormField
          control={form.control}
          name="description"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Description</FormLabel>
              <FormControl>
                <Textarea 
                  placeholder="Product description..." 
                  {...field} 
                  value={field.value || ""}
                />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
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

          <FormField
            control={form.control}
            name="color_hex"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Color</FormLabel>
                <FormControl>
                  <div className="flex gap-2">
                    <Input type="color" {...field} className="w-16 h-10 p-1" />
                    <Input {...field} placeholder="#3B82F6" className="flex-1" />
                  </div>
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name="display_order"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Display Order</FormLabel>
                <FormControl>
                  <Input 
                    type="number" 
                    placeholder="0"
                    {...field}
                    onChange={(e) => field.onChange(parseInt(e.target.value) || 0)}
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <FormField
            control={form.control}
            name="is_active"
            render={({ field }) => (
              <FormItem className="flex flex-row items-center justify-between rounded-lg border p-4">
                <div className="space-y-0.5">
                  <FormLabel className="text-base">Active Product</FormLabel>
                  <FormDescription>
                    Active products are available for quotes
                  </FormDescription>
                </div>
                <FormControl>
                  <Switch
                    checked={field.value}
                    onCheckedChange={field.onChange}
                  />
                </FormControl>
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name="show_pricing_before_submit"
            render={({ field }) => (
              <FormItem className="flex flex-row items-center justify-between rounded-lg border p-4">
                <div className="space-y-0.5">
                  <FormLabel className="text-base">Show Pricing</FormLabel>
                  <FormDescription>
                    Show pricing before quote submission
                  </FormDescription>
                </div>
                <FormControl>
                  <Switch
                    checked={field.value}
                    onCheckedChange={field.onChange}
                  />
                </FormControl>
              </FormItem>
            )}
          />
        </div>

        {/* Product Photo */}
        <Card>
          <CardHeader>
            <CardTitle>Product Photo</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div className="flex items-center gap-4">
                <div className="flex-1">
                  <Input
                    type="file"
                    accept="image/*"
                    onChange={handlePhotoChange}
                    className="cursor-pointer"
                  />
                </div>
                {photoPreview && (
                  <div className="relative">
                    <img
                      src={photoPreview}
                      alt="Product preview"
                      className="w-20 h-20 object-cover rounded border"
                    />
                  </div>
                )}
              </div>
              <FormField
                control={form.control}
                name="photo_url"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Photo URL (optional)</FormLabel>
                    <FormControl>
                      <Input 
                        placeholder="https://example.com/photo.jpg" 
                        {...field} 
                        value={field.value || ""}
                      />
                    </FormControl>
                    <FormDescription>
                      You can also provide a direct URL to the product photo
                    </FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>
          </CardContent>
        </Card>

        {/* Product Variations */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center justify-between">
              Product Variations
              <Button type="button" variant="outline" size="sm" onClick={addNewVariation}>
                <Plus className="h-4 w-4 mr-2" />
                Add Variation
              </Button>
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {variations.length === 0 ? (
              <p className="text-muted-foreground text-center py-4">
                No variations yet. Add variations like different heights, sizes, or materials.
              </p>
            ) : (
              variations.map((variation, index) => (
                <Card key={index} className="p-4">
                  <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                    <div>
                      <Label htmlFor={`variation-name-${index}`}>Name</Label>
                      <Input
                        id={`variation-name-${index}`}
                        value={variation.name}
                        onChange={(e) => updateVariation(index, "name", e.target.value)}
                        placeholder="e.g., 6 inch height"
                      />
                    </div>
                    <div>
                      <Label htmlFor={`variation-description-${index}`}>Description</Label>
                      <Input
                        id={`variation-description-${index}`}
                        value={variation.description}
                        onChange={(e) => updateVariation(index, "description", e.target.value)}
                        placeholder="Optional description"
                      />
                    </div>
                    <div>
                      <Label htmlFor={`variation-adjustment-type-${index}`}>Price Type</Label>
                      <Select
                        value={variation.adjustment_type}
                        onValueChange={(value) => updateVariation(index, "adjustment_type", value)}
                      >
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="fixed">Fixed ($)</SelectItem>
                          <SelectItem value="percentage">Percentage (%)</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="flex gap-2">
                      <div className="flex-1">
                        <Label htmlFor={`variation-price-${index}`}>Price Adjustment</Label>
                        <Input
                          id={`variation-price-${index}`}
                          type="number"
                          step="0.01"
                          value={variation.price_adjustment}
                          onChange={(e) => updateVariation(index, "price_adjustment", parseFloat(e.target.value) || 0)}
                          placeholder="0.00"
                        />
                      </div>
                      <div className="flex items-end">
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          onClick={() => removeVariation(index)}
                          className="text-destructive hover:text-destructive"
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>
                  </div>
                  <div className="mt-3 flex items-center gap-2">
                    <Switch
                      checked={variation.is_active}
                      onCheckedChange={(checked) => updateVariation(index, "is_active", checked)}
                    />
                    <Label>Active</Label>
                  </div>
                </Card>
              ))
            )}
          </CardContent>
        </Card>

        {/* Add-ons Section */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center justify-between">
              Product Add-ons
              <Button type="button" variant="outline" size="sm" onClick={addNewAddon}>
                <Plus className="h-4 w-4 mr-2" />
                Add Add-on
              </Button>
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {addons.length === 0 ? (
              <p className="text-muted-foreground text-center py-4">
                No add-ons yet. Click "Add Add-on" to create optional upgrades for this product.
              </p>
            ) : (
              addons.map((addon, index) => (
                <Card key={index} className="p-4">
                  <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                    <div>
                      <Label htmlFor={`addon-name-${index}`}>Name</Label>
                      <Input
                        id={`addon-name-${index}`}
                        value={addon.name}
                        onChange={(e) => updateAddon(index, "name", e.target.value)}
                        placeholder="e.g., Premium Finish"
                      />
                    </div>
                    <div>
                      <Label htmlFor={`addon-description-${index}`}>Description</Label>
                      <Input
                        id={`addon-description-${index}`}
                        value={addon.description}
                        onChange={(e) => updateAddon(index, "description", e.target.value)}
                        placeholder="Optional description"
                      />
                    </div>
                    <div>
                      <Label htmlFor={`addon-price-type-${index}`}>Price Type</Label>
                      <Select
                        value={addon.price_type}
                        onValueChange={(value) => updateAddon(index, "price_type", value)}
                      >
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="fixed">Fixed ($)</SelectItem>
                          <SelectItem value="percentage">Percentage (%)</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="flex gap-2">
                      <div className="flex-1">
                        <Label htmlFor={`addon-price-${index}`}>Price</Label>
                        <Input
                          id={`addon-price-${index}`}
                          type="number"
                          step="0.01"
                          value={addon.price_value}
                          onChange={(e) => updateAddon(index, "price_value", parseFloat(e.target.value) || 0)}
                          placeholder="0.00"
                        />
                      </div>
                      <div className="flex items-end">
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          onClick={() => removeAddon(index)}
                          className="text-destructive hover:text-destructive"
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>
                  </div>
                  
                  {/* Enhanced Add-on Options */}
                  <div className="mt-4 grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <Label htmlFor={`addon-calculation-type-${index}`}>Calculation Type</Label>
                      <Select
                        value={addon.calculation_type}
                        onValueChange={(value) => updateAddon(index, "calculation_type", value)}
                      >
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="total">Apply to Total</SelectItem>
                          <SelectItem value="per_unit">Per Unit (e.g., per cubic yard)</SelectItem>
                          <SelectItem value="area_calculation">Area Calculation (height × linear ft)</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    {addon.calculation_type === "area_calculation" && (
                      <div>
                        <Label htmlFor={`addon-formula-${index}`}>Formula</Label>
                        <Input
                          id={`addon-formula-${index}`}
                          value={addon.calculation_formula || ""}
                          onChange={(e) => updateAddon(index, "calculation_formula", e.target.value)}
                          placeholder="e.g., height * linear_ft"
                        />
                      </div>
                    )}
                  </div>
                  
                  <div className="mt-3 flex items-center gap-2">
                    <Switch
                      checked={addon.is_active}
                      onCheckedChange={(checked) => updateAddon(index, "is_active", checked)}
                    />
                    <Label>Active</Label>
                  </div>
                </Card>
              ))
            )}
          </CardContent>
        </Card>

        <div className="flex justify-end gap-2">
          <Button type="button" variant="outline" onClick={onCancel}>
            Cancel
          </Button>
          <Button type="submit" disabled={loading}>
            {loading ? "Saving..." : product ? "Update Product" : "Create Product"}
          </Button>
        </div>
      </form>
    </Form>
  );
}