import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Plus, Search, UserPlus } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { PhoneQuoteDialog } from "@/components/PhoneQuoteDialog";
import { Badge } from "@/components/ui/badge";

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

interface CustomerQuoteDialogProps {
  onQuoteCreated?: (quoteId: string) => void;
}

export function CustomerQuoteDialog({ onQuoteCreated }: CustomerQuoteDialogProps) {
  const [open, setOpen] = useState(false);
  const [step, setStep] = useState<'select' | 'create'>('select');
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [filteredCustomers, setFilteredCustomers] = useState<Customer[]>([]);
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedCustomer, setSelectedCustomer] = useState<Customer | null>(null);
  const [showQuoteForm, setShowQuoteForm] = useState(false);

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

  const handleCustomerSelect = (customer: Customer) => {
    setSelectedCustomer(customer);
    setShowQuoteForm(true);
  };

  const handleCreateNew = () => {
    setSelectedCustomer(null);
    setShowQuoteForm(true);
  };

  const handleQuoteCreated = (quoteId: string) => {
    setOpen(false);
    setStep('select');
    setSearchTerm("");
    setSelectedCustomer(null);
    setShowQuoteForm(false);
    onQuoteCreated?.(quoteId);
  };

  const handleOpenChange = (newOpen: boolean) => {
    setOpen(newOpen);
    if (!newOpen) {
      setStep('select');
      setSearchTerm("");
      setSelectedCustomer(null);
      setShowQuoteForm(false);
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

  if (showQuoteForm) {
    return (
      <PhoneQuoteDialog
        customerId={selectedCustomer?.id}
        prefilledCustomer={selectedCustomer ? {
          first_name: selectedCustomer.first_name,
          last_name: selectedCustomer.last_name,
          email: selectedCustomer.email,
          phone: selectedCustomer.phone || "",
          address: selectedCustomer.address || "",
          city: selectedCustomer.city || "",
          state: selectedCustomer.state || "",
          zip_code: selectedCustomer.zip_code || "",
        } : undefined}
        onQuoteCreated={handleQuoteCreated}
      />
    );
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogTrigger asChild>
        <Button>
          <Plus className="h-4 w-4 md:mr-2" />
          <span className="hidden md:inline">New Quote</span>
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>Select or Create Customer</DialogTitle>
        </DialogHeader>
        
        <div className="space-y-4">
          {/* Create New Customer Button */}
          <Button
            variant="outline"
            className="w-full justify-start h-auto py-4"
            onClick={handleCreateNew}
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
      </DialogContent>
    </Dialog>
  );
}
