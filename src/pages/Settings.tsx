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
import { Settings as SettingsIcon, Palette, CreditCard, ArrowLeft, MapPin, Navigation, Code, ExternalLink, Copy, Check } from "lucide-react";
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
  contact_capture_timing: z.enum(["before_quote", "on_submit", "optional"]),
  widget_theme_color: z.string().regex(/^#[0-9A-F]{6}$/i, "Invalid hex color"),
  use_price_ranges: z.boolean(),
  price_range_lower_percentage: z.number().min(0).max(50),
  price_range_upper_percentage: z.number().min(0).max(100),
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
  use_different_service_address: z.boolean(),
  service_center_address: z.string().optional(),
  service_center_city: z.string().optional(),
  service_center_state: z.string().optional(),
  service_center_zip: z.string().optional(),
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
  const [geocodingAddress, setGeocodingAddress] = useState(false);
  const [copiedUrl, setCopiedUrl] = useState(false);
  const [copiedEmbed, setCopiedEmbed] = useState(false);
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
      price_range_lower_percentage: 10,
      price_range_upper_percentage: 20,
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
      use_different_service_address: false,
      service_center_address: "",
      service_center_city: "",
      service_center_state: "",
      service_center_zip: "",
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
            contact_capture_timing: (settings.contact_capture_timing as "before_quote" | "on_submit" | "optional") || "before_quote",
            widget_theme_color: settings.widget_theme_color || "#3B82F6",
            use_price_ranges: settings.use_price_ranges || false,
            price_range_lower_percentage: settings.price_range_lower_percentage ?? 10,
            price_range_upper_percentage: settings.price_range_upper_percentage ?? 20,
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
            use_different_service_address: false,
            service_center_address: contractor?.address || "",
            service_center_city: contractor?.city || "",
            service_center_state: contractor?.state || "",
            service_center_zip: contractor?.zip_code || "",
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
      // Only save fields that exist in the contractor_settings table
      const settingsData = {
        contractor_id: contractorId,
        require_email: data.require_email,
        require_phone: data.require_phone,
        require_address: data.require_address,
        pricing_visibility: data.pricing_visibility,
        contact_capture_timing: data.contact_capture_timing,
        widget_theme_color: data.widget_theme_color,
        use_price_ranges: data.use_price_ranges,
        price_range_lower_percentage: data.price_range_lower_percentage,
        price_range_upper_percentage: data.price_range_upper_percentage,
        price_range_display_format: data.price_range_display_format,
        currency_symbol: data.currency_symbol,
        decimal_precision: data.decimal_precision,
        default_product_color: data.default_product_color,
        default_unit_type: data.default_unit_type,
        global_markup_percentage: data.global_markup_percentage,
        global_tax_rate: data.global_tax_rate,
        require_product_photos: data.require_product_photos,
        auto_activate_products: data.auto_activate_products,
        service_area_enabled: data.service_area_enabled,
        service_area_method: data.service_area_method,
        service_area_radius_miles: data.service_area_radius_miles,
        service_area_center_lat: data.service_area_center_lat,
        service_area_center_lng: data.service_area_center_lng,
        service_area_zip_codes: data.service_area_zip_codes,
      };

      const { error } = await supabase
        .from("contractor_settings")
        .upsert(settingsData, {
          onConflict: 'contractor_id'
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

  const geocodeServiceAddress = async () => {
    setGeocodingAddress(true);
    try {
      let address = "";
      if (settingsForm.watch("use_different_service_address")) {
        // Use custom service address
        const serviceAddress = settingsForm.getValues("service_center_address");
        const serviceCity = settingsForm.getValues("service_center_city");
        const serviceState = settingsForm.getValues("service_center_state");
        const serviceZip = settingsForm.getValues("service_center_zip");
        address = `${serviceAddress}, ${serviceCity}, ${serviceState} ${serviceZip}`.trim();
      } else {
        // Use business address
        const businessData = contractorForm.getValues();
        address = `${businessData.address}, ${businessData.city}, ${businessData.state} ${businessData.zip_code}`.trim();
      }

      if (!address || address === "   ") {
        toast({
          title: "Error",
          description: "Please enter a complete address first",
          variant: "destructive",
        });
        return;
      }

      // Use the existing Google Places edge function to get autocomplete
      const { data: autocompleteData, error: autocompleteError } = await supabase.functions.invoke('google-places-autocomplete', {
        body: {
          input: address,
          types: ['address']
        }
      });

      if (autocompleteError || !autocompleteData?.predictions?.length) {
        throw new Error("No address found");
      }

      // Get place details for the first result
      const { data: detailsData, error: detailsError } = await supabase.functions.invoke('google-places-autocomplete', {
        body: {
          placeId: autocompleteData.predictions[0].place_id
        }
      });

      if (detailsError || !detailsData?.geometry?.location) {
        throw new Error("Could not get address details");
      }

      const { lat, lng } = detailsData.geometry.location;

      // Update the coordinates in the form
      settingsForm.setValue("service_area_center_lat", lat);
      settingsForm.setValue("service_area_center_lng", lng);

      toast({
        title: "Success",
        description: `Coordinates set: ${lat.toFixed(6)}, ${lng.toFixed(6)}`,
      });
    } catch (error: any) {
      toast({
        title: "Error",
        description: "Failed to geocode address. Please check the address and try again.",
        variant: "destructive",
      });
    } finally {
      setGeocodingAddress(false);
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
                                  <SelectItem value="on_submit">On Submit</SelectItem>
                                  <SelectItem value="optional">Optional</SelectItem>
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
                            name="price_range_lower_percentage"
                            render={({ field }) => (
                              <FormItem>
                                <FormLabel>Lower Range (%)</FormLabel>
                                <FormControl>
                                  <Input 
                                    type="number" 
                                    min="0" 
                                    max="50" 
                                    {...field} 
                                    onChange={(e) => field.onChange(parseFloat(e.target.value))}
                                  />
                                </FormControl>
                                <FormDescription>
                                  Percentage discount from base price (0-50%)
                                </FormDescription>
                                <FormMessage />
                              </FormItem>
                            )}
                          />
                          <FormField
                            control={settingsForm.control}
                            name="price_range_upper_percentage"
                            render={({ field }) => (
                              <FormItem>
                                <FormLabel>Upper Range (%)</FormLabel>
                                <FormControl>
                                  <Input 
                                    type="number" 
                                    min="0" 
                                    max="100" 
                                    {...field} 
                                    onChange={(e) => field.onChange(parseFloat(e.target.value))}
                                  />
                                </FormControl>
                                <FormDescription>
                                  Percentage increase from base price (0-100%)
                                </FormDescription>
                                <FormMessage />
                              </FormItem>
                            )}
                          />
                        </div>
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
                              <>
                                <div className="space-y-4">
                                  <div className="flex items-center justify-between">
                                    <FormLabel>Service Center Address</FormLabel>
                                    <Button
                                      type="button"
                                      variant="outline"
                                      size="sm"
                                      onClick={() => {
                                        const useDifferent = !settingsForm.watch("use_different_service_address");
                                        settingsForm.setValue("use_different_service_address", useDifferent);
                                        if (!useDifferent) {
                                          // Reset to business address
                                          const businessAddress = contractorForm.getValues();
                                          settingsForm.setValue("service_center_address", businessAddress.address || "");
                                          settingsForm.setValue("service_center_city", businessAddress.city || "");
                                          settingsForm.setValue("service_center_state", businessAddress.state || "");
                                          settingsForm.setValue("service_center_zip", businessAddress.zip_code || "");
                                        }
                                      }}
                                    >
                                      {settingsForm.watch("use_different_service_address") ? "Use Business Address" : "Use Different Address"}
                                    </Button>
                                  </div>
                                  
                                  {settingsForm.watch("use_different_service_address") ? (
                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 p-4 border rounded-lg bg-muted/50">
                                      <FormField
                                        control={settingsForm.control}
                                        name="service_center_address"
                                        render={({ field }) => (
                                          <FormItem className="md:col-span-2">
                                            <FormLabel>Service Center Address</FormLabel>
                                            <FormControl>
                                              <Input placeholder="123 Service Center St" {...field} />
                                            </FormControl>
                                            <FormMessage />
                                          </FormItem>
                                        )}
                                      />
                                      <FormField
                                        control={settingsForm.control}
                                        name="service_center_city"
                                        render={({ field }) => (
                                          <FormItem>
                                            <FormLabel>City</FormLabel>
                                            <FormControl>
                                              <Input placeholder="Service City" {...field} />
                                            </FormControl>
                                            <FormMessage />
                                          </FormItem>
                                        )}
                                      />
                                      <FormField
                                        control={settingsForm.control}
                                        name="service_center_state"
                                        render={({ field }) => (
                                          <FormItem>
                                            <FormLabel>State</FormLabel>
                                            <Select onValueChange={field.onChange} value={field.value}>
                                              <FormControl>
                                                <SelectTrigger>
                                                  <SelectValue placeholder="Select state" />
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
                                        control={settingsForm.control}
                                        name="service_center_zip"
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
                                    </div>
                                  ) : (
                                    <div className="p-4 border rounded-lg bg-muted/20">
                                      <p className="text-sm text-muted-foreground">
                                        Using business address: {contractorForm.watch("address") || "No business address set"}
                                        {contractorForm.watch("city") && `, ${contractorForm.watch("city")}`}
                                        {contractorForm.watch("state") && `, ${contractorForm.watch("state")}`}
                                        {contractorForm.watch("zip_code") && ` ${contractorForm.watch("zip_code")}`}
                                      </p>
                                    </div>
                                  )}
                                </div>

                                <div className="space-y-4">
                                  <div className="p-4 border rounded-lg bg-muted/10">
                                    <div className="flex items-center justify-between mb-2">
                                      <h4 className="text-sm font-medium">Service Center Coordinates</h4>
                                      <Button
                                        type="button"
                                        variant="outline"
                                        size="sm"
                                        onClick={geocodeServiceAddress}
                                        disabled={geocodingAddress}
                                      >
                                        <Navigation className="h-4 w-4 mr-2" />
                                        {geocodingAddress ? "Setting..." : "Set Coordinates"}
                                      </Button>
                                    </div>
                                    {settingsForm.watch("service_area_center_lat") && settingsForm.watch("service_area_center_lng") ? (
                                      <p className="text-sm text-muted-foreground">
                                        Coordinates: {settingsForm.watch("service_area_center_lat")?.toFixed(6)}, {settingsForm.watch("service_area_center_lng")?.toFixed(6)}
                                      </p>
                                    ) : (
                                      <p className="text-sm text-muted-foreground text-orange-600">
                                        No coordinates set. Click "Set Coordinates" to geocode your service address.
                                      </p>
                                    )}
                                  </div>

                                  <FormField
                                    control={settingsForm.control}
                                    name="service_area_radius_miles"
                                    render={({ field }) => (
                                      <FormItem>
                                        <FormLabel>Service Radius (miles)</FormLabel>
                                        <FormControl>
                                          <Input
                                            type="number"
                                            min={5}
                                            max={200}
                                            placeholder="Enter radius in miles"
                                            {...field}
                                            onChange={(e) => field.onChange(Number(e.target.value))}
                                          />
                                        </FormControl>
                                        <FormDescription>
                                          Distance from your service center location (5-200 miles)
                                        </FormDescription>
                                        <FormMessage />
                                      </FormItem>
                                    )}
                                  />
                                </div>
                              </>
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

          {/* Widget Integration Card */}
          {contractorId && (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Code className="h-5 w-5" />
                  Widget Integration
                </CardTitle>
                <CardDescription>
                  Embed your quote widget on your website or share the direct link with customers
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                {/* Widget URL */}
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <label className="text-sm font-medium">Widget URL</label>
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={() => {
                        const url = `${window.location.origin}/widget/${contractorId}`;
                        navigator.clipboard.writeText(url);
                        setCopiedUrl(true);
                        setTimeout(() => setCopiedUrl(false), 2000);
                        toast({
                          title: "Copied!",
                          description: "Widget URL copied to clipboard",
                        });
                      }}
                    >
                      {copiedUrl ? (
                        <>
                          <Check className="h-4 w-4 mr-2" />
                          Copied
                        </>
                      ) : (
                        <>
                          <Copy className="h-4 w-4 mr-2" />
                          Copy URL
                        </>
                      )}
                    </Button>
                  </div>
                  <div className="p-3 sm:p-4 bg-muted rounded-lg font-mono text-xs sm:text-sm break-all">
                    {window.location.origin}/widget/{contractorId}
                  </div>
                  <p className="text-xs sm:text-sm text-muted-foreground">
                    Share this URL with customers or use it if you don't have a website
                  </p>
                </div>

                {/* Embed Code */}
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <label className="text-sm font-medium">Embed Code</label>
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={() => {
                        const embedCode = `<iframe src="${window.location.origin}/widget/${contractorId}" width="100%" height="800" style="border: none; border-radius: 8px;"></iframe>`;
                        navigator.clipboard.writeText(embedCode);
                        setCopiedEmbed(true);
                        setTimeout(() => setCopiedEmbed(false), 2000);
                        toast({
                          title: "Copied!",
                          description: "Embed code copied to clipboard",
                        });
                      }}
                    >
                      {copiedEmbed ? (
                        <>
                          <Check className="h-4 w-4 mr-2" />
                          Copied
                        </>
                      ) : (
                        <>
                          <Copy className="h-4 w-4 mr-2" />
                          Copy Code
                        </>
                      )}
                    </Button>
                  </div>
                  <div className="p-3 sm:p-4 bg-muted rounded-lg font-mono text-xs overflow-x-auto">
                    <code className="whitespace-pre-wrap break-all">
                      {`<iframe\n  src="${window.location.origin}/widget/${contractorId}"\n  width="100%"\n  height="800"\n  style="border: none; border-radius: 8px;">\n</iframe>`}
                    </code>
                  </div>
                  <p className="text-xs sm:text-sm text-muted-foreground">
                    Provide this code to your web developer to embed the widget on your website
                  </p>
                </div>

                {/* Actions */}
                <div className="flex flex-col sm:flex-row gap-3 pt-4">
                  <Button
                    type="button"
                    variant="outline"
                    className="w-full sm:w-auto"
                    onClick={() => window.open(`/widget/${contractorId}?t=${Date.now()}`, '_blank')}
                  >
                    <ExternalLink className="h-4 w-4 mr-2" />
                    Preview Widget
                  </Button>
                </div>

                <div className="p-3 sm:p-4 bg-blue-50 dark:bg-blue-950/20 border border-blue-200 dark:border-blue-900 rounded-lg">
                  <p className="text-xs sm:text-sm text-blue-800 dark:text-blue-200">
                    <strong>Note:</strong> The widget automatically updates when you change products, settings, or pricing. No need to update the embed code!
                  </p>
                </div>
              </CardContent>
            </Card>
          )}
        </div>
      </main>
    </div>
  );
};

export default Settings;