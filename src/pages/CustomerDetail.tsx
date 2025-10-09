import { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { ArrowLeft, Plus, Phone, Mail, MapPin, Edit, Eye, MoreVertical, Ruler } from "lucide-react";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/components/ui/use-toast";
import CustomerNotesSection from "@/components/crm/CustomerNotesSection";
import CustomerTasksSection from "@/components/crm/CustomerTasksSection";
import QuoteDetailView from "@/components/crm/QuoteDetailView";
import { useGlobalSettings } from "@/hooks/useGlobalSettings";
import { PhoneQuoteDialog } from "@/components/PhoneQuoteDialog";

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
  created_at: string;
}

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
}

export default function CustomerDetail() {
  const { customerId } = useParams();
  const navigate = useNavigate();
  const { toast } = useToast();
  const [customer, setCustomer] = useState<Customer | null>(null);
  const [quotes, setQuotes] = useState<Quote[]>([]);
  const [loading, setLoading] = useState(true);
  const [quickViewQuoteId, setQuickViewQuoteId] = useState<string | null>(null);
  const { settings } = useGlobalSettings();

  useEffect(() => {
    if (customerId) {
      fetchCustomerData();
    }
  }, [customerId]);

  const fetchCustomerData = async () => {
    try {
      setLoading(true);
      
      // Fetch customer details
      const { data: customerData, error: customerError } = await supabase
        .from('customers')
        .select('*')
        .eq('id', customerId)
        .single();

      if (customerError) throw customerError;
      setCustomer(customerData);

      // Fetch customer quotes
      const { data: quotesData, error: quotesError } = await supabase
        .from('quotes')
        .select('*')
        .eq('customer_id', customerId)
        .order('created_at', { ascending: false });

      if (quotesError) throw quotesError;
      setQuotes(quotesData || []);

    } catch (error) {
      console.error('Error fetching customer data:', error);
      toast({
        title: "Error",
        description: "Failed to load customer data",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const handleStatusChange = async (quoteId: string, newStatus: string) => {
    try {
      const { error } = await supabase
        .from('quotes')
        .update({ status: newStatus })
        .eq('id', quoteId);

      if (error) throw error;

      // Refresh quotes
      await fetchCustomerData();

      toast({
        title: "Status Updated",
        description: `Quote status changed to ${newStatus}`,
      });
    } catch (error) {
      console.error('Error updating quote status:', error);
      toast({
        title: "Error",
        description: "Failed to update quote status",
        variant: "destructive",
      });
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'accepted': return 'text-green-600 bg-green-50 border-green-200';
      case 'pending': return 'text-yellow-600 bg-yellow-50 border-yellow-200';
      case 'declined': return 'text-red-600 bg-red-50 border-red-200';
      case 'expired': return 'text-gray-600 bg-gray-50 border-gray-200';
      case 'draft': return 'text-blue-600 bg-blue-50 border-blue-200';
      default: return 'text-gray-600 bg-gray-50 border-gray-200';
    }
  };

  const formatAddress = (customer: Customer) => {
    const parts = [customer.address, customer.city, customer.state, customer.zip_code].filter(Boolean);
    return parts.length > 0 ? parts.join(', ') : 'No address on file';
  };

  const quickViewQuote = quotes.find(q => q.id === quickViewQuoteId);

  if (loading) {
    return (
      <div className="min-h-screen bg-background p-6">
        <div className="max-w-7xl mx-auto">
          <div className="flex items-center gap-4 mb-6">
            <Button variant="ghost" onClick={() => navigate('/crm')}>
              <ArrowLeft className="h-4 w-4 mr-2" />
              Back to CRM
            </Button>
          </div>
          <div className="text-center py-8">Loading customer details...</div>
        </div>
      </div>
    );
  }

  if (!customer) {
    return (
      <div className="min-h-screen bg-background p-6">
        <div className="max-w-7xl mx-auto">
          <div className="flex items-center gap-4 mb-6">
            <Button variant="ghost" onClick={() => navigate('/crm')}>
              <ArrowLeft className="h-4 w-4 mr-2" />
              Back to CRM
            </Button>
          </div>
          <div className="text-center py-8">Customer not found</div>
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
              <h1 className="text-3xl font-bold">{customer.first_name} {customer.last_name}</h1>
              <p className="text-muted-foreground">Customer since {new Date(customer.created_at).toLocaleDateString()}</p>
            </div>
          </div>
        </div>

        {/* Customer Overview Card */}
        <Card className="mb-6">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              Contact Information
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <div className="flex items-center gap-3">
                <Mail className="h-5 w-5 text-primary" />
                <div>
                  <p className="font-medium">Email</p>
                  <p className="text-sm text-muted-foreground">{customer.email}</p>
                </div>
              </div>
              <div className="flex items-center gap-3">
                <Phone className="h-5 w-5 text-primary" />
                <div>
                  <p className="font-medium">Phone</p>
                  <p className="text-sm text-muted-foreground">{customer.phone || 'Not provided'}</p>
                </div>
              </div>
              <div className="flex items-center gap-3">
                <MapPin className="h-5 w-5 text-primary" />
                <div>
                  <p className="font-medium">Address</p>
                  <p className="text-sm text-muted-foreground">{formatAddress(customer)}</p>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Tabs Section */}
        <Tabs defaultValue="quotes" className="space-y-6">
          <TabsList>
            <TabsTrigger value="quotes">Quotes ({quotes.length})</TabsTrigger>
            <TabsTrigger value="notes">Notes</TabsTrigger>
            <TabsTrigger value="tasks">Tasks</TabsTrigger>
          </TabsList>

          <TabsContent value="quotes" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center justify-between flex-wrap gap-2">
                  <span>Quotes</span>
                  <div className="flex gap-2">
                    <PhoneQuoteDialog 
                      customerId={customer.id}
                      onQuoteCreated={(quoteId) => {
                        fetchCustomerData();
                        navigate(`/quote/edit/${quoteId}`);
                      }}
                      prefilledCustomer={{
                        first_name: customer.first_name,
                        last_name: customer.last_name,
                        email: customer.email,
                        phone: customer.phone,
                        address: customer.address,
                        city: customer.city,
                        state: customer.state,
                        zip_code: customer.zip_code,
                      }}
                    />
                  </div>
                </CardTitle>
              </CardHeader>
              <CardContent>
                {quotes.length === 0 ? (
                  <div className="text-center py-8 text-muted-foreground">
                    No quotes found for this customer
                  </div>
                ) : (
                  <div className="space-y-4">
                    {quotes.map((quote) => (
                      <div key={quote.id} className="border rounded-lg p-3 md:p-4 hover:shadow-md transition-shadow">
                        <div className="flex items-start justify-between gap-2 mb-3">
                          <div className="flex flex-col sm:flex-row sm:items-center gap-2 min-w-0 flex-1">
                            <h3 className="font-semibold text-base md:text-lg truncate">{quote.quote_number}</h3>
                            <Select
                              value={quote.status}
                              onValueChange={(value) => handleStatusChange(quote.id, value)}
                            >
                              <SelectTrigger className={`w-28 sm:w-32 h-7 text-xs font-medium border ${getStatusColor(quote.status)}`}>
                                <SelectValue />
                              </SelectTrigger>
                              <SelectContent className="z-50 bg-background">
                                <SelectItem value="draft">Draft</SelectItem>
                                <SelectItem value="pending">Pending</SelectItem>
                                <SelectItem value="accepted">Accepted</SelectItem>
                                <SelectItem value="declined">Declined</SelectItem>
                                <SelectItem value="expired">Expired</SelectItem>
                              </SelectContent>
                            </Select>
                          </div>
                          
                          {/* Mobile: Dropdown Menu */}
                          <div className="md:hidden shrink-0">
                            <DropdownMenu>
                              <DropdownMenuTrigger asChild>
                                <Button size="sm" variant="outline" className="h-8 w-8 p-0">
                                  <MoreVertical className="h-4 w-4" />
                                </Button>
                              </DropdownMenuTrigger>
                              <DropdownMenuContent align="end" className="z-50 bg-background">
                                <DropdownMenuItem onClick={() => setQuickViewQuoteId(quote.id)}>
                                  <Eye className="h-4 w-4 mr-2" />
                                  Quick View
                                </DropdownMenuItem>
                                <DropdownMenuItem onClick={() => navigate(`/quote/edit/${quote.id}`)}>
                                  <Edit className="h-4 w-4 mr-2" />
                                  Edit Quote
                                </DropdownMenuItem>
                              </DropdownMenuContent>
                            </DropdownMenu>
                          </div>
                          
                          {/* Desktop: Full Buttons */}
                          <div className="hidden md:flex items-center gap-2 shrink-0">
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => setQuickViewQuoteId(quote.id)}
                            >
                              <Eye className="h-4 w-4 mr-2" />
                              Quick View
                            </Button>
                            <Button
                              size="sm"
                              onClick={() => navigate(`/quote/edit/${quote.id}`)}
                            >
                              <Edit className="h-4 w-4 mr-2" />
                              Edit Quote
                            </Button>
                          </div>
                        </div>
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-3 text-sm">
                          <div>
                            <span className="text-muted-foreground">Amount: </span>
                            <span className="font-semibold">${quote.total_amount.toLocaleString()}</span>
                          </div>
                          <div>
                            <span className="text-muted-foreground">Created: </span>
                            <span>{new Date(quote.created_at).toLocaleDateString()}</span>
                          </div>
                          <div className="min-w-0">
                            <span className="text-muted-foreground">Project: </span>
                            <span className="block truncate">{quote.project_address ? `${quote.project_address}, ${quote.project_state}` : 'Not specified'}</span>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="notes">
            <CustomerNotesSection customerId={customer.id} />
          </TabsContent>

          <TabsContent value="tasks">
            <CustomerTasksSection customerId={customer.id} />
          </TabsContent>
        </Tabs>

        {/* Quick View Sheet */}
        <Sheet open={!!quickViewQuoteId} onOpenChange={(open) => !open && setQuickViewQuoteId(null)}>
          <SheetContent side="right" className="w-full sm:max-w-3xl overflow-y-auto">
            <SheetHeader>
              <SheetTitle>Quote Details: {quickViewQuote?.quote_number}</SheetTitle>
              <SheetDescription>
                View complete quote information, measurements, and pricing breakdown
              </SheetDescription>
            </SheetHeader>
            <div className="mt-6">
              {quickViewQuote && settings && (
                <QuoteDetailView quote={quickViewQuote} settings={settings} />
              )}
            </div>
          </SheetContent>
        </Sheet>
      </div>
    </div>
  );
}