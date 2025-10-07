import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import Index from "./pages/Index";
import Auth from "./pages/Auth";
import Dashboard from "./pages/Dashboard";
import Products from "./pages/Products";
import CRM from "./pages/CRM";
import CustomerDetail from "./pages/CustomerDetail";
import QuoteEdit from "./pages/QuoteEdit";
import Settings from "./pages/Settings";
import Widget from "./pages/Widget";
import NotFound from "./pages/NotFound";

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <BrowserRouter>
        <Routes>
          <Route path="/" element={<Index />} />
          <Route path="/auth" element={<Auth />} />
          <Route path="/dashboard" element={<Dashboard />} />
          <Route path="/products" element={<Products />} />
          <Route path="/crm" element={<CRM />} />
          <Route path="/customer/:customerId" element={<CustomerDetail />} />
          <Route path="/quote/:quoteId" element={<QuoteEdit />} />
          <Route path="/quote/edit/:quoteId" element={<QuoteEdit />} />
          <Route path="/quote/edit/:quoteId/:accessToken" element={<QuoteEdit />} />
          <Route path="/settings" element={<Settings />} />
          <Route path="/widget/:contractorId" element={<Widget />} />
          {/* ADD ALL CUSTOM ROUTES ABOVE THE CATCH-ALL "*" ROUTE */}
          <Route path="*" element={<NotFound />} />
        </Routes>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
