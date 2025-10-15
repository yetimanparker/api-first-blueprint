import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Plus, Search, UserPlus, Loader2, ArrowLeft } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Badge } from "@/components/ui/badge";
import { useNavigate } from "react-router-dom";
import { useToast } from "@/hooks/use-toast";
import { useContractorId } from "@/hooks/useContractorId";

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
  status: string;
}

interface NewQuoteDialogProps {
  onQuoteCreated?: () => void;
}

export function NewQuoteDialog({ onQuoteCreated }: NewQuoteDialogProps) {
  const [open, setOpen] = useState(false);
  const [step, setStep] = useState<'select' | 'create'>('select');
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [filteredCustomers, setFilteredCustomers] = useState<Customer[]>([]);
  const [searchTerm, setSearchTerm] = useState("");
  const [creating, setCreating] = useState(false);
  const navigate = useNavigate();
  const { toast } = useToast();
  const { contractorId } = useContractorId();
  
  const [customerForm, setCustomerForm] = useState({
    first_name: "",
    last_name: "",
    email: "",
    phone: "",
    address: "",
    city: "",
    state: "",
    zip_code: "",
  });

  useEffect(() => {
    if (open) {
      fetchCustomers();
    }
  }, [open]);

  useEffect(() => {
    if (searchTerm) {
      const filtered = customers.filter(customer =>
        `${customer.first_name} ${customer.last_name}`.toLowerCase().includes(searchTerm.toLowerCase()) ||
        customer.email.toLowerCase().includes(searchTerm.toLowerCase()) ||
        (customer.phone && customer.phone.includes(searchTerm))
      );
      setFilteredCustomers(filtered);
    } else {
      setFilteredCustomers(customers);
    }
  }, [searchTerm, customers]);

  const fetchCustomers = async () => {
    const { data, error } = await supabase
      .from("customers")
      .select("*")
      .order("last_activity_at", { ascending: false });

    if (!error && data) {
      setCustomers(data);
      setFilteredCustomers(data);
    }
  };

  const createQuoteForCustomer = async (customerId: string) => {
    try {
      setCreating(true);

      // Get contractor ID
      const { data: contractorId, error: contractorError } = await supabase
        .rpc('get_current_contractor_id');

      if (contractorError) throw contractorError;

      // Generate quote number
      const { data: quoteNumber, error: quoteNumberError } = await supabase
        .rpc('generate_quote_number');

      if (quoteNumberError) throw quoteNumberError;

      // Create the quote (access_token is optional for internal quotes)
      const { data: newQuote, error: quoteError } = await supabase
        .from('quotes')
        .insert({
          quote_number: quoteNumber,
          customer_id: customerId,
          contractor_id: contractorId,
          status: 'draft',
          total_amount: 0,
        })
        .select()
        .single();

      if (quoteError) throw quoteError;

      toast({
        title: "Quote Created",
        description: `Quote ${quoteNumber} created successfully`,
      });

      setOpen(false);
      onQuoteCreated?.();
      
      // Navigate to the quote edit page
      navigate(`/quote/edit/${newQuote.id}`);

    } catch (error) {
      console.error('Error creating quote:', error);
      toast({
        title: "Error",
        description: "Failed to create quote",
        variant: "destructive",
      });
    } finally {
      setCreating(false);
    }
  };

  const handleCustomerSelect = (customer: Customer) => {
    createQuoteForCustomer(customer.id);
  };

  const handleOpenChange = (newOpen: boolean) => {
    setOpen(newOpen);
    if (!newOpen) {
      setSearchTerm("");
      setStep('select');
      setCustomerForm({
        first_name: "",
        last_name: "",
        email: "",
        phone: "",
        address: "",
        city: "",
        state: "",
        zip_code: "",
      });
    }
  };

  const handleCreateNewCustomer = async () => {
    if (!contractorId) {
      toast({
        title: "Error",
        description: "Contractor ID not found",
        variant: "destructive",
      });
      return;
    }

    try {
      setCreating(true);

      // Create the customer
      const { data: customer, error: customerError } = await supabase
        .from("customers")
        .insert({
          contractor_id: contractorId,
          first_name: customerForm.first_name,
          last_name: customerForm.last_name,
          email: customerForm.email,
          phone: customerForm.phone || null,
          address: customerForm.address || null,
          city: customerForm.city || null,
          state: customerForm.state || null,
          zip_code: customerForm.zip_code || null,
          status: 'lead',
        })
        .select()
        .single();

      if (customerError) throw customerError;

      toast({
        title: "Customer Created",
        description: "Creating quote...",
      });

      // Create quote for the new customer
      await createQuoteForCustomer(customer.id);

    } catch (error) {
      console.error('Error creating customer:', error);
      toast({
        title: "Error",
        description: "Failed to create customer",
        variant: "destructive",
      });
      setCreating(false);
    }
  };

  const getStatusBadgeVariant = (status: string) => {
    switch (status) {
      case 'lead': return 'secondary';
      case 'contacted': return 'default';
      case 'quoted': return 'default';
      case 'negotiating': return 'default';
      case 'converted': return 'default';
      case 'lost': return 'destructive';
      case 'inactive': return 'outline';
      default: return 'secondary';
    }
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogTrigger asChild>
        <Button>
          <Plus className="h-4 w-4 mr-2" />
          New Quote
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>
            {step === 'select' ? 'Create New Quote - Select Customer' : 'Create New Customer'}
          </DialogTitle>
        </DialogHeader>
        
        {creating ? (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
            <span className="ml-3 text-muted-foreground">
              {step === 'create' ? 'Creating customer and quote...' : 'Creating quote...'}
            </span>
          </div>
        ) : step === 'create' ? (
          <form onSubmit={(e) => { e.preventDefault(); handleCreateNewCustomer(); }} className="space-y-4">
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={() => setStep('select')}
              className="mb-4"
            >
              <ArrowLeft className="h-4 w-4 mr-2" />
              Back to Customer Selection
            </Button>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="first_name">First Name *</Label>
                <Input
                  id="first_name"
                  value={customerForm.first_name}
                  onChange={(e) => setCustomerForm({ ...customerForm, first_name: e.target.value })}
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="last_name">Last Name *</Label>
                <Input
                  id="last_name"
                  value={customerForm.last_name}
                  onChange={(e) => setCustomerForm({ ...customerForm, last_name: e.target.value })}
                  required
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="email">Email *</Label>
                <Input
                  id="email"
                  type="email"
                  value={customerForm.email}
                  onChange={(e) => setCustomerForm({ ...customerForm, email: e.target.value })}
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="phone">Phone</Label>
                <Input
                  id="phone"
                  type="tel"
                  value={customerForm.phone}
                  onChange={(e) => setCustomerForm({ ...customerForm, phone: e.target.value })}
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="address">Address</Label>
              <Input
                id="address"
                value={customerForm.address}
                onChange={(e) => setCustomerForm({ ...customerForm, address: e.target.value })}
              />
            </div>

            <div className="grid grid-cols-3 gap-4">
              <div className="space-y-2">
                <Label htmlFor="city">City</Label>
                <Input
                  id="city"
                  value={customerForm.city}
                  onChange={(e) => setCustomerForm({ ...customerForm, city: e.target.value })}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="state">State</Label>
                <Input
                  id="state"
                  value={customerForm.state}
                  onChange={(e) => setCustomerForm({ ...customerForm, state: e.target.value })}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="zip_code">Zip Code</Label>
                <Input
                  id="zip_code"
                  value={customerForm.zip_code}
                  onChange={(e) => setCustomerForm({ ...customerForm, zip_code: e.target.value })}
                />
              </div>
            </div>

            <div className="flex justify-end gap-2 pt-4">
              <Button type="button" variant="outline" onClick={() => setStep('select')}>
                Cancel
              </Button>
              <Button type="submit">
                Create Customer & Quote
              </Button>
            </div>
          </form>
        ) : (
          <div className="space-y-4">
            {/* Create New Customer Button */}
            <Button
              variant="outline"
              className="w-full justify-start h-auto py-4"
              onClick={() => setStep('create')}
            >
              <UserPlus className="h-5 w-5 mr-3" />
              <div className="text-left">
                <div className="font-semibold">Create New Customer</div>
                <div className="text-sm text-muted-foreground">Start a quote for a new customer</div>
              </div>
            </Button>

            {/* Search Existing Customers */}
            <div className="space-y-3">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Search existing customers..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-9"
                />
              </div>

              <ScrollArea className="h-[400px] rounded-md border">
                <div className="p-4 space-y-2">
                  {filteredCustomers.length === 0 ? (
                    <div className="text-center py-8 text-muted-foreground">
                      {searchTerm ? "No customers found" : "No customers yet"}
                    </div>
                  ) : (
                    filteredCustomers.map((customer) => (
                      <Button
                        key={customer.id}
                        variant="ghost"
                        className="w-full justify-start h-auto py-3 px-3"
                        onClick={() => handleCustomerSelect(customer)}
                      >
                        <div className="text-left w-full">
                          <div className="flex items-center justify-between mb-1">
                            <span className="font-semibold">
                              {customer.first_name} {customer.last_name}
                            </span>
                            <Badge variant={getStatusBadgeVariant(customer.status)}>
                              {customer.status}
                            </Badge>
                          </div>
                          <div className="text-sm text-muted-foreground space-y-0.5">
                            <div>{customer.email}</div>
                            {customer.phone && <div>{customer.phone}</div>}
                            {customer.address && customer.city && (
                              <div>{customer.address}, {customer.city}, {customer.state} {customer.zip_code}</div>
                            )}
                          </div>
                        </div>
                      </Button>
                    ))
                  )}
                </div>
              </ScrollArea>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
