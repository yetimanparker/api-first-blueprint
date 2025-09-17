import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { useToast } from "@/hooks/use-toast";
import { Settings as SettingsIcon, Palette, Eye, Users, CreditCard, ArrowLeft } from "lucide-react";
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
          settingsForm.reset({
            require_email: settings.require_email ?? true,
            require_phone: settings.require_phone ?? true,
            require_address: settings.require_address ?? true,
            pricing_visibility: (settings.pricing_visibility as "before_submit" | "after_submit" | "never") || "before_submit",
            contact_capture_timing: (settings.contact_capture_timing as "before_quote" | "after_quote") || "before_quote",
            widget_theme_color: settings.widget_theme_color || "#3B82F6",
          });
        }
      } else {
        // No contractor profile exists, set default values
        const { data: { user } } = await supabase.auth.getUser();
        if (user?.email) {
          contractorForm.reset({
            business_name: user.user_metadata?.business_name || "",
            email: user.email,
            phone: "",
            website: "",
            address: "",
            city: "",
            state: "",
            zip_code: "",
            brand_color: "#3B82F6",
            secondary_color: "#64748B",
            logo_url: "",
          });
        }
      }
    } catch (error: any) {
      toast({
        title: "Error",
        description: "Failed to load settings",
        variant: "destructive",
      });
      console.error("Error loading settings:", error);
    }
  };

  const onContractorSubmit = async (data: ContractorFormData) => {
    setSaving(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("User not authenticated");

      if (contractorId) {
        // Update existing contractor
        const { error } = await supabase
          .from("contractors")
          .update(data)
          .eq("id", contractorId);

        if (error) throw error;
      } else {
        // Create new contractor profile
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
      // Upsert contractor settings
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
      {/* Header */}
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
          {/* Business Information */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <CreditCard className="h-5 w-5" />
                Business Information
              </CardTitle>
              <CardDescription>
                Update your business details and branding
              </CardDescription>
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
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
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
                            <Input placeholder="https://yourbusiness.com" {...field} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>

                  <FormField
                    control={contractorForm.control}
                    name="address"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Address</FormLabel>
                        <FormControl>
                          <Input placeholder="123 Business St" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <FormField
                      control={contractorForm.control}
                      name="city"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>City</FormLabel>
                          <FormControl>
                            <Input placeholder="City" {...field} />
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
                          <Select onValueChange={field.onChange} defaultValue={field.value}>
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
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <FormField
                      control={contractorForm.control}
                      name="brand_color"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Brand Color</FormLabel>
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
                      control={contractorForm.control}
                      name="secondary_color"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Secondary Color</FormLabel>
                          <FormControl>
                            <div className="flex gap-2">
                              <Input type="color" {...field} className="w-16 h-10 p-1" />
                              <Input {...field} placeholder="#64748B" className="flex-1" />
                            </div>
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>

                  <FormField
                    control={contractorForm.control}
                    name="logo_url"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Logo URL</FormLabel>
                        <FormControl>
                          <Input placeholder="https://example.com/logo.png" {...field} />
                        </FormControl>
                        <FormDescription>
                          URL to your business logo (optional)
                        </FormDescription>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <div className="flex justify-end">
                    <Button type="submit" disabled={saving}>
                      {saving ? "Saving..." : contractorId ? "Update Business Info" : "Create Business Profile"}
                    </Button>
                  </div>
                </form>
              </Form>
            </CardContent>
          </Card>

          <Separator />

          {/* Widget Settings */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Palette className="h-5 w-5" />
                Quote Widget Settings
              </CardTitle>
              <CardDescription>
                Configure how your quote widget behaves for customers
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Form {...settingsForm}>
                <form onSubmit={settingsForm.handleSubmit(onSettingsSubmit)} className="space-y-6">
                  <div className="space-y-4">
                    <h4 className="text-sm font-medium">Required Customer Information</h4>
                    
                    <FormField
                      control={settingsForm.control}
                      name="require_email"
                      render={({ field }) => (
                        <FormItem className="flex flex-row items-center justify-between rounded-lg border p-4">
                          <div className="space-y-0.5">
                            <FormLabel>Email</FormLabel>
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
                            <FormLabel>Phone</FormLabel>
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
                            <FormLabel>Address</FormLabel>
                            <FormDescription>
                              Require customers to provide full address
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

                  <div className="space-y-4">
                    <h4 className="text-sm font-medium">Pricing & Contact Settings</h4>
                    
                    <FormField
                      control={settingsForm.control}
                      name="pricing_visibility"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Pricing Visibility</FormLabel>
                          <Select onValueChange={field.onChange} defaultValue={field.value}>
                            <FormControl>
                              <SelectTrigger>
                                <SelectValue placeholder="Select pricing visibility" />
                              </SelectTrigger>
                            </FormControl>
                            <SelectContent>
                              <SelectItem value="before_submit">Show pricing before quote submission</SelectItem>
                              <SelectItem value="after_submit">Show pricing after quote submission</SelectItem>
                              <SelectItem value="never">Never show pricing in widget</SelectItem>
                            </SelectContent>
                          </Select>
                          <FormDescription>
                            When should customers see pricing information?
                          </FormDescription>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    <FormField
                      control={settingsForm.control}
                      name="contact_capture_timing"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Contact Capture Timing</FormLabel>
                          <Select onValueChange={field.onChange} defaultValue={field.value}>
                            <FormControl>
                              <SelectTrigger>
                                <SelectValue placeholder="Select contact timing" />
                              </SelectTrigger>
                            </FormControl>
                            <SelectContent>
                              <SelectItem value="before_quote">Collect contact info before showing quote</SelectItem>
                              <SelectItem value="after_quote">Collect contact info after showing quote</SelectItem>
                            </SelectContent>
                          </Select>
                          <FormDescription>
                            When should you collect customer contact information?
                          </FormDescription>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>

                  <FormField
                    control={settingsForm.control}
                    name="widget_theme_color"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Widget Theme Color</FormLabel>
                        <FormControl>
                          <div className="flex gap-2">
                            <Input type="color" {...field} className="w-16 h-10 p-1" />
                            <Input {...field} placeholder="#3B82F6" className="flex-1" />
                          </div>
                        </FormControl>
                        <FormDescription>
                          Primary color for the customer quote widget
                        </FormDescription>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <div className="flex justify-end">
                    <Button type="submit" disabled={saving}>
                      {saving ? "Saving..." : "Save Widget Settings"}
                    </Button>
                  </div>
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