import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { LogOut, Building2, Package, Users, FileText, Settings, Plus, ExternalLink, Eye, Zap, UserPlus } from "lucide-react";
import type { User, Session } from "@supabase/supabase-js";
import { useContractorId } from "@/hooks/useContractorId";
import { ProductForm } from "@/components/ProductForm";
import { CustomerDialog } from "@/components/CustomerDialog";
import { NewQuoteDialog } from "@/components/NewQuoteDialog";

const Dashboard = () => {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [stats, setStats] = useState({
    quotesNotViewed: 0,
    totalCustomers: 0,
    totalRevenue: 0,
  });
  const [showQuickAddDialog, setShowQuickAddDialog] = useState(false);
  const navigate = useNavigate();
  const { toast } = useToast();
  const { contractorId } = useContractorId();

  const handleQuoteCreated = () => {
    // Refresh stats when a new quote is created
    if (contractorId) {
      fetchStats();
    }
  };

  const fetchStats = async () => {
    if (!contractorId) return;

    try {
      // Fetch unviewed quotes count
      const { count: unviewedQuotesCount } = await supabase
        .from('quotes')
        .select('*', { count: 'exact', head: true })
        .eq('contractor_id', contractorId)
        .is('first_viewed_at', null);

      // Fetch customers count
      const { count: customersCount } = await supabase
        .from('customers')
        .select('*', { count: 'exact', head: true })
        .eq('contractor_id', contractorId);

      // Fetch total revenue from accepted quotes
      const { data: acceptedQuotes } = await supabase
        .from('quotes')
        .select('total_amount')
        .eq('contractor_id', contractorId)
        .eq('status', 'accepted');

      const totalRevenue = acceptedQuotes?.reduce((sum, quote) => sum + Number(quote.total_amount || 0), 0) || 0;

      setStats({
        quotesNotViewed: unviewedQuotesCount || 0,
        totalCustomers: customersCount || 0,
        totalRevenue,
      });
    } catch (error) {
      console.error('Error fetching stats:', error);
    }
  };

  useEffect(() => {
    // Set up auth state listener FIRST
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (event, session) => {
        setSession(session);
        setUser(session?.user ?? null);
        
        if (!session && !isLoading) {
          navigate("/auth");
        }
      }
    );

    // THEN check for existing session
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      setUser(session?.user ?? null);
      setIsLoading(false);
      
      if (!session) {
        navigate("/auth");
      }
    });

    return () => subscription.unsubscribe();
  }, [navigate, isLoading]);

  // Fetch dashboard statistics
  useEffect(() => {
    fetchStats();
  }, [contractorId]);

  const handleSignOut = async () => {
    try {
      const { error } = await supabase.auth.signOut();
      if (error) {
        toast({ 
          title: "Sign out failed", 
          description: error.message,
          variant: "destructive"
        });
        return;
      }
      toast({ title: "Signed out", description: "You've been successfully signed out." });
      navigate("/auth");
    } catch (error) {
      console.error("Sign out error:", error);
      toast({ 
        title: "Sign out failed", 
        description: "An unexpected error occurred.",
        variant: "destructive"
      });
    }
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center">
          <div className="inline-flex items-center justify-center w-16 h-16 bg-primary rounded-2xl mb-4">
            <Building2 className="h-8 w-8 text-primary-foreground animate-pulse" />
          </div>
          <p className="text-muted-foreground">Loading...</p>
        </div>
      </div>
    );
  }

  if (!user) {
    return null;
  }

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="border-b border-border bg-card">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16 gap-2">
            <div className="flex items-center min-w-0">
              <div className="inline-flex items-center justify-center w-8 h-8 sm:w-10 sm:h-10 bg-primary rounded-xl mr-2 sm:mr-3 flex-shrink-0">
                <Building2 className="h-5 w-5 sm:h-6 sm:w-6 text-primary-foreground" />
              </div>
              <div className="min-w-0">
                <h1 className="text-lg sm:text-xl font-semibold text-foreground truncate">MeasureQuote</h1>
                <p className="text-xs sm:text-sm text-muted-foreground hidden sm:block">Contractor Portal</p>
              </div>
            </div>
            <div className="flex items-center gap-2 sm:gap-4 flex-shrink-0">
              <span className="text-sm text-muted-foreground hidden sm:inline">
                Welcome, {user?.user_metadata?.first_name || user?.email}
              </span>
              <Button
                variant="outline"
                size="sm"
                onClick={handleSignOut}
                className="flex items-center"
              >
                <LogOut className="h-4 w-4 sm:mr-2" />
                <span className="hidden sm:inline">Sign Out</span>
              </Button>
            </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Welcome Section */}
        <div className="mb-8">
          <h2 className="text-3xl font-bold text-foreground mb-2">Dashboard</h2>
          <p className="text-muted-foreground">
            Manage your business, products, and customer quotes from one central location.
          </p>
        </div>

        {/* Quick Stats */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 md:gap-6 mb-8">
          <Card 
            className={`cursor-pointer transition-all hover:shadow-lg ${stats.quotesNotViewed > 0 ? "border-orange-500/50 bg-orange-50/50 dark:bg-orange-950/20" : ""}`}
            onClick={() => navigate('/crm?filter=unviewed')}
          >
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Quotes Not Viewed</CardTitle>
              <FileText className={`h-4 w-4 ${stats.quotesNotViewed > 0 ? 'text-orange-500' : 'text-muted-foreground'}`} />
            </CardHeader>
            <CardContent>
              <div className={`text-2xl font-bold ${stats.quotesNotViewed > 0 ? 'text-orange-600 dark:text-orange-400' : ''}`}>
                {stats.quotesNotViewed}
              </div>
              <p className="text-xs text-muted-foreground">Click to view</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Revenue</CardTitle>
              <Building2 className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">${stats.totalRevenue.toFixed(2)}</div>
              <p className="text-xs text-muted-foreground">From accepted quotes</p>
            </CardContent>
          </Card>
        </div>

        {/* Main Actions */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 md:gap-6">
          {/* 1. Customer CRM */}
          <Card className="hover:shadow-lg transition-shadow cursor-pointer">
            <CardHeader>
              <div className="flex items-center">
                <div className="p-2 bg-accent/10 rounded-lg mr-3 shrink-0">
                  <Users className="h-6 w-6 text-accent" />
                </div>
                <div className="min-w-0">
                  <CardTitle className="text-base md:text-lg">Customer CRM</CardTitle>
                  <CardDescription className="text-sm">Track customers and their quotes</CardDescription>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              <div className="flex flex-col gap-2">
                <Button variant="outline" className="w-full" onClick={() => navigate("/crm")}>
                  <Users className="h-4 w-4 mr-2" />
                  View Customers
                </Button>
                <div className="flex gap-2">
                  <CustomerDialog 
                    trigger={
                      <Button variant="outline" className="flex-1">
                        <Plus className="h-4 w-4 mr-2" />
                        Customer
                      </Button>
                    }
                  />
                  <NewQuoteDialog 
                    onQuoteCreated={handleQuoteCreated}
                    trigger={
                      <Button variant="outline" className="flex-1">
                        <Plus className="h-4 w-4 mr-2" />
                        Quote
                      </Button>
                    }
                  />
                </div>
              </div>
            </CardContent>
          </Card>

          {/* 2. Manage Products */}
          <Card className="hover:shadow-lg transition-shadow cursor-pointer">
            <CardHeader>
              <div className="flex items-center">
                <div className="p-2 bg-primary/10 rounded-lg mr-3 shrink-0">
                  <Package className="h-6 w-6 text-primary" />
                </div>
                <div className="min-w-0">
                  <CardTitle className="text-base md:text-lg">Manage Products</CardTitle>
                  <CardDescription className="text-sm">Add and edit your service offerings</CardDescription>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              <div className="flex flex-col sm:flex-row gap-2">
                <Button className="flex-1" onClick={() => navigate("/products")}>
                  <Plus className="h-4 w-4 mr-2" />
                  Manage Products
                </Button>
                <Button 
                  variant="outline" 
                  className="flex-1" 
                  onClick={() => setShowQuickAddDialog(true)}
                >
                  <Zap className="h-4 w-4 mr-2" />
                  Quick Add
                </Button>
              </div>
            </CardContent>
          </Card>

          {/* 3. Widget Settings */}
          <Card className="hover:shadow-lg transition-shadow cursor-pointer">
            <CardHeader>
              <div className="flex items-center">
                <div className="p-2 bg-success/10 rounded-lg mr-3 shrink-0">
                  <Settings className="h-6 w-6 text-success" />
                </div>
                <div className="min-w-0">
                  <CardTitle className="text-base md:text-lg">Widget Settings</CardTitle>
                  <CardDescription className="text-sm">Customize your quote widget branding</CardDescription>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              <Button variant="outline" className="w-full" onClick={() => navigate("/settings")}>
                <Settings className="h-4 w-4 mr-2" />
                Customize Widget
              </Button>
            </CardContent>
          </Card>

          {/* 4. Preview Widget */}
          <Card className="hover:shadow-lg transition-shadow cursor-pointer">
            <CardHeader>
              <div className="flex items-center">
                <div className="p-2 bg-blue-500/10 rounded-lg mr-3 shrink-0">
                  <Eye className="h-6 w-6 text-blue-500" />
                </div>
                <div className="min-w-0">
                  <CardTitle className="text-base md:text-lg">Preview Widget</CardTitle>
                  <CardDescription className="text-sm">Test your customer-facing quote widget</CardDescription>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              <Button 
                variant="outline" 
                className="w-full" 
                onClick={() => contractorId && navigate(`/widget/${contractorId}`)}
                disabled={!contractorId}
              >
                <Eye className="h-4 w-4 mr-2" />
                Preview Widget
              </Button>
            </CardContent>
          </Card>
        </div>

        {/* Getting Started Section */}
        <div className="mt-12">
          <Card className="bg-gradient-to-r from-primary/5 to-accent/5 border-primary/20">
            <CardHeader>
              <CardTitle className="text-xl">Getting Started</CardTitle>
              <CardDescription>
                Complete these steps to start generating quotes for your customers
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center space-x-3">
                <div className="w-8 h-8 bg-primary rounded-full flex items-center justify-center">
                  <span className="text-sm font-medium text-primary-foreground">1</span>
                </div>
                <div>
                  <p className="font-medium">Set up your business profile</p>
                  <p className="text-sm text-muted-foreground">Add your business details and branding</p>
                </div>
              </div>
              <div className="flex items-center space-x-3">
                <div className="w-8 h-8 bg-muted rounded-full flex items-center justify-center">
                  <span className="text-sm font-medium text-muted-foreground">2</span>
                </div>
                <div>
                  <p className="font-medium">Add your products and services</p>
                  <p className="text-sm text-muted-foreground">Define what you offer and pricing</p>
                </div>
              </div>
              <div className="flex items-center space-x-3">
                <div className="w-8 h-8 bg-muted rounded-full flex items-center justify-center">
                  <span className="text-sm font-medium text-muted-foreground">3</span>
                </div>
                <div>
                  <p className="font-medium">Generate widget embed code</p>
                  <p className="text-sm text-muted-foreground">Add the quote widget to your website</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </main>

      {/* Quick Add Product Dialog */}
      <Dialog open={showQuickAddDialog} onOpenChange={setShowQuickAddDialog}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Add New Product</DialogTitle>
          </DialogHeader>
          <ProductForm
            product={null}
            onSaved={() => {
              setShowQuickAddDialog(false);
              toast({
                title: "Success",
                description: "Product added successfully",
              });
            }}
            onCancel={() => setShowQuickAddDialog(false)}
          />
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default Dashboard;