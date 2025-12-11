import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ArrowLeft, Search, Users, FileText, Phone, Mail, MapPin, MoreHorizontal, Edit, Plus, ArrowUpDown, Eye, ListTodo, CheckSquare, ArrowUp, ArrowDown, Clock, Flag, Calendar, AlertCircle } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useNavigate, useSearchParams } from "react-router-dom";
import { NewQuoteDialog } from "@/components/NewQuoteDialog";
import { CustomerDialog } from "@/components/CustomerDialog";
import { useToast } from "@/hooks/use-toast";
import { Checkbox } from "@/components/ui/checkbox";
import { TaskDropdown } from "@/components/crm/TaskDropdown";
import { format, isPast } from "date-fns";

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

interface TaskWithRelations {
  id: string;
  title: string;
  description: string | null;
  task_type: string;
  status: string;
  priority: string;
  due_date: string | null;
  completed_at: string | null;
  created_at: string;
  customer_id: string | null;
  quote_id: string | null;
  customer?: {
    first_name: string;
    last_name: string;
    email: string;
  };
  quote?: {
    quote_number: string;
    status: string;
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
  const [activeTab, setActiveTab] = useState("quotes");
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();
  const { toast } = useToast();
  const [searchParams] = useSearchParams();
  
  // Task-related state
  const [allTasks, setAllTasks] = useState<TaskWithRelations[]>([]);
  const [filteredTasks, setFilteredTasks] = useState<TaskWithRelations[]>([]);
  const [taskSearchTerm, setTaskSearchTerm] = useState("");
  const [taskStatusFilter, setTaskStatusFilter] = useState("all");
  const [taskPriorityFilter, setTaskPriorityFilter] = useState("all");
  const [taskSortBy, setTaskSortBy] = useState("due_date");
  const [taskSortOrder, setTaskSortOrder] = useState<'asc' | 'desc'>("asc");

  useEffect(() => {
    fetchCustomers();
    fetchAllQuotes();
    fetchAllTasks();
    // Check for URL filter, sort, and tab parameters
    const filterParam = searchParams.get('filter');
    const sortParam = searchParams.get('sort');
    const tabParam = searchParams.get('tab');
    if (tabParam === 'tasks') {
      setActiveTab('tasks');
    } else if (filterParam) {
      setActiveTab('quotes');
      if (filterParam === 'unviewed') {
        setQuoteStatusFilter('unviewed');
      } else if (filterParam === 'accepted') {
        setQuoteStatusFilter('accepted');
      } else if (filterParam === 'sent') {
        setQuoteStatusFilter('sent');
      }
    }
    if (sortParam === 'recent') {
      setQuoteSortBy('newest');
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

  // Filter and sort tasks
  useEffect(() => {
    let filtered = allTasks.filter(task => {
      const matchesSearch = 
        task.title.toLowerCase().includes(taskSearchTerm.toLowerCase()) ||
        (task.description && task.description.toLowerCase().includes(taskSearchTerm.toLowerCase())) ||
        (task.customer && `${task.customer.first_name} ${task.customer.last_name}`.toLowerCase().includes(taskSearchTerm.toLowerCase())) ||
        (task.quote && task.quote.quote_number.toLowerCase().includes(taskSearchTerm.toLowerCase()));

      const matchesStatus = taskStatusFilter === "all" || task.status === taskStatusFilter;
      const matchesPriority = taskPriorityFilter === "all" || task.priority === taskPriorityFilter;

      return matchesSearch && matchesStatus && matchesPriority;
    });

    // Apply sorting
    filtered = sortTasks(filtered, taskSortBy, taskSortOrder);
    setFilteredTasks(filtered);
  }, [allTasks, taskSearchTerm, taskStatusFilter, taskPriorityFilter, taskSortBy, taskSortOrder]);

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

  const fetchAllTasks = async () => {
    try {
      const { data: contractorData } = await supabase
        .from('contractors')
        .select('id')
        .eq('user_id', (await supabase.auth.getUser()).data.user?.id)
        .single();

      if (!contractorData) return;

      const { data: tasksData, error } = await supabase
        .from('tasks')
        .select('*')
        .eq('contractor_id', contractorData.id)
        .order('created_at', { ascending: false });

      if (error) throw error;

      if (tasksData && tasksData.length > 0) {
        // Fetch related customers and quotes separately
        const customerIds = tasksData.map(t => t.customer_id).filter(Boolean);
        const quoteIds = tasksData.map(t => t.quote_id).filter(Boolean);

        const [customersResponse, quotesResponse] = await Promise.all([
          customerIds.length > 0 
            ? supabase.from('customers').select('id, first_name, last_name, email').in('id', customerIds)
            : Promise.resolve({ data: [] }),
          quoteIds.length > 0
            ? supabase.from('quotes').select('id, quote_number, status').in('id', quoteIds)
            : Promise.resolve({ data: [] })
        ]);

        const customersMap = new Map((customersResponse.data || []).map(c => [c.id, c]));
        const quotesMap = new Map((quotesResponse.data || []).map(q => [q.id, q]));

        const tasksWithRelations = tasksData.map(task => ({
          ...task,
          customer: task.customer_id ? customersMap.get(task.customer_id) : undefined,
          quote: task.quote_id ? quotesMap.get(task.quote_id) : undefined
        }));

        setAllTasks(tasksWithRelations);
      } else {
        setAllTasks([]);
      }
    } catch (error: any) {
      toast({
        title: "Error",
        description: "Failed to load tasks",
        variant: "destructive",
      });
      console.error("Error fetching tasks:", error);
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

  const updateQuoteStatus = async (quoteId: string, newStatus: string) => {
    try {
      const { error } = await supabase
        .from('quotes')
        .update({ status: newStatus })
        .eq('id', quoteId);

      if (error) throw error;

      // Update allQuotes state
      setAllQuotes(prev => 
        prev.map(quote => 
          quote.id === quoteId 
            ? { ...quote, status: newStatus }
            : quote
        )
      );

      // Update customerQuotes state to keep it synced
      setCustomerQuotes(prev => {
        const updated = { ...prev };
        Object.keys(updated).forEach(customerId => {
          updated[customerId] = updated[customerId].map(quote =>
            quote.id === quoteId ? { ...quote, status: newStatus } : quote
          );
        });
        return updated;
      });

      toast({
        title: "Status updated",
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

  const getQuoteStatusBadgeVariant = (status: string) => {
    switch (status) {
      case "accepted": return "default";
      case "pending": return "secondary";
      case "draft": return "outline";
      case "declined": case "expired": return "destructive";
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

  const toggleTaskCompletion = async (taskId: string, currentStatus: string) => {
    const newStatus = currentStatus === 'completed' ? 'pending' : 'completed';
    const updateData: any = { status: newStatus };
    
    if (newStatus === 'completed') {
      updateData.completed_at = new Date().toISOString();
    } else {
      updateData.completed_at = null;
    }

    const { error } = await supabase
      .from('tasks')
      .update(updateData)
      .eq('id', taskId);

    if (error) {
      toast({
        title: "Error",
        description: "Failed to update task",
        variant: "destructive",
      });
      return;
    }

    fetchAllTasks();
  };

  const getTaskTypeIcon = (type: string) => {
    const icons = {
      follow_up: Phone,
      send_quote: Mail,
      schedule_meeting: Calendar,
      site_visit: Calendar,
      review_quote: FileText,
      other: AlertCircle,
    };
    return icons[type] || AlertCircle;
  };

  const getPriorityVariant = (priority: string): "default" | "destructive" | "secondary" | "outline" => {
    switch (priority) {
      case "high": return "destructive";
      case "medium": return "secondary";
      case "low": return "outline";
      default: return "outline";
    }
  };

  const getTaskStatusBadgeVariant = (status: string): "default" | "destructive" | "secondary" | "outline" => {
    switch (status) {
      case "completed": return "default";
      case "in_progress": return "secondary";
      case "pending": return "outline";
      case "cancelled": return "destructive";
      default: return "outline";
    }
  };

  const sortTasks = (tasks: TaskWithRelations[], sortBy: string, sortOrder: 'asc' | 'desc') => {
    return [...tasks].sort((a, b) => {
      // Completed tasks always go to bottom
      if (a.status === 'completed' && b.status !== 'completed') return 1;
      if (a.status !== 'completed' && b.status === 'completed') return -1;

      let comparison = 0;

      switch (sortBy) {
        case 'due_date':
          if (!a.due_date && !b.due_date) return priorityValue(b.priority) - priorityValue(a.priority);
          if (!a.due_date) return 1;
          if (!b.due_date) return -1;
          comparison = new Date(a.due_date).getTime() - new Date(b.due_date).getTime();
          if (comparison === 0) return priorityValue(b.priority) - priorityValue(a.priority);
          break;

        case 'priority':
          comparison = priorityValue(a.priority) - priorityValue(b.priority);
          break;

        case 'status':
          const statusValues = { pending: 1, in_progress: 2, completed: 3, cancelled: 4 };
          comparison = (statusValues[a.status] || 0) - (statusValues[b.status] || 0);
          break;

        case 'created_at':
          comparison = new Date(a.created_at).getTime() - new Date(b.created_at).getTime();
          break;
      }

      return sortOrder === 'asc' ? comparison : -comparison;
    });
  };

  const priorityValue = (priority: string) => {
    const values = { high: 3, medium: 2, low: 1 };
    return values[priority] || 0;
  };

  const pendingTasksCount = allTasks.filter(t => t.status !== 'completed').length;

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
          <TabsList className="grid w-full max-w-2xl grid-cols-3">
            <TabsTrigger value="quotes" className="flex items-center gap-2">
              <FileText className="h-4 w-4" />
              All Quotes
              {allQuotes.length > 0 && (
                <Badge variant="secondary" className="ml-1">{allQuotes.length}</Badge>
              )}
            </TabsTrigger>
            <TabsTrigger value="customers" className="flex items-center gap-2">
              <Users className="h-4 w-4" />
              Customers
              {customers.length > 0 && (
                <Badge variant="secondary" className="ml-1">{customers.length}</Badge>
              )}
            </TabsTrigger>
            <TabsTrigger value="tasks" className="flex items-center gap-2">
              <ListTodo className="h-4 w-4" />
              All Tasks
              {pendingTasksCount > 0 && (
                <Badge variant="destructive" className="ml-1">{pendingTasksCount}</Badge>
              )}
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
                              <div className="sm:hidden mt-1" onClick={(e) => e.stopPropagation()}>
                                <Select 
                                  value={quote.status} 
                                  onValueChange={(newStatus) => updateQuoteStatus(quote.id, newStatus)}
                                >
                                  <SelectTrigger className="w-[140px] h-7 text-xs">
                                    <SelectValue />
                                  </SelectTrigger>
                                  <SelectContent>
                                    <SelectItem value="draft">Draft</SelectItem>
                                    <SelectItem value="pending">Pending</SelectItem>
                                    <SelectItem value="accepted">Accepted</SelectItem>
                                    <SelectItem value="declined">Declined</SelectItem>
                                    <SelectItem value="expired">Expired</SelectItem>
                                  </SelectContent>
                                </Select>
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
                          <TableCell className="hidden sm:table-cell" onClick={(e) => e.stopPropagation()}>
                            <Select 
                              value={quote.status} 
                              onValueChange={(newStatus) => updateQuoteStatus(quote.id, newStatus)}
                            >
                              <SelectTrigger className="w-[140px] h-8">
                                <SelectValue />
                              </SelectTrigger>
                              <SelectContent>
                                <SelectItem value="draft">Draft</SelectItem>
                                <SelectItem value="pending">Pending</SelectItem>
                                <SelectItem value="accepted">Accepted</SelectItem>
                                <SelectItem value="declined">Declined</SelectItem>
                                <SelectItem value="expired">Expired</SelectItem>
                              </SelectContent>
                            </Select>
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

          {/* Tasks Tab */}
          <TabsContent value="tasks" className="space-y-6">
            {/* Search and Filter Bar */}
            <Card>
              <CardHeader>
                <div className="flex flex-col sm:flex-row gap-4 items-start sm:items-center justify-between">
                  <div className="flex-1 w-full">
                    <div className="relative">
                      <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground h-4 w-4" />
                      <Input
                        placeholder="Search tasks by title, customer, or quote..."
                        value={taskSearchTerm}
                        onChange={(e) => setTaskSearchTerm(e.target.value)}
                        className="pl-10"
                      />
                    </div>
                  </div>
                  <div className="flex gap-2 w-full sm:w-auto flex-wrap">
                    <Select value={taskStatusFilter} onValueChange={setTaskStatusFilter}>
                      <SelectTrigger className="w-full sm:w-[140px]">
                        <SelectValue placeholder="Status" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">All Status</SelectItem>
                        <SelectItem value="pending">Pending</SelectItem>
                        <SelectItem value="in_progress">In Progress</SelectItem>
                        <SelectItem value="completed">Completed</SelectItem>
                        <SelectItem value="cancelled">Cancelled</SelectItem>
                      </SelectContent>
                    </Select>
                    
                    <Select value={taskPriorityFilter} onValueChange={setTaskPriorityFilter}>
                      <SelectTrigger className="w-full sm:w-[140px]">
                        <SelectValue placeholder="Priority" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">All Priority</SelectItem>
                        <SelectItem value="high">High</SelectItem>
                        <SelectItem value="medium">Medium</SelectItem>
                        <SelectItem value="low">Low</SelectItem>
                      </SelectContent>
                    </Select>
                    
                    <Select value={taskSortBy} onValueChange={(value) => setTaskSortBy(value)}>
                      <SelectTrigger className="w-full sm:w-[140px]">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="due_date">Due Date</SelectItem>
                        <SelectItem value="priority">Priority</SelectItem>
                        <SelectItem value="status">Status</SelectItem>
                        <SelectItem value="created_at">Created</SelectItem>
                      </SelectContent>
                    </Select>
                    
                    <Button
                      variant="outline"
                      size="icon"
                      onClick={() => setTaskSortOrder(prev => prev === 'asc' ? 'desc' : 'asc')}
                    >
                      {taskSortOrder === 'asc' ? <ArrowUp className="h-4 w-4" /> : <ArrowDown className="h-4 w-4" />}
                    </Button>
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                {/* Tasks Table */}
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-[40px]"></TableHead>
                      <TableHead>Task</TableHead>
                      <TableHead className="hidden md:table-cell">Customer</TableHead>
                      <TableHead className="hidden md:table-cell">Quote</TableHead>
                      <TableHead className="hidden sm:table-cell">Priority</TableHead>
                      <TableHead className="hidden sm:table-cell">Status</TableHead>
                      <TableHead className="hidden lg:table-cell">Due Date</TableHead>
                      <TableHead className="w-[50px]"></TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredTasks.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={8} className="text-center py-12">
                          <Clock className="h-12 w-12 mx-auto mb-3 opacity-50 text-muted-foreground" />
                          <p className="text-lg font-medium">No tasks found</p>
                          <p className="text-sm text-muted-foreground">
                            {taskSearchTerm || taskStatusFilter !== "all" || taskPriorityFilter !== "all"
                              ? "Try adjusting your filters"
                              : "Tasks will appear here as you create them"}
                          </p>
                        </TableCell>
                      </TableRow>
                    ) : (
                      filteredTasks.map((task) => {
                        const TaskIcon = getTaskTypeIcon(task.task_type);
                        const isOverdue = task.due_date && isPast(new Date(task.due_date)) && task.status !== 'completed';
                        
                        return (
                          <TableRow key={task.id} className="hover:bg-muted/50">
                            <TableCell>
                              <Checkbox
                                checked={task.status === 'completed'}
                                onCheckedChange={() => toggleTaskCompletion(task.id, task.status)}
                                onClick={(e) => e.stopPropagation()}
                              />
                            </TableCell>
                            <TableCell>
                              <div className="space-y-1">
                                <div className="flex items-center gap-2 flex-wrap">
                                  <TaskIcon className="h-4 w-4 text-muted-foreground" />
                                  <span className={`font-medium ${task.status === 'completed' ? 'line-through text-muted-foreground' : ''}`}>
                                    {task.title}
                                  </span>
                                  {isOverdue && (
                                    <Badge variant="destructive" className="text-xs">
                                      <Flag className="h-3 w-3 mr-1" />
                                      Overdue
                                    </Badge>
                                  )}
                                </div>
                                {task.description && (
                                  <p className="text-sm text-muted-foreground line-clamp-1">{task.description}</p>
                                )}
                                {/* Mobile: Show additional info below */}
                                <div className="md:hidden flex flex-wrap gap-2 mt-2">
                                  {task.customer && (
                                    <span className="text-sm text-muted-foreground">
                                      {task.customer.first_name} {task.customer.last_name}
                                    </span>
                                  )}
                                  {task.quote && (
                                    <span className="text-sm text-muted-foreground">
                                      {task.quote.quote_number}
                                    </span>
                                  )}
                                </div>
                                <div className="sm:hidden flex gap-2 mt-1">
                                  <Badge variant={getPriorityVariant(task.priority)} className="text-xs">
                                    {task.priority}
                                  </Badge>
                                  <Badge variant={getTaskStatusBadgeVariant(task.status)} className="text-xs">
                                    {task.status.replace('_', ' ')}
                                  </Badge>
                                </div>
                              </div>
                            </TableCell>
                            <TableCell className="hidden md:table-cell">
                              {task.customer && (
                                <Button
                                  variant="link"
                                  className="p-0 h-auto"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    navigate(`/customer/${task.customer_id}`);
                                  }}
                                >
                                  {task.customer.first_name} {task.customer.last_name}
                                </Button>
                              )}
                            </TableCell>
                            <TableCell className="hidden md:table-cell">
                              {task.quote && (
                                <Button
                                  variant="link"
                                  className="p-0 h-auto"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    navigate(`/quote/edit/${task.quote_id}`);
                                  }}
                                >
                                  {task.quote.quote_number}
                                </Button>
                              )}
                            </TableCell>
                            <TableCell className="hidden sm:table-cell">
                              <Badge variant={getPriorityVariant(task.priority)}>
                                {task.priority}
                              </Badge>
                            </TableCell>
                            <TableCell className="hidden sm:table-cell">
                              <Badge variant={getTaskStatusBadgeVariant(task.status)}>
                                {task.status.replace('_', ' ')}
                              </Badge>
                            </TableCell>
                            <TableCell className="hidden lg:table-cell">
                              {task.due_date ? (
                                <span className={`text-sm ${isOverdue ? 'text-destructive font-medium' : 'text-muted-foreground'}`}>
                                  {format(new Date(task.due_date), 'MMM d, yyyy')}
                                  <br />
                                  <span className="text-xs">{format(new Date(task.due_date), 'h:mm a')}</span>
                                </span>
                              ) : (
                                <span className="text-sm text-muted-foreground">No due date</span>
                              )}
                            </TableCell>
                            <TableCell>
                              <TaskDropdown
                                quoteId={task.quote_id || ''}
                                customerId={task.customer_id || ''}
                                task={task}
                                onTaskCreated={fetchAllTasks}
                                mode="edit"
                              />
                            </TableCell>
                          </TableRow>
                        );
                      })
                    )}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </main>
    </div>
  );
};

export default CRM;