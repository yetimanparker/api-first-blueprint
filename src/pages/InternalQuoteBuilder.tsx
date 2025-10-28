import { useState, useEffect, useRef } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ArrowLeft, Plus, Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/components/ui/use-toast";
import { useContractorId } from "@/hooks/useContractorId";
import { useGlobalSettings } from "@/hooks/useGlobalSettings";
import ProductSelector from "@/components/widget/ProductSelector";
import MeasurementTools from "@/components/widget/MeasurementTools";
import ProductConfiguration from "@/components/widget/ProductConfiguration";
import type { MeasurementData, QuoteItem } from "@/types/widget";

interface Quote {
  id: string;
  quote_number: string;
  customer_id: string;
  status: string;
  total_amount: number;
  project_address?: string;
  project_city?: string;
  project_state?: string;
  project_zip_code?: string;
}

interface Customer {
  id: string;
  first_name: string;
  last_name: string;
  email: string;
  address?: string;
  city?: string;
  state?: string;
  zip_code?: string;
}

interface ProductCategory {
  id: string;
  name: string;
  color_hex: string;
}

type WorkflowStep = 'product-selection' | 'measurement' | 'product-configuration';

export default function InternalQuoteBuilder() {
  const { quoteId } = useParams();
  const navigate = useNavigate();
  const { toast } = useToast();
  const { contractorId, loading: contractorLoading } = useContractorId();
  const { settings, loading: settingsLoading } = useGlobalSettings();
  const [currentStep, setCurrentStep] = useState<WorkflowStep>('product-selection');
  const [quote, setQuote] = useState<Quote | null>(null);
  const [customer, setCustomer] = useState<Customer | null>(null);
  const [categories, setCategories] = useState<ProductCategory[]>([]);
  const [loading, setLoading] = useState(true);
  const [currentProductId, setCurrentProductId] = useState<string | undefined>();
  const [currentMeasurement, setCurrentMeasurement] = useState<MeasurementData | undefined>();
  const [quoteItems, setQuoteItems] = useState<QuoteItem[]>([]);
  const [saving, setSaving] = useState(false);
  const stepRefs = useRef<{ [key: string]: HTMLDivElement | null }>({});

  useEffect(() => {
    if (!contractorLoading && !contractorId) {
      toast({
        title: "Authentication Required",
        description: "Please log in to access the quote builder",
        variant: "destructive",
      });
      navigate('/auth');
      return;
    }

    if (quoteId && contractorId) {
      fetchQuoteData();
      fetchCategories();
    }
  }, [quoteId, contractorId, contractorLoading]);

  const fetchCategories = async () => {
    if (!contractorId) return;
    
    try {
      const { data, error } = await supabase
        .from('product_categories')
        .select('*')
        .eq('contractor_id', contractorId)
        .eq('is_active', true)
        .order('display_order');

      if (error) throw error;
      setCategories(data || []);
    } catch (error) {
      console.error('Error fetching categories:', error);
    }
  };

  useEffect(() => {
    const currentStepRef = stepRefs.current[currentStep];
    if (currentStepRef) {
      setTimeout(() => {
        currentStepRef.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }, 100);
    }
  }, [currentStep]);

  const fetchQuoteData = async () => {
    try {
      setLoading(true);
      
      const { data: quoteData, error: quoteError } = await supabase
        .from('quotes')
        .select('*, customer:customers(*)')
        .eq('id', quoteId)
        .single();

      if (quoteError) throw quoteError;

      setQuote(quoteData);
      setCustomer(quoteData.customer);

      // Fetch existing quote items
      const { data: itemsData, error: itemsError } = await supabase
        .from('quote_items')
        .select('*, product:products(name, unit_type, color_hex)')
        .eq('quote_id', quoteId);

      if (itemsError) throw itemsError;

      // Convert to QuoteItem format
      const items: QuoteItem[] = (itemsData || []).map(item => ({
        id: item.id,
        productId: item.product_id,
        productName: item.product.name,
        unitType: item.product.unit_type,
        measurement: item.measurement_data as unknown as MeasurementData,
        unitPrice: Number(item.unit_price),
        quantity: Number(item.quantity),
        lineTotal: Number(item.line_total),
        notes: item.notes,
      }));

      setQuoteItems(items);

    } catch (error) {
      console.error('Error fetching quote data:', error);
      toast({
        title: "Error",
        description: "Failed to load quote data",
        variant: "destructive",
      });
      navigate('/crm');
    } finally {
      setLoading(false);
    }
  };

  const handleProductSelect = (productId: string) => {
    setCurrentProductId(productId);
    setCurrentStep('measurement');
  };

  const handleMeasurementComplete = (measurement: MeasurementData) => {
    setCurrentMeasurement(measurement);
  };

  const handleAddToQuote = async (item: QuoteItem) => {
    if (!quoteId) return;

    try {
      setSaving(true);

      // Save to database
      const { data, error } = await supabase
        .from('quote_items')
        .insert({
          quote_id: quoteId,
          product_id: item.productId,
          quantity: item.quantity,
          unit_price: item.unitPrice,
          line_total: item.lineTotal,
          measurement_data: item.measurement as any,
          notes: item.notes,
        })
        .select()
        .single();

      if (error) throw error;

      // Add to local state
      setQuoteItems(prev => [...prev, { ...item, id: data.id }]);

      // Recalculate quote total
      const newTotal = [...quoteItems, item].reduce((sum, i) => sum + i.lineTotal, 0);
      await supabase
        .from('quotes')
        .update({ total_amount: newTotal })
        .eq('id', quoteId);

      toast({
        title: "Item Added",
        description: "Quote item has been added successfully",
      });

      // Navigate back to quote edit page
      navigate(`/quote/edit/${quoteId}`);

    } catch (error) {
      console.error('Error adding quote item:', error);
      toast({
        title: "Error",
        description: "Failed to add item to quote",
        variant: "destructive",
      });
    } finally {
      setSaving(false);
    }
  };

  const handleBack = () => {
    if (currentStep === 'measurement') {
      setCurrentStep('product-selection');
      setCurrentProductId(undefined);
    } else if (currentStep === 'product-configuration') {
      setCurrentStep('measurement');
      setCurrentMeasurement(undefined);
    }
  };

  const handleFinish = () => {
    navigate(`/quote/edit/${quoteId}`);
  };

  const getCustomerAddress = () => {
    if (quote?.project_address) {
      const parts = [quote.project_address, quote.project_city, quote.project_state, quote.project_zip_code].filter(Boolean);
      return parts.join(', ');
    }
    if (customer?.address) {
      const parts = [customer.address, customer.city, customer.state, customer.zip_code].filter(Boolean);
      return parts.join(', ');
    }
    return undefined;
  };

  if (contractorLoading || loading || settingsLoading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!settings) {
    return null;
  }

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="border-b border-border bg-card sticky top-0 z-10">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16">
            <div className="flex items-center gap-4">
              <Button variant="ghost" onClick={() => navigate(`/quote/edit/${quoteId}`)}>
                <ArrowLeft className="h-4 w-4 mr-2" />
                Back to Quote
              </Button>
              {quote && (
                <div>
                  <h1 className="text-lg font-semibold text-foreground">
                    {quote.quote_number}
                  </h1>
                  <p className="text-sm text-muted-foreground">
                    {customer?.first_name} {customer?.last_name}
                  </p>
                </div>
              )}
            </div>
            <Button onClick={handleFinish} variant="outline">
              Finish & Review Quote
            </Button>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Progress Indicator */}
        <Card className="mb-6 hidden md:block">
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div className={`flex items-center gap-2 ${currentStep === 'product-selection' ? 'text-primary' : 'text-muted-foreground'}`}>
                <div className={`w-8 h-8 rounded-full flex items-center justify-center border-2 ${currentStep === 'product-selection' ? 'border-primary bg-primary text-primary-foreground' : 'border-muted'}`}>
                  1
                </div>
                <span className="font-medium">Select Product</span>
              </div>
              <div className="flex-1 h-px bg-border mx-4" />
              <div className={`flex items-center gap-2 ${currentStep === 'measurement' ? 'text-primary' : 'text-muted-foreground'}`}>
                <div className={`w-8 h-8 rounded-full flex items-center justify-center border-2 ${currentStep === 'measurement' ? 'border-primary bg-primary text-primary-foreground' : 'border-muted'}`}>
                  2
                </div>
                <span className="font-medium">Measure</span>
              </div>
              <div className="flex-1 h-px bg-border mx-4" />
              <div className={`flex items-center gap-2 ${currentStep === 'product-configuration' ? 'text-primary' : 'text-muted-foreground'}`}>
                <div className={`w-8 h-8 rounded-full flex items-center justify-center border-2 ${currentStep === 'product-configuration' ? 'border-primary bg-primary text-primary-foreground' : 'border-muted'}`}>
                  3
                </div>
                <span className="font-medium">Configure</span>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Added Items Summary */}
        {quoteItems.length > 0 && (
          <Card className="mb-6">
            <CardHeader>
              <CardTitle>Quote Items ({quoteItems.length})</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                {quoteItems.map((item, index) => (
                  <div key={item.id} className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-1 sm:gap-2 text-sm">
                    <span className="font-medium">{index + 1}. {item.productName}</span>
                    <span className="text-muted-foreground text-xs sm:text-sm">
                      {item.measurement.value} {item.measurement.unit} × ${item.unitPrice.toFixed(2)} = ${item.lineTotal.toFixed(2)}
                    </span>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        )}

        {/* Workflow Steps */}
        {currentStep === 'product-selection' && contractorId && (
          <div ref={el => stepRefs.current['product-selection'] = el}>
            <ProductSelector
              contractorId={contractorId}
              categories={categories}
              settings={settings}
              onProductSelect={handleProductSelect}
            />
          </div>
        )}

        {currentStep === 'measurement' && currentProductId && (
          <div ref={el => stepRefs.current['measurement'] = el}>
            <Card>
              <CardHeader>
                <div className="flex justify-between items-center">
                  <CardTitle>Measure Area or Distance</CardTitle>
                  <Button variant="outline" onClick={handleBack}>
                    <ArrowLeft className="h-4 w-4 mr-2" />
                    Change Product
                  </Button>
                </div>
              </CardHeader>
              <CardContent>
                <MeasurementTools
                  contractorId={contractorId!}
                  productId={currentProductId}
                  onMeasurementComplete={handleMeasurementComplete}
                  onNext={() => setCurrentStep('product-configuration')}
                  customerAddress={getCustomerAddress()}
                  existingQuoteItems={quoteItems.map(item => ({
                    id: item.id,
                    productName: item.productName,
                    customName: item.notes,
                    measurement: item.measurement,
                  }))}
                />
              </CardContent>
            </Card>
          </div>
        )}

        {currentStep === 'product-configuration' && currentProductId && currentMeasurement && (
          <div ref={el => stepRefs.current['product-configuration'] = el}>
            <Card>
              <CardHeader>
                <div className="flex justify-between items-center">
                  <CardTitle>Configure Product</CardTitle>
                  <Button variant="outline" onClick={handleBack}>
                    <ArrowLeft className="h-4 w-4 mr-2" />
                    Re-measure
                  </Button>
                </div>
              </CardHeader>
              <CardContent>
                <ProductConfiguration
                  contractorId={contractorId!}
                  productId={currentProductId}
                  measurement={currentMeasurement}
                  settings={settings}
                  onAddToQuote={handleAddToQuote}
                  onRemove={() => {
                    setCurrentProductId(undefined);
                    setCurrentMeasurement(undefined);
                    setCurrentStep('product-selection');
                  }}
                />
              </CardContent>
            </Card>
          </div>
        )}
      </main>
    </div>
  );
}
