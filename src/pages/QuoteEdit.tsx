import { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { ArrowLeft, Copy, Save, History } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/components/ui/use-toast";
import { ProductForm } from "@/components/ProductForm";
import { useGlobalSettings } from "@/hooks/useGlobalSettings";
import { displayPrice } from "@/lib/priceUtils";

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

  useEffect(() => {
    if (quoteId) {
      fetchQuoteData();
    }
  }, [quoteId]);

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
                  {settings ? displayPrice(quote.total_amount, settings) : `$${quote.total_amount.toLocaleString()}`}
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
            
            {quote.project_address && (
              <>
                <Separator className="my-4" />
                <div>
                  <p className="font-medium mb-2">Project Address</p>
                  <p className="text-sm text-muted-foreground">
                    {[quote.project_address, quote.project_city, quote.project_state, quote.project_zip_code]
                      .filter(Boolean)
                      .join(', ')}
                  </p>
                </div>
              </>
            )}

            {quote.notes && (
              <>
                <Separator className="my-4" />
                <div>
                  <p className="font-medium mb-2">Notes</p>
                  <p className="text-sm text-muted-foreground">{quote.notes}</p>
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
                      <p className="font-bold text-primary">
                        {settings ? displayPrice(item.line_total, settings) : `$${item.line_total.toLocaleString()}`}
                      </p>
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm text-muted-foreground">
                      <div>
                        Quantity: {item.quantity} {item.product.unit_type}
                      </div>
                      <div>
                        Unit Price: {settings ? displayPrice(item.unit_price, settings) : `$${item.unit_price.toLocaleString()}`}
                      </div>
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
        <Card>
          <CardHeader>
            <CardTitle>Add Items to Quote</CardTitle>
          </CardHeader>
          <CardContent>
            <ProductForm 
              onProductSubmit={() => {
                // Refresh the quote data after adding items
                fetchQuoteData();
              }}
              existingQuoteId={quote.id}
            />
          </CardContent>
        </Card>
      </div>
    </div>
  );
}