import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ArrowLeft, Search, Users, FileText, Phone, Mail, MapPin, MoreHorizontal, Edit, Plus, ArrowUpDown, Eye } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useNavigate, useSearchParams } from "react-router-dom";
import { NewQuoteDialog } from "@/components/NewQuoteDialog";
import { CustomerDialog } from "@/components/CustomerDialog";
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
  status: 'lead' | 'contacted' | 'quoted' | 'negotiating' | 'converted' | 'lost' | 'inactive';
  lead_source: string | null;
  last_activity_at: string;
  created_at: string;
}

interface Quote {
  id: string;
  quote_number: string;
  status: string;
  total_amount: number;
  created_at: string;
  first_viewed_at: string | null;
  customer_id: string;
}

interface QuoteWithCustomer extends Quote {
  customer?: {
    first_name: string;
    last_name: string;
    email: string;
    phone: string | null;
  };
}

const CRM = () => {
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [filteredCustomers, setFilteredCustomers] = useState<Customer[]>([]);
  const [customerQuotes, setCustomerQuotes] = useState<Record<string, Quote[]>>({});
  const [allQuotes, setAllQuotes] = useState<QuoteWithCustomer[]>([]);
  const [filteredQuotes, setFilteredQuotes] = useState<QuoteWithCustomer[]>([]);
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [sortBy, setSortBy] = useState("recent");
  const [quoteSearchTerm, setQuoteSearchTerm] = useState("");
  const [quoteStatusFilter, setQuoteStatusFilter] = useState("all");
  const [quoteSortBy, setQuoteSortBy] = useState("unseen_first");
  const [activeTab, setActiveTab] = useState("customers");
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();
  const { toast } = useToast();
  const [searchParams] = useSearchParams();

  useEffect(() => {
    fetchCustomers();
    fetchAllQuotes();
    // Check for URL filter parameter
    const filterParam = searchParams.get('filter');
    if (filterParam === 'unviewed') {
      setActiveTab('quotes');
      setQuoteStatusFilter('unviewed');
    }
  }, [searchParams]);

  // Filter and sort customers
  useEffect(() => {
    let filtered = customers.filter(customer => {
      const matchesSearch = customer.first_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        customer.last_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        customer.email.toLowerCase().includes(searchTerm.toLowerCase()) ||
        (customer.phone && customer.phone.includes(searchTerm));

      if (statusFilter === "all") return matchesSearch;
      
      // Enhanced filtering with customer status
      const customerQuoteList = customerQuotes[customer.id] || [];
      
      switch (statusFilter) {
        case "lead": return matchesSearch && customer.status === 'lead';
        case "contacted": return matchesSearch && customer.status === 'contacted';
        case "quoted": return matchesSearch && customer.status === 'quoted';
        case "converted": return matchesSearch && customer.status === 'converted';
        case "lost": return matchesSearch && customer.status === 'lost';
        case "active": 
          const hasActiveQuotes = customerQuoteList.some(q => ['pending', 'draft'].includes(q.status));
          return matchesSearch && hasActiveQuotes;
        case "no_quotes": return matchesSearch && customerQuoteList.length === 0;
        case "unviewed":
          const hasUnviewedQuotes = customerQuoteList.some(q => q.first_viewed_at === null);
          return matchesSearch && hasUnviewedQuotes;
        default: return matchesSearch;
      }
    });

    // Sort customers
    filtered.sort((a, b) => {
      switch (sortBy) {
        case "name":
          return `${a.first_name} ${a.last_name}`.localeCompare(`${b.first_name} ${b.last_name}`);
        case "recent":
          return new Date(b.last_activity_at).getTime() - new Date(a.last_activity_at).getTime();
        case "status":
          return a.status.localeCompare(b.status);
        case "quotes":
          const aQuoteCount = customerQuotes[a.id]?.length || 0;
          const bQuoteCount = customerQuotes[b.id]?.length || 0;
          return bQuoteCount - aQuoteCount;
        case "quote_value":
          const aQuoteTotal = customerQuotes[a.id]?.reduce((sum, q) => sum + q.total_amount, 0) || 0;
          const bQuoteTotal = customerQuotes[b.id]?.reduce((sum, q) => sum + q.total_amount, 0) || 0;
          return bQuoteTotal - aQuoteTotal;
        default:
          return 0;
      }
    });

    setFilteredCustomers(filtered);
  }, [customers, searchTerm, statusFilter, sortBy, customerQuotes]);

  // Filter and sort quotes
  useEffect(() => {
    let filtered = allQuotes.filter(quote => {
      const customerName = quote.customer 
        ? `${quote.customer.first_name} ${quote.customer.last_name}`.toLowerCase()
        : '';
      const matchesSearch = 
        quote.quote_number.toLowerCase().includes(quoteSearchTerm.toLowerCase()) ||
        customerName.includes(quoteSearchTerm.toLowerCase()) ||
        (quote.customer?.email && quote.customer.email.toLowerCase().includes(quoteSearchTerm.toLowerCase()));

      if (quoteStatusFilter === "all") return matchesSearch;
      if (quoteStatusFilter === "unviewed") return matchesSearch && quote.first_viewed_at === null;
      return matchesSearch && quote.status === quoteStatusFilter;
    });

    // Sort quotes
    filtered.sort((a, b) => {
      switch (quoteSortBy) {
        case "unseen_first":
          // Unseen quotes first (null first_viewed_at)
          if (a.first_viewed_at === null && b.first_viewed_at !== null) return -1;
          if (a.first_viewed_at !== null && b.first_viewed_at === null) return 1;
          // Then by most recent
          return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
        case "recent":
          return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
        case "oldest":
          return new Date(a.created_at).getTime() - new Date(b.created_at).getTime();
        case "amount_high":
          return b.total_amount - a.total_amount;
        case "amount_low":
          return a.total_amount - b.total_amount;
        case "customer":
          const aName = a.customer ? `${a.customer.first_name} ${a.customer.last_name}` : '';
          const bName = b.customer ? `${b.customer.first_name} ${b.customer.last_name}` : '';
          return aName.localeCompare(bName);
        default:
          return 0;
      }
    });

    setFilteredQuotes(filtered);
  }, [allQuotes, quoteSearchTerm, quoteStatusFilter, quoteSortBy]);

  const fetchCustomers = async () => {
    try {
      const { data: customersData, error: customersError } = await supabase
        .from("customers")
        .select("*")
        .order("last_activity_at", { ascending: false });

      if (customersError) throw customersError;

      // Cast the status field to proper type
      const typedCustomers = (customersData || []).map(customer => ({
        ...customer,
        status: customer.status as Customer['status']
      }));

      setCustomers(typedCustomers);

      // Fetch quotes for each customer
      if (customersData && customersData.length > 0) {
        const { data: quotesData, error: quotesError } = await supabase
          .from("quotes")
          .select("id, quote_number, status, total_amount, created_at, customer_id, first_viewed_at")
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

  const fetchAllQuotes = async () => {
    try {
      const { data: quotesData, error } = await supabase
        .from("quotes")
        .select(`
          id,
          quote_number,
          status,
          total_amount,
          created_at,
          first_viewed_at,
          customer_id,
          customers (
            first_name,
            last_name,
            email,
            phone
          )
        `)
        .order("created_at", { ascending: false });

      if (error) throw error;

      const quotesWithCustomer = (quotesData || []).map(quote => ({
        ...quote,
        customer: Array.isArray(quote.customers) ? quote.customers[0] : quote.customers
      }));

      setAllQuotes(quotesWithCustomer);
    } catch (error: any) {
      toast({
        title: "Error",
        description: "Failed to load quotes",
        variant: "destructive",
      });
      console.error("Error fetching quotes:", error);
    }
  };

  const updateCustomerStatus = async (customerId: string, newStatus: Customer['status']) => {
    try {
      const { error } = await supabase
        .from("customers")
        .update({ status: newStatus })
        .eq("id", customerId);

      if (error) throw error;

      // Update local state
      setCustomers(prev => 
        prev.map(customer => 
          customer.id === customerId 
            ? { ...customer, status: newStatus, last_activity_at: new Date().toISOString() }
            : customer
        )
      );

      toast({
        title: "Success",
        description: "Customer status updated",
      });
    } catch (error: any) {
      toast({
        title: "Error",
        description: "Failed to update customer status",
        variant: "destructive",
      });
      console.error("Error updating customer status:", error);
    }
  };

  const toggleQuoteViewedStatus = async (quoteId: string, currentStatus: string | null) => {
    try {
      const newStatus = currentStatus === null ? new Date().toISOString() : null;
      
      const { error } = await supabase
        .from('quotes')
        .update({ first_viewed_at: newStatus })
        .eq('id', quoteId);

      if (error) throw error;

      await fetchAllQuotes();
      
      toast({
        title: "Status Updated",
        description: newStatus === null ? "Quote marked as unseen" : "Quote marked as seen",
      });
    } catch (error) {
      console.error('Error toggling quote status:', error);
      toast({
        title: "Error",
        description: "Failed to update quote status",
        variant: "destructive",
      });
    }
  };

  const handleQuoteCreated = () => {
    fetchCustomers();
    fetchAllQuotes();
    toast({
      title: "Success",
      description: "Phone quote created successfully",
    });
  };

  const getStatusBadgeVariant = (status: string) => {
    switch (status) {
      case "converted": return "default";
      case "quoted": case "negotiating": return "secondary";
      case "lead": case "contacted": return "outline";
      case "lost": case "inactive": return "destructive";
      default: return "secondary";
    }
  };

  const getCustomerStatusVariant = (status: Customer['status']) => {
    switch (status) {
      case "converted": return "default";
      case "quoted": case "negotiating": return "secondary";
      case "lead": case "contacted": return "outline";
      case "lost": case "inactive": return "destructive";
      default: return "secondary";
    }
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
    }).format(amount);
  };

  const formatDate = (date: string) => {
    return new Date(date).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric'
    });
  };

  const getLatestQuote = (quotes: Quote[]) => {
    if (!quotes || quotes.length === 0) return null;
    return quotes.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())[0];
  };

  const getTotalQuoteValue = (quotes: Quote[]) => {
    return quotes?.reduce((sum, quote) => sum + quote.total_amount, 0) || 0;
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
                <h1 className="text-xl font-semibold text-foreground">CRM</h1>
                <p className="text-sm text-muted-foreground hidden md:block">Manage customers and quotes</p>
              </div>
            </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Action Buttons */}
        <div className="flex gap-3 mb-6">
          <CustomerDialog />
          <NewQuoteDialog onQuoteCreated={handleQuoteCreated} />
        </div>

        <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
          <TabsList className="grid w-full max-w-md grid-cols-2">
            <TabsTrigger value="customers" className="flex items-center gap-2">
              <Users className="h-4 w-4" />
              Customers
            </TabsTrigger>
            <TabsTrigger value="quotes" className="flex items-center gap-2">
              <FileText className="h-4 w-4" />
              All Quotes
            </TabsTrigger>
          </TabsList>

          {/* Customers Tab */}
          <TabsContent value="customers" className="space-y-6">
            {/* Search and Filter */}
            <Card>
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
                      <SelectItem value="unviewed">Unviewed Quotes</SelectItem>
                      <SelectItem value="lead">Leads</SelectItem>
                      <SelectItem value="contacted">Contacted</SelectItem>
                      <SelectItem value="quoted">Quoted</SelectItem>
                      <SelectItem value="negotiating">Negotiating</SelectItem>
                      <SelectItem value="converted">Converted</SelectItem>
                      <SelectItem value="lost">Lost</SelectItem>
                      <SelectItem value="active">Active Quotes</SelectItem>
                      <SelectItem value="no_quotes">No Quotes</SelectItem>
                    </SelectContent>
                  </Select>
                  <Select value={sortBy} onValueChange={setSortBy}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="recent">Recent Activity</SelectItem>
                      <SelectItem value="name">Name A-Z</SelectItem>
                      <SelectItem value="status">Status</SelectItem>
                      <SelectItem value="quotes">Quote Count</SelectItem>
                      <SelectItem value="quote_value">Quote Value</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </CardContent>
            </Card>

            {/* Customer Table */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center justify-between">
                  <span className="flex items-center gap-2">
                    <Users className="h-5 w-5" />
                    Customers ({filteredCustomers.length})
                  </span>
                </CardTitle>
              </CardHeader>
              <CardContent className="p-0">
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Customer</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="hidden sm:table-cell">Contact</TableHead>
                    <TableHead className="hidden md:table-cell">Quote Total</TableHead>
                    <TableHead className="hidden lg:table-cell">Latest Quote</TableHead>
                    <TableHead className="hidden lg:table-cell">Last Activity</TableHead>
                    <TableHead className="w-[50px]">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredCustomers.map((customer) => {
                    const quotes = customerQuotes[customer.id] || [];
                    const latestQuote = getLatestQuote(quotes);
                    const totalValue = getTotalQuoteValue(quotes);
                    
                    return (
                      <TableRow 
                        key={customer.id}
                        className="cursor-pointer hover:bg-muted/50"
                        onClick={() => navigate(`/customer/${customer.id}`)}
                      >
                        <TableCell>
                          <div className="flex flex-col">
                            <div className="font-medium">
                              {customer.first_name} {customer.last_name}
                            </div>
                            {/* Mobile: Show contact info below name */}
                            <div className="sm:hidden text-sm text-muted-foreground space-y-1 mt-1">
                              <div className="flex items-center gap-1">
                                <Mail className="h-3 w-3" />
                                {customer.email}
                              </div>
                              {customer.phone && (
                                <div className="flex items-center gap-1">
                                  <Phone className="h-3 w-3" />
                                  {customer.phone}
                                </div>
                              )}
                            </div>
                            {/* Mobile: Show quote info below contact */}
                            <div className="md:hidden text-sm text-muted-foreground mt-2 space-y-1">
                              {totalValue > 0 && (
                                <div>Total: {formatCurrency(totalValue)}</div>
                              )}
                              {latestQuote && (
                                <div className="flex items-center gap-2">
                                  <span>{latestQuote.quote_number}</span>
                                  <Badge variant={getStatusBadgeVariant(latestQuote.status)} className="text-xs">
                                    {latestQuote.status}
                                  </Badge>
                                </div>
                              )}
                            </div>
                          </div>
                        </TableCell>
                        <TableCell>
                          <Select
                            value={customer.status}
                            onValueChange={(value) => updateCustomerStatus(customer.id, value as Customer['status'])}
                          >
                            <SelectTrigger 
                              className="w-auto border-none p-0 h-auto"
                              onClick={(e) => e.stopPropagation()}
                            >
                              <Badge variant={getCustomerStatusVariant(customer.status)} className="cursor-pointer">
                                {customer.status}
                              </Badge>
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="lead">Lead</SelectItem>
                              <SelectItem value="contacted">Contacted</SelectItem>
                              <SelectItem value="quoted">Quoted</SelectItem>
                              <SelectItem value="negotiating">Negotiating</SelectItem>
                              <SelectItem value="converted">Converted</SelectItem>
                              <SelectItem value="lost">Lost</SelectItem>
                              <SelectItem value="inactive">Inactive</SelectItem>
                            </SelectContent>
                          </Select>
                        </TableCell>
                        <TableCell className="hidden sm:table-cell">
                          <div className="space-y-1 text-sm">
                            <div className="flex items-center gap-1">
                              <Mail className="h-3 w-3 text-muted-foreground" />
                              {customer.email}
                            </div>
                            {customer.phone && (
                              <div className="flex items-center gap-1">
                                <Phone className="h-3 w-3 text-muted-foreground" />
                                {customer.phone}
                              </div>
                            )}
                          </div>
                        </TableCell>
                        <TableCell className="hidden md:table-cell">
                          <div className="text-sm">
                            {totalValue > 0 ? (
                              <div>
                                <div className="font-medium">{formatCurrency(totalValue)}</div>
                                <div className="text-muted-foreground">{quotes.length} quote{quotes.length !== 1 ? 's' : ''}</div>
                              </div>
                            ) : (
                              <span className="text-muted-foreground">No quotes</span>
                            )}
                          </div>
                        </TableCell>
                        <TableCell className="hidden lg:table-cell">
                          {latestQuote ? (
                            <div className="text-sm">
                              <div className="flex items-center gap-2 mb-1">
                                <span className="font-medium">{latestQuote.quote_number}</span>
                                <Badge variant={getStatusBadgeVariant(latestQuote.status)} className="text-xs">
                                  {latestQuote.status}
                                </Badge>
                              </div>
                              <div className="text-muted-foreground">
                                {formatDate(latestQuote.created_at)}
                              </div>
                            </div>
                          ) : (
                            <span className="text-muted-foreground text-sm">No quotes</span>
                          )}
                        </TableCell>
                        <TableCell className="hidden lg:table-cell">
                          <div className="text-sm text-muted-foreground">
                            {formatDate(customer.last_activity_at)}
                          </div>
                        </TableCell>
                        <TableCell>
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild onClick={(e) => e.stopPropagation()}>
                              <Button variant="ghost" size="sm" className="h-8 w-8 p-0">
                                <MoreHorizontal className="h-4 w-4" />
                              </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end">
                              <DropdownMenuItem onClick={(e) => {
                                e.stopPropagation();
                                navigate(`/customer/${customer.id}`);
                              }}>
                                <Users className="h-4 w-4 mr-2" />
                                View Details
                              </DropdownMenuItem>
                              {latestQuote && (
                                <DropdownMenuItem onClick={(e) => {
                                  e.stopPropagation();
                                  navigate(`/quote/edit/${latestQuote.id}`);
                                }}>
                                  <Edit className="h-4 w-4 mr-2" />
                                  View/Edit
                                </DropdownMenuItem>
                              )}
                              <DropdownMenuItem onClick={(e) => {
                                e.stopPropagation();
                                // Navigate to create quote - this would need to be implemented
                                navigate(`/customer/${customer.id}`);
                              }}>
                                <Plus className="h-4 w-4 mr-2" />
                                Create Quote
                              </DropdownMenuItem>
                            </DropdownMenuContent>
                          </DropdownMenu>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
              {filteredCustomers.length === 0 && (
                <div className="text-center py-8 text-muted-foreground">
                  <Users className="h-8 w-8 mx-auto mb-4 opacity-50" />
                  <p>No customers found</p>
                </div>
              )}
            </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Quotes Tab */}
          <TabsContent value="quotes" className="space-y-6">
            {/* Search and Filter for Quotes */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Search className="h-5 w-5" />
                  Search & Filter Quotes
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <Input
                  placeholder="Search by quote number, customer name, or email..."
                  value={quoteSearchTerm}
                  onChange={(e) => setQuoteSearchTerm(e.target.value)}
                />
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <Select value={quoteStatusFilter} onValueChange={setQuoteStatusFilter}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All Quotes</SelectItem>
                      <SelectItem value="unviewed">Unviewed</SelectItem>
                      <SelectItem value="draft">Draft</SelectItem>
                      <SelectItem value="pending">Pending</SelectItem>
                      <SelectItem value="accepted">Accepted</SelectItem>
                      <SelectItem value="rejected">Rejected</SelectItem>
                      <SelectItem value="expired">Expired</SelectItem>
                    </SelectContent>
                  </Select>
                  <Select value={quoteSortBy} onValueChange={setQuoteSortBy}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="unseen_first">Unseen First</SelectItem>
                      <SelectItem value="recent">Most Recent</SelectItem>
                      <SelectItem value="oldest">Oldest First</SelectItem>
                      <SelectItem value="amount_high">Highest Amount</SelectItem>
                      <SelectItem value="amount_low">Lowest Amount</SelectItem>
                      <SelectItem value="customer">Customer A-Z</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </CardContent>
            </Card>

            {/* Quotes Table */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center justify-between">
                  <span className="flex items-center gap-2">
                    <FileText className="h-5 w-5" />
                    All Quotes ({filteredQuotes.length})
                  </span>
                </CardTitle>
              </CardHeader>
              <CardContent className="p-0">
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Quote</TableHead>
                        <TableHead>Customer</TableHead>
                        <TableHead className="hidden sm:table-cell">Status</TableHead>
                        <TableHead className="hidden md:table-cell">Amount</TableHead>
                        <TableHead className="hidden lg:table-cell">Created</TableHead>
                        <TableHead className="w-[50px]">Actions</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {filteredQuotes.map((quote) => (
                        <TableRow
                          key={quote.id}
                          className="cursor-pointer hover:bg-muted/50"
                          onClick={() => navigate(`/quote/edit/${quote.id}`)}
                        >
                          <TableCell>
                            <div className="flex flex-col">
                              <div className="flex items-center gap-2">
                                <span className="font-medium">{quote.quote_number}</span>
                                {quote.first_viewed_at === null ? (
                                  <Button
                                    variant="ghost"
                                    size="sm"
                                    className="h-auto p-0"
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      toggleQuoteViewedStatus(quote.id, quote.first_viewed_at);
                                    }}
                                  >
                                    <Badge variant="destructive" className="text-xs cursor-pointer hover:bg-destructive/80">
                                      <Eye className="h-3 w-3 mr-1" />
                                      Unseen
                                    </Badge>
                                  </Button>
                                ) : (
                                  <Button
                                    variant="ghost"
                                    size="sm"
                                    className="h-auto p-0"
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      toggleQuoteViewedStatus(quote.id, quote.first_viewed_at);
                                    }}
                                  >
                                    <Badge variant="outline" className="text-xs cursor-pointer hover:bg-muted">
                                      <Eye className="h-3 w-3 mr-1" />
                                      Seen
                                    </Badge>
                                  </Button>
                                )}
                              </div>
                              {/* Mobile: Show status below quote number */}
                              <div className="sm:hidden mt-1">
                                <Badge variant={getStatusBadgeVariant(quote.status)} className="text-xs">
                                  {quote.status}
                                </Badge>
                              </div>
                            </div>
                          </TableCell>
                          <TableCell>
                            <div className="flex flex-col">
                              <div className="font-medium">
                                {quote.customer
                                  ? `${quote.customer.first_name} ${quote.customer.last_name}`
                                  : "Unknown"}
                              </div>
                              <div className="text-sm text-muted-foreground">
                                {quote.customer?.email}
                              </div>
                              {/* Mobile: Show amount below customer */}
                              <div className="md:hidden text-sm font-medium mt-1">
                                {formatCurrency(quote.total_amount)}
                              </div>
                            </div>
                          </TableCell>
                          <TableCell className="hidden sm:table-cell">
                            <Badge variant={getStatusBadgeVariant(quote.status)}>
                              {quote.status}
                            </Badge>
                          </TableCell>
                          <TableCell className="hidden md:table-cell">
                            <span className="font-medium">{formatCurrency(quote.total_amount)}</span>
                          </TableCell>
                          <TableCell className="hidden lg:table-cell">
                            <div className="text-sm text-muted-foreground">
                              {formatDate(quote.created_at)}
                            </div>
                          </TableCell>
                          <TableCell>
                            <DropdownMenu>
                              <DropdownMenuTrigger asChild onClick={(e) => e.stopPropagation()}>
                                <Button variant="ghost" size="sm" className="h-8 w-8 p-0">
                                  <MoreHorizontal className="h-4 w-4" />
                                </Button>
                              </DropdownMenuTrigger>
                              <DropdownMenuContent align="end">
                                <DropdownMenuItem
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    navigate(`/quote/edit/${quote.id}`);
                                  }}
                                >
                                  <Edit className="h-4 w-4 mr-2" />
                                  View/Edit
                                </DropdownMenuItem>
                                <DropdownMenuItem
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    navigate(`/customer/${quote.customer_id}`);
                                  }}
                                >
                                  <Users className="h-4 w-4 mr-2" />
                                  View Customer
                                </DropdownMenuItem>
                              </DropdownMenuContent>
                            </DropdownMenu>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                  {filteredQuotes.length === 0 && (
                    <div className="text-center py-8 text-muted-foreground">
                      <FileText className="h-8 w-8 mx-auto mb-4 opacity-50" />
                      <p>No quotes found</p>
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </main>
    </div>
  );
};

export default CRM;