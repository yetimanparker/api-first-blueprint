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
import { Settings as SettingsIcon, Palette, CreditCard, ArrowLeft } from "lucide-react";
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