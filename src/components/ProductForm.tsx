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
import { Plus, Trash2, GripVertical, Upload, Image, Ruler, Package } from "lucide-react";
import { Form, FormControl, FormDescription, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { useContractorId } from "@/hooks/useContractorId";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";

const productSchema = z.object({
  name: z.string().min(1, "Product name is required"),
  description: z.string().optional(),
  unit_price: z.number().min(0, "Price must be positive"),
  min_order_quantity: z.number().min(0.01, "Minimum order quantity must be greater than 0"),
  unit_type: z.enum(["sq_ft", "linear_ft", "each", "hour", "cubic_yard", "pound", "ton", "pallet"]),
  is_active: z.boolean(),
  show_pricing_before_submit: z.boolean(),
  use_tiered_pricing: z.boolean(),
  display_order: z.number().optional(),
  photo_url: z.string().optional(),
  category: z.string().min(1, "Category is required"),
  subcategory: z.string().optional(),
  has_fixed_dimensions: z.boolean(),
  default_width: z.number().optional(),
  default_length: z.number().optional(),
  dimension_unit: z.string().optional(),
  allow_dimension_editing: z.boolean(),
  base_height: z.number().optional(),
  base_height_unit: z.string().optional(),
  use_height_in_calculation: z.boolean(),
  sold_in_increments_of: z.number().optional(),
  increment_unit_label: z.string().optional(),
  increment_description: z.string().optional(),
  allow_partial_increments: z.boolean(),
});

type ProductFormData = z.infer<typeof productSchema>;

interface ProductAddonOption {
  id?: string;
  name: string;
  description: string;
  price_adjustment: number;
  adjustment_type: 'fixed' | 'percentage';
  image_url?: string;
  display_order: number;
  is_active: boolean;
  is_default: boolean;
}

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
  addon_options?: ProductAddonOption[];
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
  is_required: boolean;
  is_default: boolean;
}

interface Product {
  id: string;
  name: string;
  description: string | null;
  unit_price: number;
  min_order_quantity: number;
  unit_type: string;
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
  has_fixed_dimensions?: boolean;
  default_width?: number | null;
  default_length?: number | null;
  dimension_unit?: string | null;
  allow_dimension_editing?: boolean;
  base_height?: number | null;
  base_height_unit?: string | null;
  use_height_in_calculation?: boolean;
  sold_in_increments_of?: number | null;
  increment_unit_label?: string | null;
  increment_description?: string | null;
  allow_partial_increments?: boolean;
}

interface ProductFormProps {
  product?: Product | null;
  onSaved: () => void;
  onCancel: () => void;
}

export function ProductForm({ product, onSaved, onCancel }: ProductFormProps) {
  const [addons, setAddons] = useState<ProductAddon[]>([]);
  const [addonOptions, setAddonOptions] = useState<Record<string, ProductAddonOption[]>>({});
  const [variations, setVariations] = useState<ProductVariation[]>([]);
  const [pricingTiers, setPricingTiers] = useState<PricingTier[]>([]);
  const [loading, setLoading] = useState(false);
  const [photoFile, setPhotoFile] = useState<File | null>(null);
  const [photoPreview, setPhotoPreview] = useState<string | null>(null);
  const [showNewCategoryDialog, setShowNewCategoryDialog] = useState(false);
  const [newCategoryName, setNewCategoryName] = useState("");
  const [newCategoryColor, setNewCategoryColor] = useState("#3B82F6");
  const [showNewSubcategoryDialog, setShowNewSubcategoryDialog] = useState(false);
  const [newSubcategoryName, setNewSubcategoryName] = useState("");
  const { toast } = useToast();
  const { settings: globalSettings } = useGlobalSettings();
  const { contractorId } = useContractorId();
  const { categories, getSubcategoriesForCategory, refetch: refetchCategories } = useProductCategories(contractorId);

  const form = useForm<ProductFormData>({
    resolver: zodResolver(productSchema),
    defaultValues: {
      name: product?.name || "",
      description: product?.description || "",
      unit_price: product?.unit_price || 0,
      min_order_quantity: product?.min_order_quantity || 1,
      unit_type: (product?.unit_type as any) || globalSettings?.default_unit_type || "sq_ft",
      is_active: product?.is_active ?? (globalSettings?.auto_activate_products ?? true),
      show_pricing_before_submit: product?.show_pricing_before_submit ?? true,
      use_tiered_pricing: product?.use_tiered_pricing ?? false,
      display_order: product?.display_order || 0,
      photo_url: product?.photo_url || "",
      category: product?.category || "",
      subcategory: product?.subcategory || "",
      has_fixed_dimensions: product?.has_fixed_dimensions ?? false,
      default_width: product?.default_width || undefined,
      default_length: product?.default_length || undefined,
      dimension_unit: product?.dimension_unit || "ft",
      allow_dimension_editing: product?.allow_dimension_editing ?? false,
      base_height: product?.base_height || undefined,
      base_height_unit: product?.base_height_unit || "ft",
      use_height_in_calculation: product?.use_height_in_calculation ?? false,
      sold_in_increments_of: product?.sold_in_increments_of || undefined,
      increment_unit_label: product?.increment_unit_label || "",
      increment_description: product?.increment_description || "",
      allow_partial_increments: product?.allow_partial_increments ?? false,
    },
  });

  useEffect(() => {
    const loadProductData = async () => {
      if (product?.product_addons) {
        setAddons(product.product_addons.map((addon, index) => ({
          ...addon,
          name: addon.name || "",
          description: addon.description || "",
          display_order: addon.display_order || index,
          calculation_type: addon.calculation_type || "total",
          calculation_formula: addon.calculation_formula || "",
        })));
        
        // Load addon options for existing addons
        const optionsMap: Record<string, ProductAddonOption[]> = {};
        for (const addon of product.product_addons) {
          if (addon.id) {
            const { data: options } = await supabase
              .from('product_addon_options')
              .select('*')
              .eq('addon_id', addon.id)
              .order('display_order');
            
            optionsMap[addon.id] = (options || []).map(opt => ({
              id: opt.id,
              name: opt.name,
              description: opt.description || "",
              price_adjustment: opt.price_adjustment,
              adjustment_type: opt.adjustment_type as 'fixed' | 'percentage',
              image_url: opt.image_url || undefined,
              display_order: opt.display_order,
              is_active: opt.is_active,
              is_default: opt.is_default || false
            }));
          }
        }
        setAddonOptions(optionsMap);
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
    };
    
    loadProductData();
  }, [product]);

  // Convert category/subcategory UUIDs to names for form initialization (only once)
  const [initialValuesSet, setInitialValuesSet] = useState(false);
  useEffect(() => {
    if (product && categories.length > 0 && !initialValuesSet) {
      // Check if category is a UUID (36 characters with dashes)
      const isUUID = (str: string) => /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(str);
      
      if (product.category && isUUID(product.category)) {
        // Find category name from UUID
        const category = categories.find(c => c.id === product.category);
        if (category) {
          form.setValue('category', category.name);
          
          // If there's a subcategory UUID, convert it too
          if (product.subcategory && isUUID(product.subcategory)) {
            const subcategories = getSubcategoriesForCategory(category.name);
            const subcategory = subcategories.find(s => s.id === product.subcategory);
            if (subcategory) {
              form.setValue('subcategory', subcategory.name);
            }
          }
        }
      }
      setInitialValuesSet(true);
    }
  }, [product, categories, initialValuesSet, form, getSubcategoriesForCategory]);

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
      is_required: false,
      is_default: false,
    };
    setVariations([...variations, newVariation]);
  };

  const updateAddon = (index: number, field: keyof ProductAddon, value: any) => {
    const updatedAddons = [...addons];
    updatedAddons[index] = { ...updatedAddons[index], [field]: value };
    
    // Auto-fill formula based on calculation type
    if (field === "calculation_type") {
      const formulas: Record<string, string> = {
        "total": "",
        "per_unit": "price_value * quantity",
        "area_calculation": "height * linear_ft"
      };
      updatedAddons[index].calculation_formula = formulas[value as string] || "";
    }
    
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

  const addNewAddonOption = (addonKey: string) => {
    const newOption: ProductAddonOption = {
      name: "",
      description: "",
      price_adjustment: 0,
      adjustment_type: "fixed",
      display_order: (addonOptions[addonKey] || []).length,
      is_active: true,
      is_default: false
    };
    
    setAddonOptions(prev => ({
      ...prev,
      [addonKey]: [...(prev[addonKey] || []), newOption]
    }));
  };

  const updateAddonOption = (addonKey: string, index: number, field: keyof ProductAddonOption, value: any) => {
    setAddonOptions(prev => {
      const updated = [...(prev[addonKey] || [])];
      updated[index] = { ...updated[index], [field]: value };
      
      // If setting is_default, unset all others
      if (field === 'is_default' && value === true) {
        updated.forEach((opt, i) => {
          if (i !== index) opt.is_default = false;
        });
      }
      
      return { ...prev, [addonKey]: updated };
    });
  };

  const removeAddonOption = (addonKey: string, index: number) => {
    setAddonOptions(prev => ({
      ...prev,
      [addonKey]: (prev[addonKey] || []).filter((_, i) => i !== index)
    }));
  };

  const handleOptionImageUpload = async (addonKey: string, optIndex: number, e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    
    const { data: contractorData } = await supabase
      .from("contractors")
      .select("id")
      .maybeSingle();
    
    if (!contractorData) return;
    
    const fileExt = file.name.split('.').pop();
    const fileName = `${contractorData.id}/addon-options/${Date.now()}.${fileExt}`;
    
    const { data, error } = await supabase.storage
      .from('product-photos')
      .upload(fileName, file);
    
    if (error) {
      toast({ title: "Upload failed", variant: "destructive", description: error.message });
      return;
    }
    
    const { data: { publicUrl } } = supabase.storage
      .from('product-photos')
      .getPublicUrl(fileName);
    
    updateAddonOption(addonKey, optIndex, 'image_url', publicUrl);
    toast({ title: "Image uploaded successfully" });
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

      // Convert category/subcategory names to UUIDs before saving
      const isUUID = (str: string) => /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(str);
      
      let categoryUUID = data.category;
      let subcategoryUUID = data.subcategory || null;

      // If category is a name (not UUID), convert to UUID
      if (data.category && !isUUID(data.category)) {
        const category = categories.find(c => c.name === data.category);
        categoryUUID = category?.id || data.category;
      }

      // If subcategory is a name (not UUID), convert to UUID
      if (data.subcategory && !isUUID(data.subcategory)) {
        const subcategories = getSubcategoriesForCategory(data.category);
        const subcategory = subcategories.find(s => s.name === data.subcategory);
        subcategoryUUID = subcategory?.id || null;
      }

      let productData = {
        name: data.name,
        description: data.description || null,
        unit_price: Number(data.unit_price),
        min_order_quantity: Number(data.min_order_quantity),
        unit_type: data.unit_type,
        is_active: data.is_active,
        show_pricing_before_submit: data.show_pricing_before_submit,
        use_tiered_pricing: data.use_tiered_pricing,
        display_order: data.display_order || 0,
        photo_url: photoUrl,
        category: categoryUUID,
        subcategory: subcategoryUUID,
        contractor_id: contractorData.id,
        has_fixed_dimensions: data.has_fixed_dimensions,
        default_width: data.has_fixed_dimensions && data.default_width ? Number(data.default_width) : null,
        default_length: data.has_fixed_dimensions && data.default_length ? Number(data.default_length) : null,
        dimension_unit: data.has_fixed_dimensions ? (data.dimension_unit || 'ft') : null,
        allow_dimension_editing: data.has_fixed_dimensions ? data.allow_dimension_editing : false,
        base_height: data.use_height_in_calculation && data.base_height ? Number(data.base_height) : null,
        base_height_unit: data.use_height_in_calculation ? (data.base_height_unit || 'ft') : null,
        use_height_in_calculation: data.use_height_in_calculation,
        sold_in_increments_of: data.sold_in_increments_of ? Number(data.sold_in_increments_of) : null,
        increment_unit_label: data.sold_in_increments_of ? (data.increment_unit_label || null) : null,
        increment_description: data.sold_in_increments_of ? (data.increment_description || null) : null,
        allow_partial_increments: data.sold_in_increments_of ? data.allow_partial_increments : false,
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

          const { data: insertedAddons, error: addonError } = await supabase
            .from("product_addons")
            .insert(addonsToInsert)
            .select();

          if (addonError) throw addonError;
          
          // Save addon options
          for (let i = 0; i < validAddons.length; i++) {
            const addon = validAddons[i];
            const insertedAddon = insertedAddons?.[i];
            if (!insertedAddon?.id) continue;
            
            // Use existing addon ID or temp key for new addons
            const addonKey = addon.id || `temp-${i}`;
            const addonId = insertedAddon.id;
            const options = addonOptions[addonKey] || [];
            const validOptions = options.filter(opt => opt.name.trim());
            
            if (validOptions.length > 0) {
              // Delete existing options for this addon
              await supabase
                .from('product_addon_options')
                .delete()
                .eq('addon_id', addonId);
              
              // Insert new options
              const optionsToInsert = validOptions.map((opt, index) => ({
                addon_id: addonId,
                name: opt.name.trim(),
                description: opt.description?.trim() || null,
                price_adjustment: Number(opt.price_adjustment),
                adjustment_type: opt.adjustment_type,
                image_url: opt.image_url || null,
                display_order: index,
                is_active: opt.is_active,
                is_default: opt.is_default
              }));
              
              await supabase
                .from('product_addon_options')
                .insert(optionsToInsert);
            }
          }
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
            is_required: variation.is_required || false,
            is_default: variation.is_default || false,
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

  const handleCreateCategory = async () => {
    if (!newCategoryName.trim()) {
      toast({
        title: "Error",
        description: "Category name is required",
        variant: "destructive",
      });
      return;
    }

    try {
      const { data: contractorData, error: contractorError } = await supabase
        .from("contractors")
        .select("id")
        .maybeSingle();

      if (contractorError) throw contractorError;
      if (!contractorData) throw new Error("Contractor profile not found");

      const { error } = await supabase
        .from("product_categories")
        .insert({
          contractor_id: contractorData.id,
          name: newCategoryName.trim(),
          color_hex: newCategoryColor,
          display_order: categories.length,
          is_active: true,
        });

      if (error) throw error;

      toast({
        title: "Success",
        description: "Category created successfully",
      });

      // Refresh categories and select the new one
      await refetchCategories();
      form.setValue("category", newCategoryName.trim());
      
      // Reset and close dialog
      setNewCategoryName("");
      setNewCategoryColor("#3B82F6");
      setShowNewCategoryDialog(false);
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    }
  };

  const handleCreateSubcategory = async () => {
    const selectedCategory = form.watch("category");
    
    if (!selectedCategory) {
      toast({
        title: "Error",
        description: "Please select a category first",
        variant: "destructive",
      });
      return;
    }

    if (!newSubcategoryName.trim()) {
      toast({
        title: "Error",
        description: "Subcategory name is required",
        variant: "destructive",
      });
      return;
    }

    try {
      // Find the category ID
      const category = categories.find(c => c.name === selectedCategory);
      if (!category) throw new Error("Category not found");

      const currentSubcategories = getSubcategoriesForCategory(selectedCategory);

      const { error } = await supabase
        .from("product_subcategories")
        .insert({
          category_id: category.id,
          name: newSubcategoryName.trim(),
          display_order: currentSubcategories.length,
          is_active: true,
        });

      if (error) throw error;

      toast({
        title: "Success",
        description: "Subcategory created successfully",
      });

      // Refresh categories and select the new subcategory
      await refetchCategories();
      form.setValue("subcategory", newSubcategoryName.trim());
      
      // Reset and close dialog
      setNewSubcategoryName("");
      setShowNewSubcategoryDialog(false);
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
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
                <Select onValueChange={field.onChange} value={field.value}>
                  <FormControl>
                    <SelectTrigger>
                      <SelectValue placeholder="Select category" />
                    </SelectTrigger>
                  </FormControl>
                  <SelectContent>
                    {categories.map((category) => (
                      <SelectItem key={category.id} value={category.name}>
                        {category.name}
                      </SelectItem>
                    ))}
                    <Button
                      variant="ghost"
                      className="w-full justify-start text-primary"
                      onClick={(e) => {
                        e.preventDefault();
                        setShowNewCategoryDialog(true);
                      }}
                    >
                      <Plus className="h-4 w-4 mr-2" />
                      Add New Category
                    </Button>
                  </SelectContent>
                </Select>
                <FormMessage />
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name="subcategory"
            render={({ field }) => {
              const selectedCategory = form.watch("category");
              const availableSubcategories = selectedCategory 
                ? getSubcategoriesForCategory(selectedCategory)
                : [];
              
              return (
                <FormItem>
                  <FormLabel>Subcategory (Optional)</FormLabel>
                  <Select 
                    onValueChange={field.onChange} 
                    value={field.value && availableSubcategories.some(s => s.name === field.value) ? field.value : ""}
                    disabled={!selectedCategory}
                  >
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue placeholder={selectedCategory ? "Select subcategory" : "Select category first"} />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      {availableSubcategories.map((subcategory) => (
                        <SelectItem key={subcategory.id} value={subcategory.name}>
                          {subcategory.name}
                        </SelectItem>
                      ))}
                      {selectedCategory && (
                        <Button
                          variant="ghost"
                          className="w-full justify-start text-primary"
                          onClick={(e) => {
                            e.preventDefault();
                            setShowNewSubcategoryDialog(true);
                          }}
                        >
                          <Plus className="h-4 w-4 mr-2" />
                          Add New Subcategory
                        </Button>
                      )}
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              );
            }}
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

        {/* Base Product Height - For Area Calculation */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Ruler className="h-5 w-5" />
              Height Configuration
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <FormField
              control={form.control}
              name="use_height_in_calculation"
              render={({ field }) => (
                <FormItem className="flex flex-row items-center justify-between rounded-lg border p-4">
                  <div className="space-y-0.5">
                    <FormLabel className="text-base">Use height in area calculations</FormLabel>
                    <FormDescription>
                      Enable for products like fences where linear measurements need to be converted to area (linear ft × height = sq ft)
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

            {form.watch("use_height_in_calculation") && (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 p-3 bg-muted/50 rounded-lg">
                <FormField
                  control={form.control}
                  name="base_height"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Height Value (Optional)</FormLabel>
                      <FormControl>
                        <Input
                          type="number"
                          step="0.01"
                          placeholder="e.g., 6, 8"
                          {...field}
                          value={field.value || ""}
                          onChange={(e) => field.onChange(parseFloat(e.target.value) || undefined)}
                        />
                      </FormControl>
                      <FormDescription>
                        Base height for this product
                      </FormDescription>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="base_height_unit"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Unit of Measurement</FormLabel>
                      <Select
                        value={field.value}
                        onValueChange={field.onChange}
                      >
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          <SelectItem value="ft">Feet</SelectItem>
                          <SelectItem value="inches">Inches</SelectItem>
                          <SelectItem value="m">Meters</SelectItem>
                          <SelectItem value="cm">Centimeters</SelectItem>
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>
            )}

            <div className="p-3 bg-blue-50 dark:bg-blue-950 rounded-lg border border-blue-200 dark:border-blue-800">
              <p className="text-sm text-blue-900 dark:text-blue-100 font-medium">
                Example: Standard Chain Link Fence
              </p>
              <p className="text-xs text-blue-700 dark:text-blue-300 mt-1">
                Customer measures 100 linear ft × 6 ft height = 600 sq ft for pricing
              </p>
            </div>
          </CardContent>
        </Card>

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

        {/* Sold in Increments Settings */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Package className="h-5 w-5" />
              Sold in Increments
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <FormDescription>
              Configure if this product is only sold in fixed increments (e.g., pallets, bundles, 20ft lengths)
            </FormDescription>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <FormField
                control={form.control}
                name="sold_in_increments_of"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Increment Size</FormLabel>
                    <FormControl>
                      <Input 
                        type="number" 
                        step="0.1" 
                        placeholder="e.g., 450 or 20"
                        {...field}
                        value={field.value || ""}
                        onChange={(e) => {
                          const value = parseFloat(e.target.value);
                          field.onChange(value > 0 ? value : undefined);
                        }}
                      />
                    </FormControl>
                    <FormDescription>
                      Size of each increment unit
                    </FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="increment_unit_label"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Increment Label</FormLabel>
                    <FormControl>
                      <Input 
                        placeholder="e.g., pallet, bundle, 20ft length"
                        {...field}
                        value={field.value || ""}
                      />
                    </FormControl>
                    <FormDescription>
                      Display name for each increment
                    </FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            <FormField
              control={form.control}
              name="increment_description"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Description</FormLabel>
                  <FormControl>
                    <Textarea 
                      placeholder="e.g., Each pallet covers approximately 450 square feet"
                      {...field}
                      value={field.value || ""}
                    />
                  </FormControl>
                  <FormDescription>
                    Explain to customers what each increment represents
                  </FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="allow_partial_increments"
              render={({ field }) => (
                <FormItem className="flex flex-row items-center justify-between rounded-lg border p-4">
                  <div className="space-y-0.5">
                    <FormLabel className="text-base">Allow Partial Increments</FormLabel>
                    <FormDescription>
                      Allow half-increments (e.g., 0.5 pallets)
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
          </CardContent>
        </Card>

        {/* Dimensional Product Settings */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Ruler className="h-5 w-5" />
              Predefined Dimensions
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <FormField
              control={form.control}
              name="has_fixed_dimensions"
              render={({ field }) => (
                <FormItem className="flex flex-row items-center justify-between rounded-lg border p-4">
                  <div className="space-y-0.5">
                    <FormLabel className="text-base">This product has fixed dimensions</FormLabel>
                    <FormDescription>
                      Enable for products like pickleball courts, pools, sheds, etc. that have standard sizes
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

            {form.watch("has_fixed_dimensions") && (
              <>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 p-4 bg-muted/50 rounded-lg">
                  <FormField
                    control={form.control}
                    name="default_width"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Default Width (feet)</FormLabel>
                        <FormControl>
                          <Input 
                            type="number" 
                            step="0.1" 
                            placeholder="e.g., 20"
                            {...field}
                            value={field.value || ""}
                            onChange={(e) => field.onChange(parseFloat(e.target.value) || undefined)}
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="default_length"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Default Length (feet)</FormLabel>
                        <FormControl>
                          <Input 
                            type="number" 
                            step="0.1" 
                            placeholder="e.g., 44"
                            {...field}
                            value={field.value || ""}
                            onChange={(e) => field.onChange(parseFloat(e.target.value) || undefined)}
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>

                <FormField
                  control={form.control}
                  name="allow_dimension_editing"
                  render={({ field }) => (
                    <FormItem className="flex flex-row items-center justify-between rounded-lg border p-4">
                      <div className="space-y-0.5">
                        <FormLabel className="text-base">Allow customers to adjust dimensions</FormLabel>
                        <FormDescription>
                          If enabled, customers can modify width and length in the widget
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

                <div className="p-3 bg-blue-50 dark:bg-blue-950 rounded-lg border border-blue-200 dark:border-blue-800">
                  <p className="text-sm text-blue-900 dark:text-blue-100 font-medium">
                    Example: Standard Pickleball Court
                  </p>
                  <p className="text-xs text-blue-700 dark:text-blue-300 mt-1">
                    Width: 20ft × Length: 44ft = 880 sq ft
                  </p>
                </div>
              </>
            )}
          </CardContent>
        </Card>

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
                   <div className="mt-3 flex items-center gap-4">
                     <div className="flex items-center gap-2">
                       <Switch
                         checked={variation.is_active}
                         onCheckedChange={(checked) => updateVariation(index, "is_active", checked)}
                       />
                       <Label>Active</Label>
                     </div>
                     <div className="flex items-center gap-2">
                       <Switch
                         checked={variation.is_required}
                         onCheckedChange={(checked) => updateVariation(index, "is_required", checked)}
                       />
                       <Label>Required</Label>
                     </div>
                     {variation.is_required && (
                       <div className="flex items-center gap-2">
                         <Switch
                           checked={variation.is_default}
                           onCheckedChange={(checked) => {
                             if (checked) {
                               // Unset default on all other variations
                               variations.forEach((v, i) => {
                                 if (i !== index) {
                                   updateVariation(i, "is_default", false);
                                 }
                               });
                             }
                             updateVariation(index, "is_default", checked);
                           }}
                         />
                         <Label>Set as Default</Label>
                       </div>
                     )}
                   </div>
                   {variation.is_required && (
                     <p className="text-xs text-muted-foreground mt-2">
                       Required variations must be selected before adding to quote.
                       {variation.is_default && " This variation will be pre-selected."}
                     </p>
                   )}
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
                    <div>
                      <Label htmlFor={`addon-formula-${index}`}>Formula (auto-filled)</Label>
                      <Input
                        id={`addon-formula-${index}`}
                        value={addon.calculation_formula || ""}
                        onChange={(e) => updateAddon(index, "calculation_formula", e.target.value)}
                        placeholder="Auto-filled based on calculation type"
                      />
                    </div>
                  </div>
                  
                  <div className="mt-3 flex items-center gap-2">
                    <Switch
                      checked={addon.is_active}
                      onCheckedChange={(checked) => updateAddon(index, "is_active", checked)}
                    />
                    <Label>Active</Label>
                  </div>
                  
                  {/* Addon Options Section */}
                  <div className="mt-4 pt-4 border-t">
                    <div className="flex items-center justify-between mb-3">
                      <div className="flex items-center gap-2">
                        <Label className="text-sm font-semibold">Options (e.g., Stain Colors)</Label>
                        {!addon.id && (
                          <span className="text-xs text-muted-foreground italic">
                            (saved with product)
                          </span>
                        )}
                      </div>
                      <Button
                        type="button"
                        size="sm"
                        variant="outline"
                        onClick={() => addNewAddonOption(addon.id || `temp-${index}`)}
                      >
                        <Plus className="h-3 w-3 mr-1" />
                        Add Option
                      </Button>
                    </div>
                    
                    <p className="text-xs text-muted-foreground mb-3">
                      Option price added to base add-on price. Set to $0 for no extra charge.
                    </p>
                    
                    {(() => {
                      const addonKey = addon.id || `temp-${index}`;
                      const options = addonOptions[addonKey] || [];
                      
                      return options.length === 0 ? (
                        <p className="text-xs text-muted-foreground text-center py-2">
                          No options yet. Add options for selectable variations like colors or styles.
                        </p>
                      ) : (
                        <div className="space-y-2">
                          {options.map((option, optIndex) => (
                            <div key={optIndex} className="flex gap-2 items-start p-3 bg-muted/30 rounded border">
                              {option.image_url && (
                                <img src={option.image_url} className="w-12 h-12 rounded object-cover flex-shrink-0" alt={option.name} />
                              )}
                              
                              <div className="flex-1 space-y-2 min-w-0">
                                <div className="grid grid-cols-2 gap-2">
                                  <Input
                                    placeholder="Option name (e.g., Walnut)"
                                    value={option.name}
                                    onChange={(e) => updateAddonOption(addonKey, optIndex, 'name', e.target.value)}
                                    className="text-sm"
                                  />
                                  <Input
                                    placeholder="Description (optional)"
                                    value={option.description}
                                    onChange={(e) => updateAddonOption(addonKey, optIndex, 'description', e.target.value)}
                                    className="text-sm"
                                  />
                                </div>
                                
                                <div className="grid grid-cols-2 gap-2">
                                  <Input
                                    type="number"
                                    step="0.01"
                                    placeholder="Price adjustment"
                                    value={option.price_adjustment}
                                    onChange={(e) => updateAddonOption(addonKey, optIndex, 'price_adjustment', parseFloat(e.target.value) || 0)}
                                    className="text-sm"
                                  />
                                  <Select
                                    value={option.adjustment_type}
                                    onValueChange={(val) => updateAddonOption(addonKey, optIndex, 'adjustment_type', val)}
                                  >
                                    <SelectTrigger className="text-sm">
                                      <SelectValue />
                                    </SelectTrigger>
                                    <SelectContent>
                                      <SelectItem value="fixed">Fixed ($)</SelectItem>
                                      <SelectItem value="percentage">Percentage (%)</SelectItem>
                                    </SelectContent>
                                  </Select>
                                </div>
                                
                                <div className="flex items-center gap-3">
                                  <Input
                                    type="file"
                                    accept="image/*"
                                    onChange={(e) => handleOptionImageUpload(addonKey, optIndex, e)}
                                    className="text-xs flex-1"
                                  />
                                  
                                  <div className="flex items-center gap-2">
                                    <Switch
                                      checked={option.is_default}
                                      onCheckedChange={(val) => updateAddonOption(addonKey, optIndex, 'is_default', val)}
                                    />
                                    <span className="text-xs whitespace-nowrap">Default</span>
                                  </div>
                                  
                                  <Button
                                    type="button"
                                    size="sm"
                                    variant="ghost"
                                    onClick={() => removeAddonOption(addonKey, optIndex)}
                                    className="text-destructive hover:text-destructive h-8 w-8 p-0"
                                  >
                                    <Trash2 className="h-3 w-3" />
                                  </Button>
                                </div>
                              </div>
                            </div>
                          ))}
                        </div>
                      );
                    })()}
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

      {/* New Category Dialog */}
      <Dialog open={showNewCategoryDialog} onOpenChange={setShowNewCategoryDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Add New Category</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div>
              <Label htmlFor="new-category-name">Category Name</Label>
              <Input
                id="new-category-name"
                value={newCategoryName}
                onChange={(e) => setNewCategoryName(e.target.value)}
                placeholder="e.g., Landscaping"
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault();
                    handleCreateCategory();
                  }
                }}
              />
            </div>
            <div>
              <Label htmlFor="new-category-color">Color</Label>
              <div className="flex gap-2">
                <Input
                  id="new-category-color"
                  type="color"
                  value={newCategoryColor}
                  onChange={(e) => setNewCategoryColor(e.target.value)}
                  className="w-20"
                />
                <Input
                  value={newCategoryColor}
                  onChange={(e) => setNewCategoryColor(e.target.value)}
                  placeholder="#3B82F6"
                />
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowNewCategoryDialog(false)}>
              Cancel
            </Button>
            <Button onClick={handleCreateCategory}>
              Create Category
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* New Subcategory Dialog */}
      <Dialog open={showNewSubcategoryDialog} onOpenChange={setShowNewSubcategoryDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Add New Subcategory</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div>
              <Label htmlFor="new-subcategory-name">Subcategory Name</Label>
              <Input
                id="new-subcategory-name"
                value={newSubcategoryName}
                onChange={(e) => setNewSubcategoryName(e.target.value)}
                placeholder="e.g., Residential"
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault();
                    handleCreateSubcategory();
                  }
                }}
              />
            </div>
            <div className="text-sm text-muted-foreground">
              This subcategory will be added to: <strong>{form.watch("category")}</strong>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowNewSubcategoryDialog(false)}>
              Cancel
            </Button>
            <Button onClick={handleCreateSubcategory}>
              Create Subcategory
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Form>
  );
}