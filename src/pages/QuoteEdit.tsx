import { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { ArrowLeft, Copy, Save, History, Edit, Trash2, Check, X, Phone, Mail, MapPin, Ruler, Plus, ChevronDown } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/components/ui/use-toast";
import { EditQuoteItemDialog } from "@/components/EditQuoteItemDialog";
import { useGlobalSettings } from "@/hooks/useGlobalSettings";
import { displayQuoteTotal, displayLineItemPrice, formatExactPrice, calculateAddonWithAreaData } from "@/lib/priceUtils";
import MeasurementMap from "@/components/quote/MeasurementMap";
import MeasurementDetails from "@/components/quote/MeasurementDetails";
import type { MeasurementData } from "@/types/widget";
import { TaskDropdown } from "@/components/crm/TaskDropdown";
import QuoteTasksSection from "@/components/crm/QuoteTasksSection";

interface Quote {
  id: string;
  quote_number: string;
  status: string;
  total_amount: number;
  created_at: string;
  expires_at?: string;
  project_address?: string;
  project_city?: string;
  project_state?: string;
  project_zip_code?: string;
  notes?: string;
  access_token?: string;
  version_number: number;
  parent_quote_id?: string;
  customer_id: string;
}

interface Customer {
  id: string;
  first_name: string;
  last_name: string;
  email: string;
  phone?: string;
  address?: string;
  city?: string;
  state?: string;
  zip_code?: string;
}

interface QuoteItem {
  id: string;
  product_id: string;
  quantity: number;
  unit_price: number;
  line_total: number;
  notes?: string;
  measurement_data?: {
    variations?: Array<{
      id: string;
      name: string;
      priceAdjustment: number;
      adjustmentType: 'fixed' | 'percentage';
      height_value?: number;
      unit_of_measurement?: string;
      affects_area_calculation?: boolean;
      [key: string]: any;
    }>;
    addons?: Array<{
      id?: string;  // New format
      name?: string;  // New format
      priceValue?: number;
      calculationType?: 'per_unit' | 'total' | 'area_calculation';
      quantity?: number;
      addonCost?: number;
      // Old format for backward compatibility
      addon_id?: string;
      addon_name?: string;
      addon_price?: number;
      addon_cost?: number;
      price_type?: string;
      calculation_type?: string;
      [key: string]: any;
    }>;
    [key: string]: any;
  };
  product: {
    name: string;
    unit_type: string;
  };
}

export default function QuoteEdit() {
  const { quoteId, accessToken } = useParams();
  const navigate = useNavigate();
  const { toast } = useToast();
  const { settings } = useGlobalSettings();
  const [quote, setQuote] = useState<Quote | null>(null);
  const [customer, setCustomer] = useState<Customer | null>(null);
  const [quoteItems, setQuoteItems] = useState<QuoteItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [editingItem, setEditingItem] = useState<QuoteItem | null>(null);
  const [deletingItemId, setDeletingItemId] = useState<string | null>(null);
  const [editingAddress, setEditingAddress] = useState(false);
  const [tasksOpen, setTasksOpen] = useState(false);
  const [addressForm, setAddressForm] = useState({
    project_address: "",
    project_city: "", 
    project_state: "",
    project_zip_code: "",
    notes: ""
  });

  useEffect(() => {
    if (quoteId) {
      fetchQuoteData();
    }
  }, [quoteId]);

  useEffect(() => {
    if (quote) {
      setAddressForm({
        project_address: quote.project_address || "",
        project_city: quote.project_city || "",
        project_state: quote.project_state || "",
        project_zip_code: quote.project_zip_code || "",
        notes: quote.notes || ""
      });
    }
  }, [quote]);

  const fetchQuoteData = async () => {
    try {
      setLoading(true);
      
      // Fetch quote details with customer info
      const { data: quoteData, error: quoteError } = await supabase
        .from('quotes')
        .select(`
          *,
          customer:customers(*)
        `)
        .eq('id', quoteId)
        .single();

      if (quoteError) throw quoteError;
      
      // If accessing via token, verify it matches
      if (accessToken && quoteData.access_token !== accessToken) {
        throw new Error('Invalid access token');
      }

      setQuote(quoteData);
      setCustomer(quoteData.customer);

      // Fetch quote items with product details
      const { data: itemsData, error: itemsError } = await supabase
        .from('quote_items')
        .select(`
          *,
          product:products(name, unit_type)
        `)
        .eq('quote_id', quoteId)
        .order('created_at');

      if (itemsError) throw itemsError;
      
      setQuoteItems((itemsData || []) as QuoteItem[]);

    } catch (error) {
      console.error('Error fetching quote data:', error);
      toast({
        title: "Error",
        description: "Failed to load quote data",
        variant: "destructive",
      });
      navigate('/crm');
    } finally {
      setLoading(false);
    }
  };

  const createChangeOrder = async () => {
    if (!quote || !customer) return;

    try {
      setSaving(true);

      // Generate new access token for the change order
      const { data: tokenData } = await supabase.rpc('generate_quote_access_token');
      
      // Get contractor ID
      const { data: contractorId } = await supabase.rpc('get_current_contractor_id');
      
      // Create new quote as change order
      const newQuoteNumber = `${quote.quote_number}-CO${quote.version_number + 1}`;
      
      const { data: newQuote, error: quoteError } = await supabase
        .from('quotes')
        .insert({
          quote_number: newQuoteNumber,
          customer_id: customer.id,
          contractor_id: contractorId,
          status: 'draft',
          project_address: quote.project_address,
          project_city: quote.project_city,
          project_state: quote.project_state,
          project_zip_code: quote.project_zip_code,
          notes: quote.notes,
          access_token: tokenData,
          version_number: quote.version_number + 1,
          parent_quote_id: quote.parent_quote_id || quote.id,
          total_amount: 0 // Will be updated when items are added
        })
        .select()
        .single();

      if (quoteError) throw quoteError;

      // Copy existing quote items to the new quote
      if (quoteItems.length > 0) {
        const newItems = quoteItems.map(item => ({
          quote_id: newQuote.id,
          product_id: item.product_id,
          quantity: item.quantity,
          unit_price: item.unit_price,
          line_total: item.line_total,
          notes: item.notes
        }));

        const { error: itemsError } = await supabase
          .from('quote_items')
          .insert(newItems);

        if (itemsError) throw itemsError;

        // Update total amount
        const totalAmount = quoteItems.reduce((sum, item) => sum + item.line_total, 0);
        await supabase
          .from('quotes')
          .update({ total_amount: totalAmount })
          .eq('id', newQuote.id);
      }

      toast({
        title: "Change Order Created",
        description: `New quote ${newQuoteNumber} created successfully`,
      });

      // Navigate to the new change order
      navigate(`/quote/edit/${newQuote.id}`);

    } catch (error) {
      console.error('Error creating change order:', error);
      toast({
        title: "Error",
        description: "Failed to create change order",
        variant: "destructive",
      });
    } finally {
      setSaving(false);
    }
  };

  const copyQuoteLink = () => {
    if (!quote?.access_token) return;
    
    const link = `${window.location.origin}/quote/edit/${quote.id}/${quote.access_token}`;
    navigator.clipboard.writeText(link);
    
    toast({
      title: "Link Copied",
      description: "Quote editing link copied to clipboard",
    });
  };

  const deleteQuoteItem = async (itemId: string) => {
    try {
      const { error } = await supabase
        .from('quote_items')
        .delete()
        .eq('id', itemId);

      if (error) throw error;

      toast({
        title: "Item Deleted",
        description: "Quote item has been removed",
      });

      // Refresh quote data to update totals
      fetchQuoteData();
    } catch (error) {
      console.error('Error deleting quote item:', error);
      toast({
        title: "Error",
        description: "Failed to delete quote item",
        variant: "destructive",
      });
    } finally {
      setDeletingItemId(null);
    }
  };

  const saveAddressChanges = async () => {
    try {
      setSaving(true);
      
      const { error } = await supabase
        .from('quotes')
        .update({
          project_address: addressForm.project_address || null,
          project_city: addressForm.project_city || null,
          project_state: addressForm.project_state || null,
          project_zip_code: addressForm.project_zip_code || null,
          notes: addressForm.notes || null
        })
        .eq('id', quoteId);

      if (error) throw error;

      toast({
        title: "Address Updated",
        description: "Project address has been updated successfully",
      });

      setEditingAddress(false);
      fetchQuoteData(); // Refresh quote data
    } catch (error) {
      console.error('Error updating address:', error);
      toast({
        title: "Error", 
        description: "Failed to update project address",
        variant: "destructive",
      });
    } finally {
      setSaving(false);
    }
  };

  const cancelAddressEdit = () => {
    setEditingAddress(false);
    if (quote) {
      setAddressForm({
        project_address: quote.project_address || "",
        project_city: quote.project_city || "",
        project_state: quote.project_state || "",
        project_zip_code: quote.project_zip_code || "",
        notes: quote.notes || ""
      });
    }
  };

  const getStatusBadgeVariant = (status: string) => {
    switch (status) {
      case 'accepted': return 'default';
      case 'pending': return 'secondary';
      case 'declined': return 'destructive';
      case 'expired': return 'outline';
      case 'draft': return 'outline';
      default: return 'secondary';
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-background p-6">
        <div className="max-w-7xl mx-auto">
          <div className="text-center py-8">Loading quote...</div>
        </div>
      </div>
    );
  }

  if (!quote || !customer) {
    return (
      <div className="min-h-screen bg-background p-6">
        <div className="max-w-7xl mx-auto">
          <div className="text-center py-8">Quote not found</div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background p-3 sm:p-6">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="mb-4 sm:mb-6 space-y-3">
          {/* Top row: Back to CRM and Change Order buttons */}
          <div className="flex items-center justify-between gap-2">
            <Button variant="ghost" size="sm" onClick={() => navigate('/crm')}>
              <ArrowLeft className="h-4 w-4 mr-1" />
              <span className="hidden sm:inline">Back to CRM</span>
              <span className="sm:hidden">Back</span>
            </Button>
            <div className="flex items-center gap-2">
              {quote.access_token && (
                <Button variant="outline" size="sm" onClick={copyQuoteLink} className="hidden sm:flex">
                  <Copy className="h-4 w-4 mr-2" />
                  Copy Link
                </Button>
              )}
              <Button size="sm" onClick={createChangeOrder} disabled={saving}>
                <History className="h-4 w-4 sm:mr-2" />
                <span className="hidden sm:inline">
                  {saving ? 'Creating...' : 'Change Order'}
                </span>
              </Button>
            </div>
          </div>
          
          {/* Bottom row: Customer and Quote info */}
          <div className="space-y-1">
            <p className="text-sm text-muted-foreground">
              {customer.first_name} {customer.last_name}
            </p>
            <div className="flex items-center gap-2 flex-wrap">
              <h1 className="text-xl sm:text-2xl font-bold">{quote.quote_number}</h1>
              <Badge variant={getStatusBadgeVariant(quote.status)}>
                {quote.status}
              </Badge>
              {quote.parent_quote_id && (
                <Badge variant="outline">v{quote.version_number}</Badge>
              )}
            </div>
            <p className="text-sm text-muted-foreground">
              Created {new Date(quote.created_at).toLocaleDateString()}
            </p>
          </div>
        </div>

        {/* Customer Contact Card */}
        <Card className="mb-6">
          <CardHeader>
            <CardTitle>Customer Contact</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <div className="flex items-center gap-3">
                <Mail className="h-5 w-5 text-primary" />
                <div>
                  <p className="font-medium">Email</p>
                  <a href={`mailto:${customer.email}`} className="text-sm text-primary hover:underline">
                    {customer.email}
                  </a>
                </div>
              </div>
              {customer.phone && (
                <div className="flex items-center gap-3">
                  <Phone className="h-5 w-5 text-primary" />
                  <div>
                    <p className="font-medium">Phone</p>
                    <a href={`tel:${customer.phone}`} className="text-sm text-primary hover:underline">
                      {customer.phone}
                    </a>
                  </div>
                </div>
              )}
              {(customer.address || customer.city || customer.state) && (
                <div className="flex items-center gap-3">
                  <MapPin className="h-5 w-5 text-primary" />
                  <div>
                    <p className="font-medium">Customer Address</p>
                    <p className="text-sm text-muted-foreground">
                      {[customer.address, customer.city, customer.state, customer.zip_code]
                        .filter(Boolean)
                        .join(', ')}
                    </p>
                  </div>
                </div>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Tasks Section - Collapsible */}
        <Collapsible open={tasksOpen} onOpenChange={setTasksOpen} className="mb-6">
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <CollapsibleTrigger className="flex items-center gap-2 cursor-pointer hover:opacity-80 transition-opacity">
                  <CardTitle className="text-base">Tasks for this Quote</CardTitle>
                  <ChevronDown 
                    className={`h-5 w-5 text-muted-foreground transition-transform duration-200 ${
                      tasksOpen ? 'transform rotate-180' : ''
                    }`} 
                  />
                </CollapsibleTrigger>
                <TaskDropdown 
                  customerId={quote.customer_id}
                  quoteId={quote.id}
                  onTaskCreated={() => {
                    fetchQuoteData();
                    setTasksOpen(true);
                  }}
                  variant="outline"
                  size="sm"
                />
              </div>
            </CardHeader>
            <CollapsibleContent>
              <CardContent className="pt-0">
                <QuoteTasksSection quoteId={quote.id} />
              </CardContent>
            </CollapsibleContent>
          </Card>
        </Collapsible>

        {/* Action Button */}
        <div className="mb-6">
          <Button 
            variant="outline"
            onClick={() => navigate(`/quote/builder/${quote.id}`)}
            className="w-full sm:w-auto"
          >
            <Ruler className="h-4 w-4 mr-2" />
            Use Measurement Tool
          </Button>
        </div>


        {/* Quote Summary Card */}
        <Card className="mb-6 bg-green-50 dark:bg-green-950 border-2 border-green-200 dark:border-green-800 shadow-lg">
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle className="text-lg flex items-center gap-2 text-green-700 dark:text-green-400">
                Quote Summary ({quoteItems.length} {quoteItems.length === 1 ? 'Item' : 'Items'})
              </CardTitle>
              <div className="flex items-center gap-3">
                <Badge variant={getStatusBadgeVariant(quote.status)}>
                  {quote.status}
                </Badge>
                <span className="text-sm text-muted-foreground">
                  Created {new Date(quote.created_at).toLocaleDateString()}
                </span>
              </div>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            {quoteItems.length === 0 && (
              <div className="text-center py-6 text-muted-foreground">
                No items in this quote yet
              </div>
            )}

            {/* Project Address Section */}
            {quoteItems.length > 0 && (quote.project_address || editingAddress) && (
              <>
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <p className="font-semibold">Project Address</p>
                    {!editingAddress && (
                      <Button variant="ghost" size="sm" onClick={() => setEditingAddress(true)}>
                        <Edit className="h-4 w-4" />
                      </Button>
                    )}
                  </div>
                  
                  {editingAddress ? (
                    <div className="space-y-3">
                      <div>
                        <Label htmlFor="address">Street Address</Label>
                        <Input
                          id="address"
                          value={addressForm.project_address}
                          onChange={(e) => setAddressForm(prev => ({ ...prev, project_address: e.target.value }))}
                          placeholder="Enter street address"
                        />
                      </div>
                      
                      <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
                        <div>
                          <Label htmlFor="city">City</Label>
                          <Input
                            id="city"
                            value={addressForm.project_city}
                            onChange={(e) => setAddressForm(prev => ({ ...prev, project_city: e.target.value }))}
                            placeholder="City"
                          />
                        </div>
                        <div>
                          <Label htmlFor="state">State</Label>
                          <Input
                            id="state"
                            value={addressForm.project_state}
                            onChange={(e) => setAddressForm(prev => ({ ...prev, project_state: e.target.value }))}
                            placeholder="State"
                          />
                        </div>
                        <div>
                          <Label htmlFor="zip">ZIP Code</Label>
                          <Input
                            id="zip"
                            value={addressForm.project_zip_code}
                            onChange={(e) => setAddressForm(prev => ({ ...prev, project_zip_code: e.target.value }))}
                            placeholder="ZIP"
                          />
                        </div>
                      </div>
                      
                      <div className="flex gap-2 mt-3">
                        <Button size="sm" onClick={saveAddressChanges} disabled={saving}>
                          <Check className="h-4 w-4 mr-1" />
                          {saving ? "Saving..." : "Save"}
                        </Button>
                        <Button size="sm" variant="outline" onClick={cancelAddressEdit}>
                          <X className="h-4 w-4 mr-1" />
                          Cancel
                        </Button>
                      </div>
                    </div>
                  ) : (
                    <p className="text-sm text-primary">
                      {[quote.project_address, quote.project_city, quote.project_state, quote.project_zip_code]
                        .filter(Boolean)
                        .join(', ')}
                    </p>
                  )}
                </div>
                <Separator className="bg-green-300 dark:bg-green-700" />
              </>
            )}

            {/* Detailed Quote Items */}
            {quoteItems.length > 0 && (
              <div className="space-y-4 mb-6">
                {quoteItems.map((item) => {
                  const variations = item.measurement_data?.variations || [];
                  const addons = item.measurement_data?.addons || [];
                  
                  // Helper: Get unit abbreviation
                  const getUnitAbbreviation = (unitType: string) => {
                    switch (unitType) {
                      case 'sq_ft': return 'SF';
                      case 'linear_ft': return 'LF';
                      case 'cubic_yard': return 'cu yd';
                      case 'each': return 'ea';
                      default: return unitType?.replace('_', ' ') || 'unit';
                    }
                  };
                  
                  // Calculate variation-adjusted unit price
                  const getVariationAdjustedPrice = () => {
                    let adjustedPrice = item.unit_price;
                    variations.forEach((v) => {
                      if (v.adjustmentType === 'percentage') {
                        adjustedPrice += item.unit_price * (v.priceAdjustment / 100);
                      } else {
                        adjustedPrice += v.priceAdjustment;
                      }
                    });
                    return adjustedPrice;
                  };
                  
                  const baseUnitPrice = getVariationAdjustedPrice();
                  const baseTotal = baseUnitPrice * item.quantity;
                  const unitAbbr = getUnitAbbreviation(item.product.unit_type);
                  
                  return (
                    <div key={item.id} className="bg-background rounded-lg p-3 sm:p-4 border border-green-200 dark:border-green-800">
                      {/* Header: Product name with measurement inline + action buttons */}
                      <div className="flex items-start justify-between gap-2 mb-3">
                        <div className="flex items-center gap-2 flex-1">
                          <div 
                            className="w-3 h-3 rounded-full"
                            style={{ backgroundColor: item.measurement_data?.mapColor || '#3B82F6' }}
                          />
                          <span className="font-semibold text-base">
                            {item.product.name}
                            <span className="text-sm text-muted-foreground font-normal ml-2">
                              ({item.quantity.toLocaleString()} {unitAbbr})
                            </span>
                          </span>
                        </div>
                        <div className="flex gap-2">
                              <Button 
                                variant="ghost" 
                                size="icon" 
                                onClick={() => setEditingItem(item)}
                                title="Edit item"
                              >
                                <Edit className="h-4 w-4" />
                              </Button>
                          <Button 
                            variant="ghost" 
                            size="icon" 
                            onClick={() => setDeletingItemId(item.id)}
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      </div>
                      
                      <div className="space-y-1">
                          {/* Selection Header */}
                          {variations.length > 0 && (
                            <div className="text-sm font-bold text-muted-foreground">Selection:</div>
                          )}
                          
                          {/* Base Product Line with Variation */}
                          <div className="space-y-1">
                            <div className="text-base">
                              {variations.map((v) => (
                                <span key={v.id}>{v.name} </span>
                              ))}
                              {item.product.name}:
                            </div>
                            <div className="text-sm text-muted-foreground">
                              {item.quantity.toLocaleString()} {unitAbbr} × {formatExactPrice(baseUnitPrice, {
                                currency_symbol: settings?.currency_symbol || '$',
                                decimal_precision: settings?.decimal_precision || 2
                              })}/{unitAbbr} = <span className="font-bold">{formatExactPrice(baseTotal, {
                                currency_symbol: settings?.currency_symbol || '$',
                                decimal_precision: settings?.decimal_precision || 2
                              })}</span>
                            </div>
                          </div>
                          
                          {/* Add-ons Section */}
                          {addons.filter((a) => a.quantity > 0).length > 0 && (
                            <div className="space-y-1">
                              <div className="text-sm font-bold text-muted-foreground">Add-ons:</div>
                              {addons.filter((a) => a.quantity > 0).map((addon) => {
                                // Handle both old and new field name formats
                                const addonName = addon.name || addon.addon_name;
                                const addonPriceValue = addon.priceValue || addon.addon_price || 0;
                                const addonCalcType = addon.calculationType || addon.calculation_type || 'total';
                                const addonId = addon.id || addon.addon_id;
                                const addonQty = addon.quantity || 1;
                                
                                // Calculate proper addon display
                                let addonCalc = '';
                                let addonPrice = 0;
                                
                                const variationData = variations[0] ? {
                                  height: variations[0].height_value,
                                  unit: variations[0].unit_of_measurement,
                                  affects_area_calculation: variations[0].affects_area_calculation
                                } : undefined;
                                
                                if (addonCalcType === 'per_unit') {
                                  addonPrice = addonPriceValue * item.quantity * addonQty;
                                  addonCalc = `${item.quantity.toLocaleString()} ${unitAbbr} × ${formatExactPrice(addonPriceValue, {
                                    currency_symbol: settings?.currency_symbol || '$',
                                    decimal_precision: settings?.decimal_precision || 2
                                  })}/${unitAbbr}`;
                                } else if (addonCalcType === 'area_calculation') {
                                  // Calculate area with height
                                  const squareFeet = variationData?.affects_area_calculation && variationData.height
                                    ? item.quantity * variationData.height
                                    : item.quantity;
                                  addonPrice = addonPriceValue * squareFeet * addonQty;
                                  addonCalc = `${squareFeet.toLocaleString()} SF × ${formatExactPrice(addonPriceValue, {
                                    currency_symbol: settings?.currency_symbol || '$',
                                    decimal_precision: settings?.decimal_precision || 2
                                  })}/SF`;
                                } else {
                                  // Total calculation
                                  addonPrice = addonPriceValue * addonQty;
                                  addonCalc = `${addonQty} × ${formatExactPrice(addonPriceValue, {
                                    currency_symbol: settings?.currency_symbol || '$',
                                    decimal_precision: settings?.decimal_precision || 2
                                  })}`;
                                }
                                
                                return (
                                  <div key={addonId} className="space-y-1">
                                    <div className="text-base">{addonName}</div>
                                    <div className="text-sm text-muted-foreground">
                                      {addonCalc} = <span className="font-bold">{formatExactPrice(addonPrice, {
                                        currency_symbol: settings?.currency_symbol || '$',
                                        decimal_precision: settings?.decimal_precision || 2
                                      })}</span>
                                    </div>
                                  </div>
                                );
                              })}
                            </div>
                          )}
                          
                          {/* Item Total */}
                          <div className="border-t-2 border-border pt-3">
                            <div className="flex justify-end">
                              <span className="text-lg font-bold text-green-600">
                                Total: {formatExactPrice(item.line_total, {
                                  currency_symbol: settings?.currency_symbol || '$',
                                  decimal_precision: settings?.decimal_precision || 2
                                })}
                              </span>
                            </div>
                          </div>
                        </div>
                      </div>
                    );
                  })}
              </div>
            )}

            {quoteItems.length > 0 && (
              <>
                <Separator className="my-4 bg-green-300 dark:bg-green-700" />

                <div className="space-y-2">
                  <div className="flex justify-between text-sm sm:text-base">
                    <span>Subtotal:</span>
                    <span className="font-semibold">
                      {formatExactPrice(quoteItems.reduce((sum, item) => sum + item.line_total, 0), {
                        currency_symbol: settings?.currency_symbol || '$',
                        decimal_precision: settings?.decimal_precision || 2
                      })}
                    </span>
                  </div>
                  
                  {settings?.global_tax_rate > 0 && (
                    <div className="flex justify-between text-xs sm:text-sm text-muted-foreground">
                      <span>Tax ({settings.global_tax_rate}%):</span>
                      <span>
                        {formatExactPrice((quoteItems.reduce((sum, item) => sum + item.line_total, 0) * settings.global_tax_rate) / 100, {
                          currency_symbol: settings.currency_symbol,
                          decimal_precision: settings.decimal_precision
                        })}
                      </span>
                    </div>
                  )}
                  
                  <Separator className="my-2 bg-green-300 dark:bg-green-700" />
                  
                  <div className="flex justify-between text-xl sm:text-2xl font-bold pt-2">
                    <span>Total:</span>
                    <span className="text-green-600">
                      {formatExactPrice(
                        quoteItems.reduce((sum, item) => sum + item.line_total, 0) + 
                        (settings?.global_tax_rate > 0 
                          ? (quoteItems.reduce((sum, item) => sum + item.line_total, 0) * settings.global_tax_rate) / 100 
                          : 0),
                        {
                          currency_symbol: settings?.currency_symbol || '$',
                          decimal_precision: settings?.decimal_precision || 2
                        }
                      )}
                    </span>
                  </div>
                </div>
              </>
            )}

            {/* Notes Section */}
            {((quote.notes && !editingAddress) || editingAddress) && quoteItems.length > 0 && (
              <>
                <Separator className="bg-green-300 dark:bg-green-700" />
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <p className="font-semibold">Notes</p>
                    {!editingAddress && (
                      <Button variant="ghost" size="sm" onClick={() => setEditingAddress(true)}>
                        <Edit className="h-4 w-4" />
                      </Button>
                    )}
                  </div>
                  {editingAddress ? (
                    <Textarea
                      id="notes"
                      value={addressForm.notes}
                      onChange={(e) => setAddressForm(prev => ({ ...prev, notes: e.target.value }))}
                      placeholder="Project notes..."
                      className="mt-2"
                    />
                  ) : (
                    <p className="text-sm text-muted-foreground">{quote.notes}</p>
                  )}
                </div>
              </>
            )}
          </CardContent>
        </Card>

        {/* Measurement Overview Map */}
        {quoteItems.length > 0 && (
          <Card className="mb-6">
            <CardHeader>
              <CardTitle>Project Site Overview</CardTitle>
            </CardHeader>
            <CardContent>
              {quoteItems.some(item => 
                item.measurement_data?.coordinates?.length || 
                item.measurement_data?.pointLocations?.length
              ) ? (
                <>
                  <MeasurementMap
                    measurements={quoteItems
                      .filter(item => 
                        item.measurement_data?.coordinates?.length || 
                        item.measurement_data?.pointLocations?.length
                      )
                      .map(item => ({
                        type: item.measurement_data!.type,
                        coordinates: item.measurement_data!.coordinates,
                        pointLocations: item.measurement_data!.pointLocations,
                        productName: item.product.name,
                        productColor: item.measurement_data!.mapColor || '#3B82F6',
                        value: item.measurement_data!.value,
                        unit: item.measurement_data!.unit,
                      }))}
                    className="h-[500px]"
                  />
                  <div className="mt-4 flex flex-wrap gap-3">
                    {quoteItems
                      .filter(item => 
                        item.measurement_data?.coordinates?.length || 
                        item.measurement_data?.pointLocations?.length
                      )
                      .map((item) => (
                        <div key={item.id} className="flex items-center gap-2">
                          <div 
                            className="w-4 h-4 rounded" 
                            style={{ backgroundColor: item.measurement_data?.mapColor || '#3B82F6' }}
                          />
                          <span className="text-sm">{item.product.name}</span>
                        </div>
                      ))}
                  </div>
                </>
              ) : (
                <div className="bg-muted/50 rounded-lg p-8 text-center">
                  <MapPin className="h-12 w-12 mx-auto mb-3 text-muted-foreground" />
                  <p className="text-muted-foreground">No measurement locations recorded for this quote</p>
                  <p className="text-sm text-muted-foreground mt-1">Measurements were likely entered manually</p>
                </div>
              )}
            </CardContent>
          </Card>
        )}

        {/* Edit Item Dialog */}
        {editingItem && (
          <EditQuoteItemDialog
            open={!!editingItem}
            onOpenChange={(open) => !open && setEditingItem(null)}
            item={editingItem}
            onSuccess={() => {
              setEditingItem(null);
              fetchQuoteData();
            }}
          />
        )}

        {/* Delete Confirmation Dialog */}
        <AlertDialog open={!!deletingItemId} onOpenChange={() => setDeletingItemId(null)}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Delete Quote Item</AlertDialogTitle>
              <AlertDialogDescription>
                Are you sure you want to delete this item from the quote? This action cannot be undone.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel onClick={() => setDeletingItemId(null)}>
                Cancel
              </AlertDialogCancel>
              <AlertDialogAction
                onClick={() => deletingItemId && deleteQuoteItem(deletingItemId)}
                className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              >
                Delete
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </div>
    </div>
  );
}