import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { PhoneQuoteDialog } from "@/components/PhoneQuoteDialog";
import { ArrowLeft, Search, Users, Mail, Phone, MapPin, Calendar, FileText } from "lucide-react";

interface Customer {
  id: string;
  first_name: string;
  last_name: string;
  email: string;
  phone: string | null;
  address: string | null;
  city: string | null;
  state: string | null;
  zip_code: string | null;
  created_at: string;
}

interface Quote {
  id: string;
  quote_number: string;
  status: string;
  total_amount: number;
  created_at: string;
}

const CRM = () => {
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [filteredCustomers, setFilteredCustomers] = useState<Customer[]>([]);
  const [customerQuotes, setCustomerQuotes] = useState<Record<string, Quote[]>>({});
  const [searchTerm, setSearchTerm] = useState("");
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();
  const { toast } = useToast();

  useEffect(() => {
    fetchCustomers();
  }, []);

  useEffect(() => {
    // Filter customers based on search term
    const filtered = customers.filter(customer => 
      `${customer.first_name} ${customer.last_name}`.toLowerCase().includes(searchTerm.toLowerCase()) ||
      customer.email.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (customer.phone && customer.phone.includes(searchTerm))
    );
    setFilteredCustomers(filtered);
  }, [customers, searchTerm]);

  const fetchCustomers = async () => {
    try {
      const { data: customersData, error: customersError } = await supabase
        .from("customers")
        .select("*")
        .order("created_at", { ascending: false });

      if (customersError) throw customersError;

      setCustomers(customersData || []);

      // Fetch quotes for each customer
      if (customersData && customersData.length > 0) {
        const { data: quotesData, error: quotesError } = await supabase
          .from("quotes")
          .select("id, quote_number, status, total_amount, created_at, customer_id")
          .in("customer_id", customersData.map(c => c.id));

        if (quotesError) throw quotesError;

        // Group quotes by customer ID
        const quotesByCustomer: Record<string, Quote[]> = {};
        quotesData?.forEach(quote => {
          if (!quotesByCustomer[quote.customer_id]) {
            quotesByCustomer[quote.customer_id] = [];
          }
          quotesByCustomer[quote.customer_id].push(quote);
        });

        setCustomerQuotes(quotesByCustomer);
      }
    } catch (error: any) {
      toast({
        title: "Error",
        description: "Failed to load customers",
        variant: "destructive",
      });
      console.error("Error fetching customers:", error);
    } finally {
      setLoading(false);
    }
  };

  const handleQuoteCreated = (quoteId: string) => {
    // Refresh customers and quotes after a new quote is created
    fetchCustomers();
    toast({
      title: "Success",
      description: "Phone quote created successfully",
    });
  };

  const formatAddress = (customer: Customer) => {
    const parts = [
      customer.address,
      customer.city,
      customer.state,
      customer.zip_code
    ].filter(Boolean);
    return parts.length > 0 ? parts.join(", ") : "No address provided";
  };

  const getStatusBadgeVariant = (status: string) => {
    switch (status) {
      case "accepted": return "default";
      case "pending": return "secondary";
      case "draft": return "outline";
      default: return "secondary";
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center">
          <Users className="h-8 w-8 text-primary animate-pulse mx-auto mb-4" />
          <p className="text-muted-foreground">Loading customers...</p>
        </div>
      </div>
    );
  }

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
                <h1 className="text-xl font-semibold text-foreground">Customer CRM</h1>
                <p className="text-sm text-muted-foreground">Manage customers and quotes</p>
              </div>
            </div>
            <PhoneQuoteDialog onQuoteCreated={handleQuoteCreated} />
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Search and Stats */}
        <div className="mb-8">
          <div className="flex flex-col sm:flex-row gap-4 items-start sm:items-center justify-between">
            <div className="relative flex-1 max-w-md">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground h-4 w-4" />
              <Input
                placeholder="Search customers..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-10"
              />
            </div>
            <div className="flex gap-4">
              <div className="text-center">
                <div className="text-2xl font-bold text-foreground">{customers.length}</div>
                <div className="text-sm text-muted-foreground">Total Customers</div>
              </div>
              <div className="text-center">
                <div className="text-2xl font-bold text-foreground">
                  {Object.values(customerQuotes).flat().length}
                </div>
                <div className="text-sm text-muted-foreground">Total Quotes</div>
              </div>
            </div>
          </div>
        </div>

        {/* Customer List */}
        {filteredCustomers.length === 0 ? (
          <Card className="text-center py-12">
            <CardContent>
              <Users className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
              <CardTitle className="mb-2">
                {customers.length === 0 ? "No customers yet" : "No customers found"}
              </CardTitle>
              <CardDescription className="mb-4">
                {customers.length === 0 
                  ? "Create your first phone quote to add customers to your CRM"
                  : "Try adjusting your search terms"
                }
              </CardDescription>
              {customers.length === 0 && (
                <PhoneQuoteDialog onQuoteCreated={handleQuoteCreated} />
              )}
            </CardContent>
          </Card>
        ) : (
          <div className="grid gap-6">
            {filteredCustomers.map((customer) => {
              const quotes = customerQuotes[customer.id] || [];
              return (
                <Card key={customer.id}>
                  <CardHeader>
                    <div className="flex justify-between items-start">
                      <div>
                        <CardTitle className="flex items-center gap-2">
                          {customer.first_name} {customer.last_name}
                          <Badge variant="outline">
                            {quotes.length} quote{quotes.length !== 1 ? "s" : ""}
                          </Badge>
                        </CardTitle>
                        <CardDescription>
                          Customer since {new Date(customer.created_at).toLocaleDateString()}
                        </CardDescription>
                      </div>
                    </div>
                  </CardHeader>
                  <CardContent>
                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                      {/* Contact Information */}
                      <div className="space-y-3">
                        <h4 className="font-medium text-foreground">Contact Information</h4>
                        <div className="space-y-2">
                          <div className="flex items-center gap-2 text-sm">
                            <Mail className="h-4 w-4 text-muted-foreground" />
                            <span>{customer.email}</span>
                          </div>
                          {customer.phone && (
                            <div className="flex items-center gap-2 text-sm">
                              <Phone className="h-4 w-4 text-muted-foreground" />
                              <span>{customer.phone}</span>
                            </div>
                          )}
                          <div className="flex items-start gap-2 text-sm">
                            <MapPin className="h-4 w-4 text-muted-foreground mt-0.5" />
                            <span>{formatAddress(customer)}</span>
                          </div>
                        </div>
                      </div>

                      {/* Quotes */}
                      <div className="space-y-3">
                        <h4 className="font-medium text-foreground flex items-center gap-2">
                          <FileText className="h-4 w-4" />
                          Recent Quotes
                        </h4>
                        {quotes.length === 0 ? (
                          <p className="text-sm text-muted-foreground">No quotes yet</p>
                        ) : (
                          <div className="space-y-2">
                            {quotes.slice(0, 3).map((quote) => (
                              <div key={quote.id} className="flex items-center justify-between p-2 border rounded-md">
                                <div className="flex items-center gap-2">
                                  <span className="text-sm font-medium">{quote.quote_number}</span>
                                  <Badge variant={getStatusBadgeVariant(quote.status)}>
                                    {quote.status}
                                  </Badge>
                                </div>
                                <div className="text-right">
                                  <div className="text-sm font-medium">
                                    ${quote.total_amount.toLocaleString()}
                                  </div>
                                  <div className="text-xs text-muted-foreground">
                                    {new Date(quote.created_at).toLocaleDateString()}
                                  </div>
                                </div>
                              </div>
                            ))}
                            {quotes.length > 3 && (
                              <p className="text-xs text-muted-foreground">
                                and {quotes.length - 3} more quote{quotes.length - 3 !== 1 ? "s" : ""}
                              </p>
                            )}
                          </div>
                        )}
                      </div>
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        )}
      </main>
    </div>
  );
};

export default CRM;