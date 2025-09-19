import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { useToast } from "@/hooks/use-toast";
import { Settings as SettingsIcon, Palette, CreditCard, ArrowLeft, MapPin } from "lucide-react";
import { Slider } from "@/components/ui/slider";
import { Form, FormControl, FormDescription, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";

const contractorSchema = z.object({
  business_name: z.string().min(1, "Business name is required"),
  email: z.string().email("Invalid email address"),
  phone: z.string().optional(),
  website: z.string().optional(),
  address: z.string().optional(),
  city: z.string().optional(),
  state: z.string().optional(),
  zip_code: z.string().optional(),
  brand_color: z.string().regex(/^#[0-9A-F]{6}$/i, "Invalid hex color"),
  secondary_color: z.string().regex(/^#[0-9A-F]{6}$/i, "Invalid hex color"),
  logo_url: z.string().optional(),
});

const settingsSchema = z.object({
  require_email: z.boolean(),
  require_phone: z.boolean(),
  require_address: z.boolean(),
  pricing_visibility: z.enum(["before_submit", "after_submit", "never"]),
  contact_capture_timing: z.enum(["before_quote", "after_quote"]),
  widget_theme_color: z.string().regex(/^#[0-9A-F]{6}$/i, "Invalid hex color"),
  use_price_ranges: z.boolean(),
  price_range_percentage: z.number().min(1).max(50),
  price_range_display_format: z.enum(['percentage', 'dollar_amounts']),
  currency_symbol: z.string().min(1),
  decimal_precision: z.number().min(0).max(4),
  default_product_color: z.string().regex(/^#[0-9A-F]{6}$/i, "Invalid hex color"),
  default_unit_type: z.enum(["sq_ft", "linear_ft", "sq_m", "linear_m", "each", "hour"]),
  global_markup_percentage: z.number().min(0).max(100),
  global_tax_rate: z.number().min(0).max(100),
  require_product_photos: z.boolean(),
  auto_activate_products: z.boolean(),
  service_area_enabled: z.boolean(),
  service_area_method: z.enum(["radius", "zipcodes"]),
  service_area_radius_miles: z.number().min(5).max(200),
  service_area_center_lat: z.number().optional(),
  service_area_center_lng: z.number().optional(),
  service_area_zip_codes: z.array(z.string()).optional(),
});

type ContractorFormData = z.infer<typeof contractorSchema>;
type SettingsFormData = z.infer<typeof settingsSchema>;

const contractorStates = [
  "AL", "AK", "AZ", "AR", "CA", "CO", "CT", "DE", "FL", "GA",
  "HI", "ID", "IL", "IN", "IA", "KS", "KY", "LA", "ME", "MD",
  "MA", "MI", "MN", "MS", "MO", "MT", "NE", "NV", "NH", "NJ",
  "NM", "NY", "NC", "ND", "OH", "OK", "OR", "PA", "RI", "SC",
  "SD", "TN", "TX", "UT", "VT", "VA", "WA", "WV", "WI", "WY"
];

const Settings = () => {
  const [contractorId, setContractorId] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const navigate = useNavigate();
  const { toast } = useToast();

  const contractorForm = useForm<ContractorFormData>({
    resolver: zodResolver(contractorSchema),
    defaultValues: {
      business_name: "",
      email: "",
      phone: "",
      website: "",
      address: "",
      city: "",
      state: "",
      zip_code: "",
      brand_color: "#3B82F6",
      secondary_color: "#64748B",
      logo_url: "",
    },
  });

  const settingsForm = useForm<SettingsFormData>({
    resolver: zodResolver(settingsSchema),
    defaultValues: {
      require_email: true,
      require_phone: true,
      require_address: true,
      pricing_visibility: "before_submit",
      contact_capture_timing: "before_quote",
      widget_theme_color: "#3B82F6",
      use_price_ranges: false,
      price_range_percentage: 15,
      price_range_display_format: 'percentage',
      currency_symbol: "$",
      decimal_precision: 2,
      default_product_color: "#3B82F6",
      default_unit_type: "sq_ft",
      global_markup_percentage: 0,
      global_tax_rate: 0,
      require_product_photos: false,
      auto_activate_products: true,
      service_area_enabled: false,
      service_area_method: "radius",
      service_area_radius_miles: 50,
      service_area_center_lat: undefined,
      service_area_center_lng: undefined,
      service_area_zip_codes: [],
    },
  });

  useEffect(() => {
    loadSettings();
  }, []);

  const loadSettings = async () => {
    try {
      const { data: contractor, error: contractorError } = await supabase
        .from("contractors")
        .select("*")
        .maybeSingle();

      if (contractorError && contractorError.code !== 'PGRST116') {
        throw contractorError;
      }

      if (contractor) {
        setContractorId(contractor.id);
        contractorForm.reset({
          business_name: contractor.business_name || "",
          email: contractor.email || "",
          phone: contractor.phone || "",
          website: contractor.website || "",
          address: contractor.address || "",
          city: contractor.city || "",
          state: contractor.state || "",
          zip_code: contractor.zip_code || "",
          brand_color: contractor.brand_color || "#3B82F6",
          secondary_color: contractor.secondary_color || "#64748B",
          logo_url: contractor.logo_url || "",
        });

        const { data: settings, error: settingsError } = await supabase
          .from("contractor_settings")
          .select("*")
          .eq("contractor_id", contractor.id)
          .maybeSingle();

        if (settingsError && settingsError.code !== 'PGRST116') {
          throw settingsError;
        }

        if (settings) {
          settingsForm.reset({
            require_email: settings.require_email ?? true,
            require_phone: settings.require_phone ?? true,
            require_address: settings.require_address ?? true,
            pricing_visibility: (settings.pricing_visibility as "before_submit" | "after_submit" | "never") || "before_submit",
            contact_capture_timing: (settings.contact_capture_timing as "before_quote" | "after_quote") || "before_quote",
            widget_theme_color: settings.widget_theme_color || "#3B82F6",
            use_price_ranges: settings.use_price_ranges || false,
            price_range_percentage: settings.price_range_percentage || 15,
            price_range_display_format: (settings.price_range_display_format as 'percentage' | 'dollar_amounts') || 'percentage',
            currency_symbol: settings.currency_symbol || "$",
            decimal_precision: settings.decimal_precision || 2,
            default_product_color: settings.default_product_color || "#3B82F6",
            default_unit_type: (settings.default_unit_type as "sq_ft" | "linear_ft" | "sq_m" | "linear_m" | "each" | "hour") || "sq_ft",
            global_markup_percentage: settings.global_markup_percentage || 0,
            global_tax_rate: settings.global_tax_rate || 0,
            require_product_photos: settings.require_product_photos || false,
            auto_activate_products: settings.auto_activate_products ?? true,
            service_area_enabled: settings.service_area_enabled || false,
            service_area_method: (settings.service_area_method as "radius" | "zipcodes") || "radius",
            service_area_radius_miles: settings.service_area_radius_miles || 50,
            service_area_center_lat: settings.service_area_center_lat || undefined,
            service_area_center_lng: settings.service_area_center_lng || undefined,
            service_area_zip_codes: settings.service_area_zip_codes || [],
          });
        }
      }
    } catch (error: any) {
      toast({
        title: "Error",
        description: "Failed to load settings",
        variant: "destructive",
      });
    }
  };

  const onContractorSubmit = async (data: ContractorFormData) => {
    setSaving(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("User not authenticated");

      if (contractorId) {
        const { error } = await supabase
          .from("contractors")
          .update(data)
          .eq("id", contractorId);
        if (error) throw error;
      } else {
        const contractorData = {
          user_id: user.id,
          business_name: data.business_name,
          email: data.email,
          phone: data.phone || null,
          website: data.website || null,
          address: data.address || null,
          city: data.city || null,
          state: data.state || null,
          zip_code: data.zip_code || null,
          brand_color: data.brand_color,
          secondary_color: data.secondary_color,
          logo_url: data.logo_url || null,
        };
        const { data: newContractor, error } = await supabase
          .from("contractors")
          .insert(contractorData)
          .select()
          .single();
        if (error) throw error;
        setContractorId(newContractor.id);
      }

      toast({
        title: "Success",
        description: "Business information saved successfully",
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

  const onSettingsSubmit = async (data: SettingsFormData) => {
    if (!contractorId) {
      toast({
        title: "Error",
        description: "Please save your business information first",
        variant: "destructive",
      });
      return;
    }

    setSaving(true);
    try {
      const { error } = await supabase
        .from("contractor_settings")
        .upsert({
          contractor_id: contractorId,
          ...data,
        });

      if (error) throw error;

      toast({
        title: "Success",
        description: "Widget settings saved successfully",
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
    <div className="min-h-screen bg-background">
      <header className="border-b border-border bg-card">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16">
            <div className="flex items-center">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => navigate("/dashboard")}
                className="mr-4"
              >
                <ArrowLeft className="h-4 w-4 mr-2" />
                Back to Dashboard
              </Button>
              <div>
                <h1 className="text-xl font-semibold text-foreground">Settings</h1>
                <p className="text-sm text-muted-foreground">Configure your business profile and widget</p>
              </div>
            </div>
          </div>
        </div>
      </header>

      <main className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="mb-8">
          <h1 className="text-3xl font-bold mb-2 flex items-center gap-2">
            <SettingsIcon className="h-8 w-8" />
            Settings
          </h1>
          <p className="text-muted-foreground">Manage your business and widget settings</p>
        </div>

        <div className="space-y-8">
          {/* Business Information Card */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <CreditCard className="h-5 w-5" />
                Business Information
              </CardTitle>
            </CardHeader>
            <CardContent>
              <Form {...contractorForm}>
                <form onSubmit={contractorForm.handleSubmit(onContractorSubmit)} className="space-y-6">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <FormField
                      control={contractorForm.control}
                      name="business_name"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Business Name</FormLabel>
                          <FormControl>
                            <Input placeholder="Your Business Name" {...field} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={contractorForm.control}
                      name="email"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Email</FormLabel>
                          <FormControl>
                            <Input placeholder="business@example.com" type="email" {...field} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={contractorForm.control}
                      name="phone"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Phone</FormLabel>
                          <FormControl>
                            <Input placeholder="(555) 123-4567" {...field} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={contractorForm.control}
                      name="website"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Website</FormLabel>
                          <FormControl>
                            <Input placeholder="https://yourwebsite.com" {...field} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={contractorForm.control}
                      name="address"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Address</FormLabel>
                          <FormControl>
                            <Input placeholder="123 Main Street" {...field} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={contractorForm.control}
                      name="city"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>City</FormLabel>
                          <FormControl>
                            <Input placeholder="Your City" {...field} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={contractorForm.control}
                      name="state"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>State</FormLabel>
                          <Select onValueChange={field.onChange} value={field.value}>
                            <FormControl>
                              <SelectTrigger>
                                <SelectValue placeholder="Select a state" />
                              </SelectTrigger>
                            </FormControl>
                            <SelectContent>
                              {contractorStates.map((state) => (
                                <SelectItem key={state} value={state}>
                                  {state}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={contractorForm.control}
                      name="zip_code"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>ZIP Code</FormLabel>
                          <FormControl>
                            <Input placeholder="12345" {...field} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={contractorForm.control}
                      name="brand_color"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Primary Brand Color</FormLabel>
                          <FormControl>
                            <Input type="color" {...field} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={contractorForm.control}
                      name="secondary_color"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Secondary Brand Color</FormLabel>
                          <FormControl>
                            <Input type="color" {...field} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={contractorForm.control}
                      name="logo_url"
                      render={({ field }) => (
                        <FormItem className="md:col-span-2">
                          <FormLabel>Logo URL</FormLabel>
                          <FormControl>
                            <Input placeholder="https://yoursite.com/logo.png" {...field} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>
                  <Button type="submit" disabled={saving}>
                    {saving ? "Saving..." : "Save Business Information"}
                  </Button>
                </form>
              </Form>
            </CardContent>
          </Card>

          {/* Widget Settings Card */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Palette className="h-5 w-5" />
                Quote Widget Settings
              </CardTitle>
            </CardHeader>
            <CardContent>
              <Form {...settingsForm}>
                <form onSubmit={settingsForm.handleSubmit(onSettingsSubmit)} className="space-y-6">
                  <div className="space-y-6">
                    <div>
                      <h3 className="text-lg font-medium mb-4">Contact Information Requirements</h3>
                      <div className="space-y-4">
                        <FormField
                          control={settingsForm.control}
                          name="require_email"
                          render={({ field }) => (
                            <FormItem className="flex flex-row items-center justify-between rounded-lg border p-4">
                              <div className="space-y-0.5">
                                <FormLabel>Email Required</FormLabel>
                                <FormDescription>
                                  Require customers to provide email address
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
                          control={settingsForm.control}
                          name="require_phone"
                          render={({ field }) => (
                            <FormItem className="flex flex-row items-center justify-between rounded-lg border p-4">
                              <div className="space-y-0.5">
                                <FormLabel>Phone Required</FormLabel>
                                <FormDescription>
                                  Require customers to provide phone number
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
                          control={settingsForm.control}
                          name="require_address"
                          render={({ field }) => (
                            <FormItem className="flex flex-row items-center justify-between rounded-lg border p-4">
                              <div className="space-y-0.5">
                                <FormLabel>Address Required</FormLabel>
                                <FormDescription>
                                  Require customers to provide project address
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

                    <Separator />

                    <div>
                      <h3 className="text-lg font-medium mb-4">Contact & Pricing Behavior</h3>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <FormField
                          control={settingsForm.control}
                          name="contact_capture_timing"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>Contact Capture Timing</FormLabel>
                              <Select onValueChange={field.onChange} value={field.value}>
                                <FormControl>
                                  <SelectTrigger>
                                    <SelectValue placeholder="Select timing" />
                                  </SelectTrigger>
                                </FormControl>
                                <SelectContent>
                                  <SelectItem value="before_quote">Before Quote</SelectItem>
                                  <SelectItem value="after_quote">After Quote</SelectItem>
                                </SelectContent>
                              </Select>
                              <FormDescription>
                                When to capture customer contact information
                              </FormDescription>
                              <FormMessage />
                            </FormItem>
                          )}
                        />
                        <FormField
                          control={settingsForm.control}
                          name="pricing_visibility"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>Pricing Visibility</FormLabel>
                              <Select onValueChange={field.onChange} value={field.value}>
                                <FormControl>
                                  <SelectTrigger>
                                    <SelectValue placeholder="Select visibility" />
                                  </SelectTrigger>
                                </FormControl>
                                <SelectContent>
                                  <SelectItem value="before_submit">Show Before Submit</SelectItem>
                                  <SelectItem value="after_submit">Show After Submit</SelectItem>
                                  <SelectItem value="never">Never Show</SelectItem>
                                </SelectContent>
                              </Select>
                              <FormDescription>
                                When customers can see pricing
                              </FormDescription>
                              <FormMessage />
                            </FormItem>
                          )}
                        />
                      </div>
                    </div>

                    <Separator />

                    <div>
                      <h3 className="text-lg font-medium mb-4">Widget Appearance</h3>
                      <FormField
                        control={settingsForm.control}
                        name="widget_theme_color"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Widget Theme Color</FormLabel>
                            <FormControl>
                              <Input type="color" {...field} />
                            </FormControl>
                            <FormDescription>
                              Primary color for the quote widget
                            </FormDescription>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                    </div>

                    <Separator />

                    <div>
                      <h3 className="text-lg font-medium mb-4">Price Range Settings</h3>
                      <div className="space-y-4">
                        <FormField
                          control={settingsForm.control}
                          name="use_price_ranges"
                          render={({ field }) => (
                            <FormItem className="flex flex-row items-center justify-between rounded-lg border p-4">
                              <div className="space-y-0.5">
                                <FormLabel>Use Price Ranges</FormLabel>
                                <FormDescription>
                                  Show price ranges instead of exact prices
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
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                          <FormField
                            control={settingsForm.control}
                            name="price_range_percentage"
                            render={({ field }) => (
                              <FormItem>
                                <FormLabel>Price Range Percentage</FormLabel>
                                <FormControl>
                                  <Input 
                                    type="number" 
                                    min="1" 
                                    max="50" 
                                    {...field} 
                                    onChange={(e) => field.onChange(parseFloat(e.target.value))}
                                  />
                                </FormControl>
                                <FormDescription>
                                  Percentage variance for price ranges (1-50%)
                                </FormDescription>
                                <FormMessage />
                              </FormItem>
                            )}
                          />
                          <FormField
                            control={settingsForm.control}
                            name="price_range_display_format"
                            render={({ field }) => (
                              <FormItem>
                                <FormLabel>Display Format</FormLabel>
                                <Select onValueChange={field.onChange} value={field.value}>
                                  <FormControl>
                                    <SelectTrigger>
                                      <SelectValue placeholder="Select format" />
                                    </SelectTrigger>
                                  </FormControl>
                                  <SelectContent>
                                    <SelectItem value="percentage">Show Percentage</SelectItem>
                                    <SelectItem value="dollar_amounts">Dollar Amounts Only</SelectItem>
                                  </SelectContent>
                                </Select>
                                <FormDescription>
                                  How to display price ranges
                                </FormDescription>
                                <FormMessage />
                              </FormItem>
                            )}
                          />
                        </div>
                      </div>
                    </div>

                    <Separator />

                    <div>
                      <h3 className="text-lg font-medium mb-4">Default Product Settings</h3>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <FormField
                          control={settingsForm.control}
                          name="currency_symbol"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>Currency Symbol</FormLabel>
                              <FormControl>
                                <Input placeholder="$" {...field} />
                              </FormControl>
                              <FormMessage />
                            </FormItem>
                          )}
                        />
                        <FormField
                          control={settingsForm.control}
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
                                  onChange={(e) => field.onChange(parseInt(e.target.value))}
                                />
                              </FormControl>
                              <FormDescription>
                                Number of decimal places for prices
                              </FormDescription>
                              <FormMessage />
                            </FormItem>
                          )}
                        />
                        <FormField
                          control={settingsForm.control}
                          name="default_product_color"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>Default Product Color</FormLabel>
                              <FormControl>
                                <Input type="color" {...field} />
                              </FormControl>
                              <FormMessage />
                            </FormItem>
                          )}
                        />
                        <FormField
                          control={settingsForm.control}
                          name="default_unit_type"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>Default Unit Type</FormLabel>
                              <Select onValueChange={field.onChange} value={field.value}>
                                <FormControl>
                                  <SelectTrigger>
                                    <SelectValue placeholder="Select unit type" />
                                  </SelectTrigger>
                                </FormControl>
                                <SelectContent>
                                  <SelectItem value="sq_ft">Square Feet</SelectItem>
                                  <SelectItem value="linear_ft">Linear Feet</SelectItem>
                                  <SelectItem value="sq_m">Square Meters</SelectItem>
                                  <SelectItem value="linear_m">Linear Meters</SelectItem>
                                  <SelectItem value="each">Each</SelectItem>
                                  <SelectItem value="hour">Hour</SelectItem>
                                </SelectContent>
                              </Select>
                              <FormMessage />
                            </FormItem>
                          )}
                        />
                      </div>
                    </div>

                    <Separator />

                    <div>
                      <h3 className="text-lg font-medium mb-4">Pricing Adjustments</h3>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <FormField
                          control={settingsForm.control}
                          name="global_markup_percentage"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>Global Markup (%)</FormLabel>
                              <FormControl>
                                <Input 
                                  type="number" 
                                  min="0" 
                                  max="100" 
                                  step="0.1"
                                  {...field} 
                                  onChange={(e) => field.onChange(parseFloat(e.target.value))}
                                />
                              </FormControl>
                              <FormDescription>
                                Apply markup to all products
                              </FormDescription>
                              <FormMessage />
                            </FormItem>
                          )}
                        />
                        <FormField
                          control={settingsForm.control}
                          name="global_tax_rate"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>Global Tax Rate (%)</FormLabel>
                              <FormControl>
                                <Input 
                                  type="number" 
                                  min="0" 
                                  max="100" 
                                  step="0.1"
                                  {...field} 
                                  onChange={(e) => field.onChange(parseFloat(e.target.value))}
                                />
                              </FormControl>
                              <FormDescription>
                                Apply tax to all quotes
                              </FormDescription>
                              <FormMessage />
                            </FormItem>
                          )}
                        />
                      </div>
                    </div>

                    <Separator />

                    <div>
                      <h3 className="text-lg font-medium mb-4 flex items-center gap-2">
                        <MapPin className="h-5 w-5" />
                        Service Area Configuration
                      </h3>
                      <div className="space-y-4">
                        <FormField
                          control={settingsForm.control}
                          name="service_area_enabled"
                          render={({ field }) => (
                            <FormItem className="flex flex-row items-center justify-between rounded-lg border p-4">
                              <div className="space-y-0.5">
                                <FormLabel>Enable Service Area Restrictions</FormLabel>
                                <FormDescription>
                                  Restrict quotes to specific geographical areas
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
                        
                        {settingsForm.watch("service_area_enabled") && (
                          <>
                            <FormField
                              control={settingsForm.control}
                              name="service_area_method"
                              render={({ field }) => (
                                <FormItem>
                                  <FormLabel>Service Area Method</FormLabel>
                                  <Select onValueChange={field.onChange} value={field.value}>
                                    <FormControl>
                                      <SelectTrigger>
                                        <SelectValue placeholder="Select method" />
                                      </SelectTrigger>
                                    </FormControl>
                                    <SelectContent>
                                      <SelectItem value="radius">Radius from Business Location</SelectItem>
                                      <SelectItem value="zipcodes">Specific ZIP Codes</SelectItem>
                                    </SelectContent>
                                  </Select>
                                  <FormDescription>
                                    Choose how to define your service area
                                  </FormDescription>
                                  <FormMessage />
                                </FormItem>
                              )}
                            />

                            {settingsForm.watch("service_area_method") === "radius" && (
                              <FormField
                                control={settingsForm.control}
                                name="service_area_radius_miles"
                                render={({ field }) => (
                                  <FormItem>
                                    <FormLabel>Service Radius: {field.value} miles</FormLabel>
                                    <FormControl>
                                      <Slider
                                        min={5}
                                        max={200}
                                        step={5}
                                        value={[field.value]}
                                        onValueChange={(value) => field.onChange(value[0])}
                                        className="w-full"
                                      />
                                    </FormControl>
                                    <FormDescription>
                                      Distance from your business location (5-200 miles)
                                    </FormDescription>
                                    <FormMessage />
                                  </FormItem>
                                )}
                              />
                            )}

                            {settingsForm.watch("service_area_method") === "zipcodes" && (
                              <FormField
                                control={settingsForm.control}
                                name="service_area_zip_codes"
                                render={({ field }) => (
                                  <FormItem>
                                    <FormLabel>Service ZIP Codes</FormLabel>
                                    <FormControl>
                                      <Input
                                        placeholder="12345, 12346, 12347"
                                        value={field.value?.join(", ") || ""}
                                        onChange={(e) => {
                                          const zips = e.target.value
                                            .split(",")
                                            .map(zip => zip.trim())
                                            .filter(zip => zip.length > 0);
                                          field.onChange(zips);
                                        }}
                                      />
                                    </FormControl>
                                    <FormDescription>
                                      Enter ZIP codes separated by commas (e.g., 12345, 12346, 12347)
                                    </FormDescription>
                                    <FormMessage />
                                  </FormItem>
                                )}
                              />
                            )}
                          </>
                        )}
                      </div>
                    </div>

                    <Separator />

                    <div>
                      <h3 className="text-lg font-medium mb-4">Product Management</h3>
                      <div className="space-y-4">
                        <FormField
                          control={settingsForm.control}
                          name="require_product_photos"
                          render={({ field }) => (
                            <FormItem className="flex flex-row items-center justify-between rounded-lg border p-4">
                              <div className="space-y-0.5">
                                <FormLabel>Require Product Photos</FormLabel>
                                <FormDescription>
                                  Require photos when creating new products
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
                          control={settingsForm.control}
                          name="auto_activate_products"
                          render={({ field }) => (
                            <FormItem className="flex flex-row items-center justify-between rounded-lg border p-4">
                              <div className="space-y-0.5">
                                <FormLabel>Auto-Activate Products</FormLabel>
                                <FormDescription>
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
                      </div>
                    </div>
                  </div>
                  <Button type="submit" disabled={saving}>
                    {saving ? "Saving..." : "Save Widget Settings"}
                  </Button>
                </form>
              </Form>
            </CardContent>
          </Card>
        </div>
      </main>
    </div>
  );
};

export default Settings;