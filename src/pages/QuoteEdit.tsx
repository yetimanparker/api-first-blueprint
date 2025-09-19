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
import { ArrowLeft, Copy, Save, History, Edit, Trash2, Check, X } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/components/ui/use-toast";
import { QuoteItemForm } from "@/components/QuoteItemForm";
import { useGlobalSettings } from "@/hooks/useGlobalSettings";
import { displayQuoteTotal, displayLineItemPrice } from "@/lib/priceUtils";

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
}

interface QuoteItem {
  id: string;
  product_id: string;
  quantity: number;
  unit_price: number;
  line_total: number;
  notes?: string;
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
      setQuoteItems(itemsData || []);

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
    <div className="min-h-screen bg-background p-6">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-4">
            <Button variant="ghost" onClick={() => navigate('/crm')}>
              <ArrowLeft className="h-4 w-4 mr-2" />
              Back to CRM
            </Button>
            <div>
              <div className="flex items-center gap-3">
                <h1 className="text-3xl font-bold">{quote.quote_number}</h1>
                <Badge variant={getStatusBadgeVariant(quote.status)}>
                  {quote.status}
                </Badge>
                {quote.parent_quote_id && (
                  <Badge variant="outline">Change Order v{quote.version_number}</Badge>
                )}
              </div>
              <p className="text-muted-foreground">
                {customer.first_name} {customer.last_name} • Created {new Date(quote.created_at).toLocaleDateString()}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {quote.access_token && (
              <Button variant="outline" onClick={copyQuoteLink}>
                <Copy className="h-4 w-4 mr-2" />
                Copy Link
              </Button>
            )}
            <Button onClick={createChangeOrder} disabled={saving}>
              <History className="h-4 w-4 mr-2" />
              {saving ? 'Creating...' : 'Create Change Order'}
            </Button>
          </div>
        </div>

        {/* Quote Details Card */}
        <Card className="mb-6">
          <CardHeader>
            <CardTitle>Quote Details</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
              <div>
                <p className="font-medium">Total Amount</p>
                <p className="text-2xl font-bold text-primary">
                  {settings ? displayQuoteTotal(quote.total_amount, settings, quote.status) : `$${quote.total_amount.toLocaleString()}`}
                </p>
              </div>
              <div>
                <p className="font-medium">Status</p>
                <Badge variant={getStatusBadgeVariant(quote.status)} className="mt-1">
                  {quote.status}
                </Badge>
              </div>
              <div>
                <p className="font-medium">Created</p>
                <p className="text-sm text-muted-foreground">{new Date(quote.created_at).toLocaleDateString()}</p>
              </div>
              {quote.expires_at && (
                <div>
                  <p className="font-medium">Expires</p>
                  <p className="text-sm text-muted-foreground">{new Date(quote.expires_at).toLocaleDateString()}</p>
                </div>
              )}
            </div>
            
            {quote.project_address || editingAddress ? (
              <>
                <Separator className="my-4" />
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <p className="font-medium">Project Address</p>
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
                    <p className="text-sm text-muted-foreground">
                      {[quote.project_address, quote.project_city, quote.project_state, quote.project_zip_code]
                        .filter(Boolean)
                        .join(', ')}
                    </p>
                  )}
                </div>
              </>
            ) : (
              <>
                <Separator className="my-4" />
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <p className="font-medium">Project Address</p>
                    <Button variant="ghost" size="sm" onClick={() => setEditingAddress(true)}>
                      <Edit className="h-4 w-4" />
                    </Button>
                  </div>
                  <p className="text-sm text-muted-foreground">No address specified</p>
                </div>
              </>
            )}

            {(quote.notes || editingAddress) && !editingAddress && (
              <>
                <Separator className="my-4" />
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <p className="font-medium">Notes</p>
                    <Button variant="ghost" size="sm" onClick={() => setEditingAddress(true)}>
                      <Edit className="h-4 w-4" />
                    </Button>
                  </div>
                  <p className="text-sm text-muted-foreground">{quote.notes}</p>
                </div>
              </>
            )}

            {editingAddress && (
              <>
                <Separator className="my-4" />
                <div>
                  <Label htmlFor="notes">Notes</Label>
                  <Textarea
                    id="notes"
                    value={addressForm.notes}
                    onChange={(e) => setAddressForm(prev => ({ ...prev, notes: e.target.value }))}
                    placeholder="Project notes..."
                    className="mt-2"
                  />
                </div>
              </>
            )}
          </CardContent>
        </Card>

        {/* Quote Items */}
        <Card className="mb-6">
          <CardHeader>
            <CardTitle>Quote Items ({quoteItems.length})</CardTitle>
          </CardHeader>
          <CardContent>
            {quoteItems.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                No items in this quote yet
              </div>
            ) : (
              <div className="space-y-4">
                {quoteItems.map((item) => (
                  <div key={item.id} className="border rounded-lg p-4">
                    <div className="flex items-center justify-between mb-2">
                      <h3 className="font-medium">{item.product.name}</h3>
                      <div className="flex items-center gap-2">
                        {!settings?.use_price_ranges && (
                          <p className="font-bold text-primary">
                            {settings ? displayLineItemPrice(item.line_total, settings) : `$${item.line_total.toLocaleString()}`}
                          </p>
                        )}
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => setEditingItem(item)}
                        >
                          <Edit className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => setDeletingItemId(item.id)}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm text-muted-foreground">
                      <div>
                        Quantity: {item.quantity} {item.product.unit_type}
                      </div>
                      {!settings?.use_price_ranges && (
                        <div>
                          Unit Price: {settings ? displayLineItemPrice(item.unit_price, settings) : `$${item.unit_price.toLocaleString()}`}
                        </div>
                      )}
                      {settings?.use_price_ranges && (
                        <div>
                          Price included in total
                        </div>
                      )}
                      {item.notes && (
                        <div>
                          Notes: {item.notes}
                        </div>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Add New Items Section */}
        <QuoteItemForm 
          quoteId={quote.id}
          onItemAdded={fetchQuoteData}
        />

        {/* Edit Item Dialog */}
        <Dialog open={!!editingItem} onOpenChange={() => setEditingItem(null)}>
          <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>Edit Quote Item</DialogTitle>
            </DialogHeader>
            {editingItem && (
              <div className="mt-4">
                <QuoteItemForm
                  quoteId={quote.id}
                  editingItem={editingItem}
                  onItemAdded={() => {
                    setEditingItem(null);
                    fetchQuoteData();
                  }}
                />
              </div>
            )}
          </DialogContent>
        </Dialog>

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