import { useState, useEffect } from "react";
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
import { Settings as SettingsIcon, Palette, Eye, Users, CreditCard } from "lucide-react";
import { Form, FormControl, FormDescription, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";

const contractorSchema = z.object({
  business_name: z.string().min(1, "Business name is required"),
  email: z.string().email("Invalid email address"),
  phone: z.string().optional(),
  website: z.string().url("Invalid URL").optional().or(z.literal("")),
  address: z.string().optional(),
  city: z.string().optional(),
  state: z.string().optional(),
  zip_code: z.string().optional(),
  brand_color: z.string().regex(/^#[0-9A-F]{6}$/i, "Invalid hex color"),
  secondary_color: z.string().regex(/^#[0-9A-F]{6}$/i, "Invalid hex color"),
  logo_url: z.string().url("Invalid URL").optional().or(z.literal("")),
});

const settingsSchema = z.object({
  pricing_visibility: z.enum(["before_submit", "after_submit"]),
  contact_capture_timing: z.enum(["before_quote", "on_submit", "optional"]),
  require_phone: z.boolean(),
  require_address: z.boolean(),
  require_email: z.boolean(),
  widget_theme_color: z.string().regex(/^#[0-9A-F]{6}$/i, "Invalid hex color"),
});

type ContractorFormData = z.infer<typeof contractorSchema>;
type SettingsFormData = z.infer<typeof settingsSchema>;

export default function Settings() {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [contractorId, setContractorId] = useState<string | null>(null);
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
      pricing_visibility: "before_submit",
      contact_capture_timing: "before_quote",
      require_phone: true,
      require_address: true,
      require_email: true,
      widget_theme_color: "#3B82F6",
    },
  });

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      // Fetch contractor data
      const { data: contractor, error: contractorError } = await supabase
        .from("contractors")
        .select("*")
        .single();

      if (contractorError) throw contractorError;

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

        // Fetch contractor settings
        const { data: settings, error: settingsError } = await supabase
          .from("contractor_settings")
          .select("*")
          .eq("contractor_id", contractor.id)
          .maybeSingle();

        if (settingsError && settingsError.code !== 'PGRST116') throw settingsError;

        if (settings) {
          settingsForm.reset({
            pricing_visibility: settings.pricing_visibility as any,
            contact_capture_timing: settings.contact_capture_timing as any,
            require_phone: settings.require_phone,
            require_address: settings.require_address,
            require_email: settings.require_email,
            widget_theme_color: settings.widget_theme_color || "#3B82F6",
          });
        }
      }
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

  const onContractorSubmit = async (data: ContractorFormData) => {
    if (!contractorId) return;
    
    setSaving(true);
    try {
      const { error } = await supabase
        .from("contractors")
        .update(data)
        .eq("id", contractorId);

      if (error) throw error;

      toast({
        title: "Success",
        description: "Business information updated successfully",
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
    if (!contractorId) return;

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
        description: "Widget settings updated successfully",
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

  if (loading) {
    return (
      <div className="container mx-auto py-8">
        <div className="flex items-center justify-center h-64">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
        </div>
      </div>
    );
  }

  return (
    <div className="container mx-auto py-8">
      <div className="mb-8">
        <h1 className="text-3xl font-bold flex items-center gap-2">
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
                          <Input {...field} />
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
                          <Input type="email" {...field} />
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
                          <Input {...field} value={field.value || ""} />
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
                          <Input {...field} value={field.value || ""} placeholder="https://example.com" />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>

                <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                  <FormField
                    control={contractorForm.control}
                    name="address"
                    render={({ field }) => (
                      <FormItem className="md:col-span-2">
                        <FormLabel>Address</FormLabel>
                        <FormControl>
                          <Input {...field} value={field.value || ""} />
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
                          <Input {...field} value={field.value || ""} />
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
                        <FormControl>
                          <Input {...field} value={field.value || ""} />
                        </FormControl>
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
                          <Input {...field} value={field.value || ""} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>

                <Separator />

                <div className="space-y-4">
                  <h3 className="text-lg font-semibold flex items-center gap-2">
                    <Palette className="h-5 w-5" />
                    Branding
                  </h3>
                  
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <FormField
                      control={contractorForm.control}
                      name="brand_color"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Brand Color</FormLabel>
                          <FormControl>
                            <div className="flex gap-2">
                              <Input type="color" {...field} className="w-16 h-10 p-1" />
                              <Input {...field} className="flex-1" />
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
                              <Input {...field} className="flex-1" />
                            </div>
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    <FormField
                      control={contractorForm.control}
                      name="logo_url"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Logo URL</FormLabel>
                          <FormControl>
                            <Input {...field} value={field.value || ""} placeholder="https://example.com/logo.png" />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>
                </div>

                <div className="flex justify-end">
                  <Button type="submit" disabled={saving}>
                    {saving ? "Saving..." : "Save Business Info"}
                  </Button>
                </div>
              </form>
            </Form>
          </CardContent>
        </Card>

        {/* Widget Settings */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Eye className="h-5 w-5" />
              Widget Settings
            </CardTitle>
            <CardDescription>
              Configure how your quote widget behaves for customers
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Form {...settingsForm}>
              <form onSubmit={settingsForm.handleSubmit(onSettingsSubmit)} className="space-y-6">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <FormField
                    control={settingsForm.control}
                    name="pricing_visibility"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Pricing Visibility</FormLabel>
                        <Select onValueChange={field.onChange} defaultValue={field.value}>
                          <FormControl>
                            <SelectTrigger>
                              <SelectValue />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            <SelectItem value="before_submit">Show before submission</SelectItem>
                            <SelectItem value="after_submit">Show after submission</SelectItem>
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
                        <FormLabel>Contact Capture</FormLabel>
                        <Select onValueChange={field.onChange} defaultValue={field.value}>
                          <FormControl>
                            <SelectTrigger>
                              <SelectValue />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            <SelectItem value="before_quote">Before starting quote</SelectItem>
                            <SelectItem value="on_submit">When submitting quote</SelectItem>
                            <SelectItem value="optional">Optional</SelectItem>
                          </SelectContent>
                        </Select>
                        <FormDescription>
                          When should customer contact info be collected?
                        </FormDescription>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>

                <Separator />

                <div className="space-y-4">
                  <h3 className="text-lg font-semibold flex items-center gap-2">
                    <Users className="h-5 w-5" />
                    Required Customer Information
                  </h3>
                  
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <FormField
                      control={settingsForm.control}
                      name="require_email"
                      render={({ field }) => (
                        <FormItem className="flex flex-row items-center justify-between rounded-lg border p-4">
                          <div className="space-y-0.5">
                            <FormLabel>Email Address</FormLabel>
                            <FormDescription>
                              Require customer email
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
                            <FormLabel>Phone Number</FormLabel>
                            <FormDescription>
                              Require customer phone
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
                              Require customer address
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

                <FormField
                  control={settingsForm.control}
                  name="widget_theme_color"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Widget Theme Color</FormLabel>
                      <FormControl>
                        <div className="flex gap-2 max-w-xs">
                          <Input type="color" {...field} className="w-16 h-10 p-1" />
                          <Input {...field} className="flex-1" />
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
    </div>
  );
}