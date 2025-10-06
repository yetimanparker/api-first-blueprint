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
import { useGlobalSettings, useProductCategories } from "@/hooks/useGlobalSettings";
import { displayPrice, calculateFinalPrice, PricingTier, validateTiers } from "@/lib/priceUtils";
import { Plus, Trash2, GripVertical, Upload, Image } from "lucide-react";
import { Form, FormControl, FormDescription, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";

const productSchema = z.object({
  name: z.string().min(1, "Product name is required"),
  description: z.string().optional(),
  unit_price: z.number().min(0, "Price must be positive"),
  min_order_quantity: z.number().min(0.01, "Minimum order quantity must be greater than 0"),
  unit_type: z.enum(["sq_ft", "linear_ft", "each", "hour", "cubic_yard", "pound", "ton", "pallet"]),
  color_hex: z.string().regex(/^#[0-9A-F]{6}$/i, "Invalid hex color"),
  is_active: z.boolean(),
  show_pricing_before_submit: z.boolean(),
  use_tiered_pricing: z.boolean(),
  display_order: z.number().optional(),
  photo_url: z.string().optional(),
  category: z.string().min(1, "Category is required"),
  subcategory: z.string().optional(),
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
  height_value?: number;
  unit_of_measurement: string;
  affects_area_calculation: boolean;
}

interface Product {
  id: string;
  name: string;
  description: string | null;
  unit_price: number;
  min_order_quantity: number;
  unit_type: string;
  color_hex: string;
  is_active: boolean;
  show_pricing_before_submit: boolean;
  use_tiered_pricing?: boolean;
  display_order: number | null;
  photo_url?: string | null;
  category?: string | null;
  subcategory?: string | null;
  product_addons?: ProductAddon[];
  product_variations?: ProductVariation[];
  pricing_tiers?: PricingTier[];
}

interface ProductFormProps {
  product?: Product | null;
  onSaved: () => void;
  onCancel: () => void;
}

export function ProductForm({ product, onSaved, onCancel }: ProductFormProps) {
  const [addons, setAddons] = useState<ProductAddon[]>([]);
  const [variations, setVariations] = useState<ProductVariation[]>([]);
  const [pricingTiers, setPricingTiers] = useState<PricingTier[]>([]);
  const [loading, setLoading] = useState(false);
  const [photoFile, setPhotoFile] = useState<File | null>(null);
  const [photoPreview, setPhotoPreview] = useState<string | null>(null);
  const { toast } = useToast();
  const { settings: globalSettings } = useGlobalSettings();
  const { categories, getSubcategoriesForCategory } = useProductCategories();

  const form = useForm<ProductFormData>({
    resolver: zodResolver(productSchema),
    defaultValues: {
      name: product?.name || "",
      description: product?.description || "",
      unit_price: product?.unit_price || 0,
      min_order_quantity: product?.min_order_quantity || 1,
      unit_type: (product?.unit_type as any) || globalSettings?.default_unit_type || "sq_ft",
      color_hex: product?.color_hex || globalSettings?.default_product_color || "#3B82F6",
      is_active: product?.is_active ?? (globalSettings?.auto_activate_products ?? true),
      show_pricing_before_submit: product?.show_pricing_before_submit ?? true,
      use_tiered_pricing: product?.use_tiered_pricing ?? false,
      display_order: product?.display_order || 0,
      photo_url: product?.photo_url || "",
      category: product?.category || "",
      subcategory: product?.subcategory || "",
    },
  });

  useEffect(() => {
    if (product?.product_addons) {
      setAddons(product.product_addons.map((addon, index) => ({
        ...addon,
        name: addon.name || "",
        description: addon.description || "",
        display_order: addon.display_order || index,
        calculation_type: addon.calculation_type || "total",
        calculation_formula: addon.calculation_formula || "",
      })));
    }
    if (product?.product_variations) {
      setVariations(product.product_variations.map((variation, index) => ({
        ...variation,
        name: variation.name || "",
        description: variation.description || "",
        display_order: variation.display_order || index,
      })));
    }
    if (product?.pricing_tiers) {
      setPricingTiers(product.pricing_tiers.map((tier, index) => ({
        ...tier,
        display_order: tier.display_order || index,
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
      height_value: undefined,
      unit_of_measurement: "ft",
      affects_area_calculation: false,
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

  const addNewPricingTier = () => {
    const newTier: PricingTier = {
      id: `temp-${Date.now()}`,
      tier_name: "",
      min_quantity: 1,
      max_quantity: null,
      tier_price: 0,
      is_active: true,
      display_order: pricingTiers.length,
    };
    setPricingTiers([...pricingTiers, newTier]);
  };

  const updatePricingTier = (index: number, field: keyof PricingTier, value: any) => {
    const updatedTiers = [...pricingTiers];
    updatedTiers[index] = { ...updatedTiers[index], [field]: value };
    setPricingTiers(updatedTiers);
  };

  const removePricingTier = (index: number) => {
    setPricingTiers(pricingTiers.filter((_, i) => i !== index));
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

      // Upload photo if a new file was selected
      let photoUrl = data.photo_url || null;
      if (photoFile) {
        const fileExt = photoFile.name.split('.').pop();
        const fileName = `${contractorData.id}/${Date.now()}.${fileExt}`;
        
        const { data: uploadData, error: uploadError } = await supabase.storage
          .from('product-photos')
          .upload(fileName, photoFile, {
            cacheControl: '3600',
            upsert: false
          });

        if (uploadError) {
          console.error('Photo upload error:', uploadError);
          throw new Error('Failed to upload photo');
        }

        // Get public URL
        const { data: { publicUrl } } = supabase.storage
          .from('product-photos')
          .getPublicUrl(fileName);
        
        photoUrl = publicUrl;
      }

      let productData = {
        name: data.name,
        description: data.description || null,
        unit_price: Number(data.unit_price),
        min_order_quantity: Number(data.min_order_quantity),
        unit_type: data.unit_type,
        color_hex: data.color_hex,
        is_active: data.is_active,
        show_pricing_before_submit: data.show_pricing_before_submit,
        use_tiered_pricing: data.use_tiered_pricing,
        display_order: data.display_order || 0,
        photo_url: photoUrl,
        category: data.category,
        subcategory: data.subcategory || null,
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
        const validAddons = addons.filter(addon => (addon.name || "").trim() && addon.price_value >= 0);
        if (validAddons.length > 0) {
          const addonsToInsert = validAddons.map((addon, index) => ({
            product_id: productId,
            name: (addon.name || "").trim(),
            description: (addon.description || "").trim() || null,
            price_type: addon.price_type,
            price_value: Number(addon.price_value),
            display_order: index,
            is_active: addon.is_active,
            calculation_type: addon.calculation_type,
            calculation_formula: (addon.calculation_formula || "").trim() || null,
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

        const validVariations = variations.filter(variation => (variation.name || "").trim());
        if (validVariations.length > 0) {
          const variationsToInsert = validVariations.map((variation, index) => ({
            product_id: productId,
            name: (variation.name || "").trim(),
            description: (variation.description || "").trim() || null,
            price_adjustment: Number(variation.price_adjustment),
            adjustment_type: variation.adjustment_type,
            display_order: index,
            is_active: variation.is_active,
            height_value: variation.height_value || null,
            unit_of_measurement: variation.unit_of_measurement || "ft",
            affects_area_calculation: variation.affects_area_calculation || false,
          }));

          const { error: variationError } = await supabase
            .from("product_variations")
            .insert(variationsToInsert);

          if (variationError) throw variationError;
        }

        // Handle pricing tiers
        if (product) {
          await supabase
            .from("product_pricing_tiers")
            .delete()
            .eq("product_id", productId);
        }

        const validTiers = pricingTiers.filter(tier => (tier.tier_name || "").trim() && tier.min_quantity > 0 && tier.tier_price >= 0);
        if (validTiers.length > 0) {
          // Validate tiers before inserting
          const tierErrors = validateTiers(validTiers);
          if (tierErrors.length > 0) {
            throw new Error(`Pricing tier validation errors: ${tierErrors.join(', ')}`);
          }

          const tiersToInsert = validTiers.map((tier, index) => ({
            product_id: productId,
            contractor_id: contractorData.id,
            tier_name: (tier.tier_name || "").trim(),
            min_quantity: Number(tier.min_quantity),
            max_quantity: tier.max_quantity ? Number(tier.max_quantity) : null,
            tier_price: Number(tier.tier_price),
            is_active: tier.is_active,
            display_order: index,
          }));

          const { error: tierError } = await supabase
            .from("product_pricing_tiers")
            .insert(tiersToInsert);

          if (tierError) throw tierError;
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
    { value: "cubic_yard", label: "Cubic Yards" },
    { value: "each", label: "Each" },
    { value: "hour", label: "Hours" },
    { value: "pound", label: "Pounds" },
    { value: "ton", label: "Tons" },
    { value: "pallet", label: "Pallets" },
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

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <FormField
            control={form.control}
            name="category"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Category</FormLabel>
                <Select onValueChange={field.onChange} defaultValue={field.value}>
                  <FormControl>
                    <SelectTrigger>
                      <SelectValue placeholder="Select category" />
                    </SelectTrigger>
                  </FormControl>
                  <SelectContent>
                    {categories.map((category) => (
                      <SelectItem key={category.id} value={category.id}>
                        {category.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <FormMessage />
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name="subcategory"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Subcategory (Optional)</FormLabel>
                <Select onValueChange={field.onChange} defaultValue={field.value || ""}>
                  <FormControl>
                    <SelectTrigger>
                      <SelectValue placeholder="Select subcategory" />
                    </SelectTrigger>
                  </FormControl>
                  <SelectContent>
                    {getSubcategoriesForCategory(form.watch("category") || "")
                      .map((subcategory) => (
                        <SelectItem key={subcategory.id} value={subcategory.id}>
                          {subcategory.name}
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
            name="min_order_quantity"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Minimum Order Quantity</FormLabel>
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

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
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

          <FormField
            control={form.control}
            name="use_tiered_pricing"
            render={({ field }) => (
              <FormItem className="flex flex-row items-center justify-between rounded-lg border p-4">
                <div className="space-y-0.5">
                  <FormLabel className="text-base">Tiered Pricing</FormLabel>
                  <FormDescription>
                    Use quantity-based pricing tiers
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
                          value={variation.name || ""}
                          onChange={(e) => updateVariation(index, "name", e.target.value)}
                          placeholder="e.g., 6ft Height"
                        />
                     </div>
                     <div>
                       <Label htmlFor={`variation-description-${index}`}>Description</Label>
                        <Input
                          id={`variation-description-${index}`}
                          value={variation.description || ""}
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
                   
                   {/* Height and Area Calculation Section */}
                   <div className="mt-4 grid grid-cols-1 md:grid-cols-3 gap-4 p-3 bg-muted/50 rounded-lg">
                     <div>
                       <Label htmlFor={`variation-height-${index}`}>Height Value (Optional)</Label>
                       <Input
                         id={`variation-height-${index}`}
                         type="number"
                         step="0.01"
                         value={variation.height_value || ""}
                         onChange={(e) => updateVariation(index, "height_value", parseFloat(e.target.value) || undefined)}
                         placeholder="e.g., 6, 8"
                       />
                     </div>
                     <div>
                       <Label htmlFor={`variation-unit-${index}`}>Unit of Measurement</Label>
                       <Select
                         value={variation.unit_of_measurement}
                         onValueChange={(value) => updateVariation(index, "unit_of_measurement", value)}
                       >
                         <SelectTrigger>
                           <SelectValue />
                         </SelectTrigger>
                         <SelectContent>
                           <SelectItem value="ft">Feet</SelectItem>
                           <SelectItem value="inches">Inches</SelectItem>
                           <SelectItem value="m">Meters</SelectItem>
                           <SelectItem value="cm">Centimeters</SelectItem>
                         </SelectContent>
                       </Select>
                     </div>
                     <div className="flex items-center gap-2 pt-6">
                       <Switch
                         checked={variation.affects_area_calculation}
                         onCheckedChange={(checked) => updateVariation(index, "affects_area_calculation", checked)}
                       />
                       <Label>Use in area calculations</Label>
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
                         value={addon.name || ""}
                         onChange={(e) => updateAddon(index, "name", e.target.value)}
                         placeholder="e.g., Premium Finish"
                       />
                    </div>
                    <div>
                      <Label htmlFor={`addon-description-${index}`}>Description</Label>
                       <Input
                         id={`addon-description-${index}`}
                         value={addon.description || ""}
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

        {/* Tiered Pricing Section */}
        {form.watch("use_tiered_pricing") && (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center justify-between">
                Pricing Tiers
                <Button type="button" variant="outline" size="sm" onClick={addNewPricingTier}>
                  <Plus className="h-4 w-4 mr-2" />
                  Add Tier
                </Button>
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {pricingTiers.length === 0 ? (
                <p className="text-muted-foreground text-center py-4">
                  No pricing tiers yet. Add tiers to set different prices based on quantity ranges.
                </p>
              ) : (
                <>
                  {validateTiers(pricingTiers).length > 0 && (
                    <div className="p-3 bg-destructive/10 border border-destructive/20 rounded-md">
                      <p className="text-sm text-destructive font-medium mb-2">Tier Validation Errors:</p>
                      <ul className="text-sm text-destructive space-y-1">
                        {validateTiers(pricingTiers).map((error, i) => (
                          <li key={i}>• {error}</li>
                        ))}
                      </ul>
                    </div>
                  )}
                  {pricingTiers.map((tier, index) => (
                    <Card key={index} className="p-4">
                      <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
                        <div>
                          <Label htmlFor={`tier-name-${index}`}>Tier Name</Label>
                          <Input
                            id={`tier-name-${index}`}
                            value={tier.tier_name}
                            onChange={(e) => updatePricingTier(index, "tier_name", e.target.value)}
                            placeholder="e.g., Bulk Discount"
                          />
                        </div>
                        <div>
                          <Label htmlFor={`tier-min-${index}`}>Min Quantity</Label>
                          <Input
                            id={`tier-min-${index}`}
                            type="number"
                            min="1"
                            value={tier.min_quantity}
                            onChange={(e) => updatePricingTier(index, "min_quantity", parseInt(e.target.value) || 1)}
                            placeholder="1"
                          />
                        </div>
                        <div>
                          <Label htmlFor={`tier-max-${index}`}>Max Quantity</Label>
                          <Input
                            id={`tier-max-${index}`}
                            type="number"
                            value={tier.max_quantity || ""}
                            onChange={(e) => updatePricingTier(index, "max_quantity", e.target.value ? parseInt(e.target.value) : null)}
                            placeholder="Leave empty for unlimited"
                          />
                        </div>
                        <div>
                          <Label htmlFor={`tier-price-${index}`}>Price per Unit</Label>
                          <Input
                            id={`tier-price-${index}`}
                            type="number"
                            step="0.01"
                            min="0"
                            value={tier.tier_price}
                            onChange={(e) => updatePricingTier(index, "tier_price", parseFloat(e.target.value) || 0)}
                            placeholder="0.00"
                          />
                        </div>
                        <div className="flex items-end gap-2">
                          <div className="flex items-center gap-2">
                            <Switch
                              checked={tier.is_active}
                              onCheckedChange={(checked) => updatePricingTier(index, "is_active", checked)}
                            />
                            <Label className="text-sm">Active</Label>
                          </div>
                          <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            onClick={() => removePricingTier(index)}
                            className="text-destructive hover:text-destructive"
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      </div>
                      <div className="mt-2 text-xs text-muted-foreground">
                        Range: {tier.min_quantity}{tier.max_quantity ? `-${tier.max_quantity}` : '+'} units @ ${tier.tier_price || 0}/unit
                      </div>
                    </Card>
                  ))}
                </>
              )}
            </CardContent>
          </Card>
        )}

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