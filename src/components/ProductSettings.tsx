import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";
import { Settings as SettingsIcon } from "lucide-react";
import { Form, FormControl, FormDescription, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";

const productSettingsSchema = z.object({
  default_unit_type: z.enum(['sq_ft', 'linear_ft', 'each', 'hour', 'cubic_yard']),
  default_product_color: z.string().regex(/^#[0-9A-F]{6}$/i, "Invalid hex color"),
  auto_activate_products: z.boolean(),
  require_product_photos: z.boolean(),
  global_tax_rate: z.number().min(0).max(100),
  global_markup_percentage: z.number().min(0).max(100),
  currency_symbol: z.string().min(1, "Currency symbol is required"),
  decimal_precision: z.number().min(0).max(4),
});

type ProductSettingsFormData = z.infer<typeof productSettingsSchema>;

const unitTypes = [
  { value: 'sq_ft', label: 'Square Feet' },
  { value: 'linear_ft', label: 'Linear Feet' },
  { value: 'each', label: 'Each' },
  { value: 'hour', label: 'Hour' },
  { value: 'cubic_yard', label: 'Cubic Yard' },
];

const currencySymbols = [
  { value: '$', label: '$ (USD)' },
  { value: '€', label: '€ (EUR)' },
  { value: '£', label: '£ (GBP)' },
  { value: '¥', label: '¥ (JPY)' },
];

export function ProductSettings() {
  const [contractorId, setContractorId] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const { toast } = useToast();

  const form = useForm<ProductSettingsFormData>({
    resolver: zodResolver(productSettingsSchema),
    defaultValues: {
      default_unit_type: 'sq_ft',
      default_product_color: '#3B82F6',
      auto_activate_products: true,
      require_product_photos: false,
      global_tax_rate: 0,
      global_markup_percentage: 0,
      currency_symbol: '$',
      decimal_precision: 2,
    },
  });

  useEffect(() => {
    loadSettings();
  }, []);

  const loadSettings = async () => {
    try {
      const { data: contractor, error: contractorError } = await supabase
        .from("contractors")
        .select("id")
        .maybeSingle();

      if (contractorError && contractorError.code !== 'PGRST116') {
        throw contractorError;
      }

      if (contractor) {
        setContractorId(contractor.id);

        // Load contractor settings
        const { data: settings, error: settingsError } = await supabase
          .from("contractor_settings")
          .select("*")
          .eq("contractor_id", contractor.id)
          .maybeSingle();

        if (settingsError && settingsError.code !== 'PGRST116') {
          throw settingsError;
        }

        if (settings) {
          form.reset({
            default_unit_type: (settings.default_unit_type as any) || 'sq_ft',
            default_product_color: settings.default_product_color || '#3B82F6',
            auto_activate_products: settings.auto_activate_products ?? true,
            require_product_photos: settings.require_product_photos || false,
            global_tax_rate: settings.global_tax_rate || 0,
            global_markup_percentage: settings.global_markup_percentage || 0,
            currency_symbol: settings.currency_symbol || '$',
            decimal_precision: settings.decimal_precision ?? 2,
          });
        }
      }
    } catch (error: any) {
      toast({
        title: "Error",
        description: "Failed to load product settings",
        variant: "destructive",
      });
      console.error("Error loading settings:", error);
    }
  };

  const onSubmit = async (data: ProductSettingsFormData) => {
    if (!contractorId) {
      toast({
        title: "Error",
        description: "Please set up your contractor profile first by going to Settings",
        variant: "destructive",
      });
      return;
    }

    setSaving(true);
    try {
      // Upsert contractor settings
      const { error } = await supabase
        .from("contractor_settings")
        .upsert({
          contractor_id: contractorId,
          ...data,
        }, {
          onConflict: 'contractor_id'
        });

      if (error) throw error;

      toast({
        title: "Success",
        description: "Product settings saved successfully",
      });
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setSaving(false);
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <SettingsIcon className="h-5 w-5" />
          Product Settings
        </CardTitle>
      </CardHeader>
      <CardContent>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
            {/* Default Settings */}
            <div className="space-y-4">
              <h3 className="font-semibold text-base sm:text-lg">Default Product Settings</h3>
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <FormField
                  control={form.control}
                  name="default_unit_type"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Default Unit Type</FormLabel>
                      <Select onValueChange={field.onChange} defaultValue={field.value}>
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue placeholder="Select unit type" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          {unitTypes.map((type) => (
                            <SelectItem key={type.value} value={type.value}>
                              {type.label}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <FormDescription className="text-sm">
                        Default unit type for new products
                      </FormDescription>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="default_product_color"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Default Product Color</FormLabel>
                      <div className="flex flex-col sm:flex-row gap-2">
                        <FormControl>
                          <Input
                            type="color"
                            {...field}
                            className="w-full sm:w-20 h-10"
                          />
                        </FormControl>
                        <FormControl>
                          <Input
                            {...field}
                            placeholder="#3B82F6"
                            className="flex-1"
                          />
                        </FormControl>
                      </div>
                      <FormDescription className="text-sm">
                        Default color for new products
                      </FormDescription>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>

              <div className="grid grid-cols-1 gap-4">
                <FormField
                  control={form.control}
                  name="auto_activate_products"
                  render={({ field }) => (
                    <FormItem className="flex flex-col sm:flex-row sm:items-center sm:justify-between rounded-lg border p-4 gap-2">
                      <div className="space-y-0.5 flex-1">
                        <FormLabel className="text-base">Auto-activate Products</FormLabel>
                        <FormDescription className="text-sm">
                          Automatically activate new products when created
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
                  name="require_product_photos"
                  render={({ field }) => (
                    <FormItem className="flex flex-col sm:flex-row sm:items-center sm:justify-between rounded-lg border p-4 gap-2">
                      <div className="space-y-0.5 flex-1">
                        <FormLabel className="text-base">Require Product Photos</FormLabel>
                        <FormDescription className="text-sm">
                          Require photos when creating products
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
            </div>

            {/* Pricing Settings */}
            <div className="space-y-4">
              <h3 className="font-semibold text-base sm:text-lg">Pricing Settings</h3>
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <FormField
                  control={form.control}
                  name="global_tax_rate"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Global Tax Rate (%)</FormLabel>
                      <FormControl>
                        <Input
                          type="number"
                          step="0.01"
                          min="0"
                          max="100"
                          {...field}
                          onChange={(e) => field.onChange(parseFloat(e.target.value) || 0)}
                        />
                      </FormControl>
                      <FormDescription className="text-sm">
                        Default tax rate applied to all quotes
                      </FormDescription>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="global_markup_percentage"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Global Markup (%)</FormLabel>
                      <FormControl>
                        <Input
                          type="number"
                          step="0.01"
                          min="0"
                          max="100"
                          {...field}
                          onChange={(e) => field.onChange(parseFloat(e.target.value) || 0)}
                        />
                      </FormControl>
                      <FormDescription className="text-sm">
                        Default markup applied to all products
                      </FormDescription>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <FormField
                  control={form.control}
                  name="currency_symbol"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Currency Symbol</FormLabel>
                      <Select onValueChange={field.onChange} defaultValue={field.value}>
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue placeholder="Select currency" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          {currencySymbols.map((currency) => (
                            <SelectItem key={currency.value} value={currency.value}>
                              {currency.label}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <FormDescription className="text-sm">
                        Currency symbol used in quotes
                      </FormDescription>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="decimal_precision"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Decimal Precision</FormLabel>
                      <FormControl>
                        <Input
                          type="number"
                          min="0"
                          max="4"
                          {...field}
                          onChange={(e) => field.onChange(parseInt(e.target.value) || 2)}
                        />
                      </FormControl>
                      <FormDescription className="text-sm">
                        Number of decimal places for prices
                      </FormDescription>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>
            </div>

            <Button type="submit" disabled={saving} className="w-full sm:w-auto">
              {saving ? "Saving..." : "Save Product Settings"}
            </Button>
          </form>
        </Form>
      </CardContent>
    </Card>
  );
}