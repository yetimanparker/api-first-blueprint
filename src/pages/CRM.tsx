import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ArrowLeft, Search, Users, FileText, Phone, Mail, MapPin } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useNavigate } from "react-router-dom";
import { PhoneQuoteDialog } from "@/components/PhoneQuoteDialog";
import { useToast } from "@/hooks/use-toast";

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
  const [statusFilter, setStatusFilter] = useState("all");
  const [sortBy, setSortBy] = useState("recent");
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();
  const { toast } = useToast();

  useEffect(() => {
    fetchCustomers();
  }, []);

  // Filter and sort customers
  useEffect(() => {
    let filtered = customers.filter(customer => {
      const matchesSearch = customer.first_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        customer.last_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        customer.email.toLowerCase().includes(searchTerm.toLowerCase()) ||
        (customer.phone && customer.phone.includes(searchTerm));

      if (statusFilter === "all") return matchesSearch;
      
      const customerQuoteList = customerQuotes[customer.id] || [];
      const hasActiveQuotes = customerQuoteList.some(q => ['pending', 'draft'].includes(q.status));
      const hasAcceptedQuotes = customerQuoteList.some(q => q.status === 'accepted');
      
      switch (statusFilter) {
        case "active": return matchesSearch && hasActiveQuotes;
        case "converted": return matchesSearch && hasAcceptedQuotes;
        case "no_quotes": return matchesSearch && customerQuoteList.length === 0;
        default: return matchesSearch;
      }
    });

    // Sort customers
    filtered.sort((a, b) => {
      switch (sortBy) {
        case "name":
          return `${a.first_name} ${a.last_name}`.localeCompare(`${b.first_name} ${b.last_name}`);
        case "recent":
          return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
        case "quotes":
          const aQuoteCount = customerQuotes[a.id]?.length || 0;
          const bQuoteCount = customerQuotes[b.id]?.length || 0;
          return bQuoteCount - aQuoteCount;
        default:
          return 0;
      }
    });

    setFilteredCustomers(filtered);
  }, [customers, searchTerm, statusFilter, sortBy, customerQuotes]);

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

  const handleQuoteCreated = () => {
    fetchCustomers();
    toast({
      title: "Success",
      description: "Phone quote created successfully",
    });
  };

  const formatAddress = (customer: Customer) => {
    const parts = [customer.address, customer.city, customer.state, customer.zip_code].filter(Boolean);
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
              <Button variant="ghost" size="sm" onClick={() => navigate("/dashboard")} className="mr-4">
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
        {/* Search and Filter */}
        <Card className="mb-6">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Search className="h-5 w-5" />
              Search & Filter
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <Input
              placeholder="Search by name, email, or phone..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <Select value={statusFilter} onValueChange={setStatusFilter}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Customers</SelectItem>
                  <SelectItem value="active">Active Quotes</SelectItem>
                  <SelectItem value="converted">Converted</SelectItem>
                  <SelectItem value="no_quotes">No Quotes</SelectItem>
                </SelectContent>
              </Select>
              <Select value={sortBy} onValueChange={setSortBy}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="recent">Most Recent</SelectItem>
                  <SelectItem value="name">Name A-Z</SelectItem>
                  <SelectItem value="quotes">Quote Count</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </CardContent>
        </Card>

        {/* Customer Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {filteredCustomers.map((customer) => {
            const quotes = customerQuotes[customer.id] || [];
            return (
              <Card 
                key={customer.id} 
                className="hover:shadow-lg transition-shadow cursor-pointer"
                onClick={() => navigate(`/customer/${customer.id}`)}
              >
                <CardHeader>
                  <CardTitle className="text-lg">
                    {customer.first_name} {customer.last_name}
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
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
                    <div className="flex items-center gap-2 text-sm">
                      <MapPin className="h-4 w-4 text-muted-foreground" />
                      <span className="text-muted-foreground">{formatAddress(customer)}</span>
                    </div>
                  </div>
                  {quotes.length > 0 ? (
                    <div className="space-y-2">
                      <h4 className="font-medium text-sm">Recent Quotes ({quotes.length})</h4>
                      {quotes.slice(0, 3).map((quote) => (
                        <div key={quote.id} className="flex items-center justify-between p-2 bg-muted rounded text-sm">
                          <div>
                            <span className="font-medium">{quote.quote_number}</span>
                            <Badge variant={getStatusBadgeVariant(quote.status)} className="ml-2 text-xs">
                              {quote.status}
                            </Badge>
                          </div>
                          <span className="font-medium">${quote.total_amount.toLocaleString()}</span>
                        </div>
                      ))}
                      {quotes.length > 3 && (
                        <p className="text-xs text-muted-foreground">+{quotes.length - 3} more quotes</p>
                      )}
                    </div>
                  ) : (
                    <div className="text-center py-4 text-muted-foreground text-sm">No quotes yet</div>
                  )}
                </CardContent>
              </Card>
            );
          })}
        </div>
      </main>
    </div>
  );
};

export default CRM;