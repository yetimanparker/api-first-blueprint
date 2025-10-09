import { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { ArrowLeft, Plus, Phone, Mail, MapPin, Calendar, Edit, Eye, ChevronDown, ChevronUp } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/components/ui/use-toast";
import CustomerNotesSection from "@/components/crm/CustomerNotesSection";
import CustomerTasksSection from "@/components/crm/CustomerTasksSection";
import QuoteDetailView from "@/components/crm/QuoteDetailView";
import { useGlobalSettings } from "@/hooks/useGlobalSettings";

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
  const [expandedQuoteId, setExpandedQuoteId] = useState<string | null>(null);
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

  const getStatusBadgeVariant = (status: string) => {
    switch (status) {
      case 'accepted': return 'default';
      case 'pending': return 'secondary';
      case 'declined': return 'destructive';
      case 'expired': return 'outline';
      default: return 'secondary';
    }
  };

  const formatAddress = (customer: Customer) => {
    const parts = [customer.address, customer.city, customer.state, customer.zip_code].filter(Boolean);
    return parts.length > 0 ? parts.join(', ') : 'No address on file';
  };

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
                <CardTitle className="flex items-center justify-between">
                  Quotes
                  <Button onClick={() => navigate('/crm')}>
                    <Plus className="h-4 w-4 mr-2" />
                    New Quote
                  </Button>
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
                      <div key={quote.id} className="border rounded-lg">
                        <div className="p-4">
                          <div className="flex items-center justify-between mb-2">
                            <div className="flex items-center gap-3">
                              <h3 className="font-medium">{quote.quote_number}</h3>
                              <Badge variant={getStatusBadgeVariant(quote.status)}>
                                {quote.status}
                              </Badge>
                            </div>
                            <div className="flex items-center gap-2">
                              <Button
                                size="sm"
                                variant="ghost"
                                onClick={() => setExpandedQuoteId(expandedQuoteId === quote.id ? null : quote.id)}
                              >
                                {expandedQuoteId === quote.id ? (
                                  <>
                                    <ChevronUp className="h-4 w-4 mr-2" />
                                    Hide Details
                                  </>
                                ) : (
                                  <>
                                    <ChevronDown className="h-4 w-4 mr-2" />
                                    Show Details
                                  </>
                                )}
                              </Button>
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() => navigate(`/quote/${quote.id}`)}
                              >
                                <Eye className="h-4 w-4 mr-2" />
                                View
                              </Button>
                              <Button
                                size="sm"
                                onClick={() => navigate(`/quote/edit/${quote.id}`)}
                              >
                                <Edit className="h-4 w-4 mr-2" />
                                Edit
                              </Button>
                            </div>
                          </div>
                          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm">
                            <div>
                              <span className="text-muted-foreground">Amount: </span>
                              <span className="font-medium">${quote.total_amount.toLocaleString()}</span>
                            </div>
                            <div>
                              <span className="text-muted-foreground">Created: </span>
                              <span>{new Date(quote.created_at).toLocaleDateString()}</span>
                            </div>
                            <div>
                              <span className="text-muted-foreground">Project: </span>
                              <span>{quote.project_address || 'Not specified'}</span>
                            </div>
                          </div>
                        </div>

                        {/* Expanded Quote Details */}
                        {expandedQuoteId === quote.id && settings && (
                          <div className="border-t bg-muted/30 p-4">
                            <QuoteDetailView quote={quote} settings={settings} />
                          </div>
                        )}
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
      </div>
    </div>
  );
}