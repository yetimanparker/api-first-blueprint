import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Loader2, ArrowLeft } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useGlobalSettings } from '@/hooks/useGlobalSettings';
import { useProductCategories } from '@/hooks/useGlobalSettings';
import { useDebouncedServiceArea } from '@/hooks/useDebouncedServiceArea';
import { useToast } from '@/hooks/use-toast';
import ContactForm from '@/components/widget/ContactForm';
import ProductSelector from '@/components/widget/ProductSelector';
import MeasurementTools from '@/components/widget/MeasurementTools';
import ProductConfiguration from '@/components/widget/ProductConfiguration';
import QuoteReview from '@/components/widget/QuoteReview';
import { WidgetState, WorkflowStep, CustomerInfo, QuoteItem, MeasurementData } from '@/types/widget';

const Widget = () => {
  const { contractorId } = useParams<{ contractorId: string }>();
  const { toast } = useToast();
  const navigate = useNavigate();
  
  const { settings, loading: settingsLoading, error: settingsError } = useGlobalSettings();
  const { categories, loading: categoriesLoading } = useProductCategories();

  const [widgetState, setWidgetState] = useState<WidgetState>({
    contractorId: contractorId!,
    currentStep: 'contact-before', // Start with contact based on settings
    customerInfo: {},
    quoteItems: [],
  });

  const [contractorInfo, setContractorInfo] = useState<any>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [selectedProduct, setSelectedProduct] = useState<any>(null);

  // Use debounced service area validation
  const { isServiceAreaValid, isValidating, manualValidate } = useDebouncedServiceArea({
    customerInfo: widgetState.customerInfo,
    contractorId: contractorId || '',
    delay: 1500
  });

  // Fetch contractor information for branding
  useEffect(() => {
    const fetchContractor = async () => {
      if (contractorId) {
        const { data } = await supabase
          .from('contractors')
          .select('business_name, brand_color, secondary_color')
          .eq('id', contractorId)
          .single();
        
        setContractorInfo(data);
      }
    };
    fetchContractor();
  }, [contractorId]);

  // Initialize workflow based on contractor settings
  useEffect(() => {
    if (settings && !settingsLoading) {
      const initialStep: WorkflowStep = settings.contact_capture_timing === 'after_quote' 
        ? 'product-selection' 
        : 'contact-before';
      
      console.log('Initializing widget with step:', initialStep);
      console.log('Settings:', settings);
      
      setWidgetState(prev => ({
        ...prev,
        currentStep: initialStep
      }));
    }
  }, [settings, settingsLoading]);

  // Handle service area validation results with toast notifications
  useEffect(() => {
    if (isServiceAreaValid === true) {
      toast({
        title: "Service Area Confirmed",
        description: "Address is within our service area",
        variant: "default",
      });
    } else if (isServiceAreaValid === false) {
      toast({
        title: "Service Area Notice", 
        description: "This address may be outside our service area. We'll verify during quote review.",
        variant: "destructive",
      });
    }
  }, [isServiceAreaValid, toast]);

  const updateCustomerInfo = (info: Partial<CustomerInfo>) => {
    console.log('Updating customer info:', info);
    setWidgetState(prev => ({
      ...prev,
      customerInfo: { ...prev.customerInfo, ...info }
    }));
  };

  const addQuoteItem = (item: QuoteItem) => {
    setWidgetState(prev => ({
      ...prev,
      quoteItems: [...prev.quoteItems, item],
      currentStep: 'add-another-check'
    }));
  };

  const updateCurrentMeasurement = (measurement: MeasurementData) => {
    setWidgetState(prev => ({
      ...prev,
      currentMeasurement: measurement
    }));
  };

  const setCurrentProduct = async (productId: string) => {
    // Fetch product details to display in UI
    const { data: productData } = await supabase
      .from('products')
      .select('id, name, description, unit_type, unit_price')
      .eq('id', productId)
      .single();
    
    setSelectedProduct(productData);
    setWidgetState(prev => ({
      ...prev,
      currentProductId: productId,
      currentStep: 'measurement'
    }));
  };

  const nextStep = () => {
    console.log('Moving to next step from:', widgetState.currentStep);
    console.log('Current widget state:', widgetState);
    
    const stepFlow: Record<WorkflowStep, WorkflowStep> = {
      'contact-before': 'product-selection',
      'product-selection': 'measurement',
      'measurement': 'product-configuration',
      'product-configuration': 'add-another-check',
      'add-another-check': 'project-comments',
      'project-comments': 'quote-review',
      'contact-after': 'quote-review',
      'quote-review': 'confirmation',
      'confirmation': 'confirmation'
    };

    const nextStepValue = stepFlow[widgetState.currentStep];
    console.log('Next step will be:', nextStepValue);

    // Force state update and log it
    setWidgetState(prev => {
      const newState = {
        ...prev,
        currentStep: nextStepValue
      };
      console.log('State updated to:', newState);
      return newState;
    });
  };

  const goToProductSelection = () => {
    setSelectedProduct(null);
    setWidgetState(prev => ({
      ...prev,
      currentStep: 'product-selection',
      currentProductId: undefined,
      currentMeasurement: undefined
    }));
  };

  if (settingsLoading || categoriesLoading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center p-4">
        <Card className="w-full max-w-md p-8 text-center">
          <Loader2 className="h-8 w-8 animate-spin mx-auto mb-4 text-primary" />
          <p className="text-muted-foreground">Loading widget...</p>
        </Card>
      </div>
    );
  }

  if (settingsError || !settings) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center p-4">
        <Card className="w-full max-w-md p-8 text-center">
          <h2 className="text-xl font-semibold text-destructive mb-2">Widget Unavailable</h2>
          <p className="text-muted-foreground">Unable to load contractor settings. Please check the URL and try again.</p>
        </Card>
      </div>
    );
  }

  // Apply contractor branding
  const brandColor = contractorInfo?.brand_color || settings?.widget_theme_color || '#3B82F6';
  const brandStyle = {
    '--primary': brandColor,
  } as React.CSSProperties;

  const stepConfig = [
    { key: 'contact-before', label: '1. Contact Information', active: true },
    { key: 'product-selection', label: '2. Select Your Products', active: false },
    { key: 'measurement', label: '3. Measure Your Project', active: false },
    { key: 'quote-review', label: '4. Review Your Quote', active: false }
  ];

  const currentStepIndex = stepConfig.findIndex(step => {
    if (step.key === 'contact-before') return ['contact-before', 'contact-after'].includes(widgetState.currentStep);
    if (step.key === 'product-selection') return ['product-selection'].includes(widgetState.currentStep);
    if (step.key === 'measurement') return ['measurement', 'product-configuration', 'add-another-check'].includes(widgetState.currentStep);
    if (step.key === 'quote-review') return ['project-comments', 'quote-review', 'confirmation'].includes(widgetState.currentStep);
    return false;
  });

  return (
    <div className="min-h-screen bg-gradient-to-br from-background to-muted/30" style={brandStyle}>
      {/* Header with Steps - Hidden during measurement and configuration */}
      {widgetState.currentStep !== 'measurement' && widgetState.currentStep !== 'product-configuration' && (
        <div className="border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60 sticky top-0 z-50">
...
        </div>
      )}
      
      <div className={`${(widgetState.currentStep === 'measurement' || widgetState.currentStep === 'product-configuration') ? '' : 'px-4 py-6 max-w-[1920px] mx-auto'}`}>

            {(widgetState.currentStep === 'contact-before' || widgetState.currentStep === 'contact-after') && (
              <ContactForm
                customerInfo={widgetState.customerInfo}
                onUpdate={updateCustomerInfo}
                onNext={nextStep}
                settings={settings}
                isServiceAreaValid={isServiceAreaValid}
                isValidating={isValidating}
              />
            )}

        {widgetState.currentStep === 'product-selection' && (
          <ProductSelector
            categories={categories}
            onProductSelect={setCurrentProduct}
            settings={settings}
            contractorId={contractorId!}
          />
        )}

        {(widgetState.currentStep === 'measurement' || widgetState.currentStep === 'product-configuration') && 
         widgetState.currentProductId && (
          <>
            {/* Map Section - Always full height and scrollable */}
            <div className="flex-1">
              <MeasurementTools
                productId={widgetState.currentProductId}
                onMeasurementComplete={updateCurrentMeasurement}
                onNext={() => {
                  setWidgetState(prev => ({ ...prev, currentStep: 'product-configuration' }));
                }}
                customerAddress={widgetState.customerInfo.address}
                selectedProduct={selectedProduct}
                onChangeProduct={goToProductSelection}
                isConfigurationMode={widgetState.currentStep === 'product-configuration'}
                existingQuoteItems={widgetState.quoteItems}
              />
            </div>
            
            {/* Configuration Section - Appears below map */}
            {widgetState.currentStep === 'product-configuration' && widgetState.currentMeasurement && (
              <div id="product-configuration-section" className="w-full bg-background">
                <ProductConfiguration
                  productId={widgetState.currentProductId}
                  measurement={widgetState.currentMeasurement}
                  onAddToQuote={addQuoteItem}
                  settings={settings}
                  onRemove={goToProductSelection}
                />
              </div>
            )}
          </>
        )}

        {widgetState.currentStep === 'add-another-check' && (
          <div className="space-y-4">
            {/* Quote Summary */}
            {widgetState.quoteItems.length > 0 && (
              <Card className="bg-success/5 border-success/20">
                <CardContent className="p-4">
                  <h3 className="font-semibold text-success mb-2">Items in Your Quote ({widgetState.quoteItems.length})</h3>
                  <div className="space-y-2 max-h-32 overflow-y-auto">
                    {widgetState.quoteItems.map((item, index) => (
                      <div key={item.id} className="flex justify-between items-center text-sm">
                        <span>{item.customName || item.productName}</span>
                        <span className="text-muted-foreground">
                          {item.quantity.toLocaleString()} {item.measurement.unit.replace('_', ' ')}
                        </span>
                      </div>
                    ))}
                  </div>
                  <div className="mt-3 pt-3 border-t">
                    <Button onClick={nextStep} variant="default" className="w-full">
                      Continue to Review Quote
                    </Button>
                  </div>
                </CardContent>
              </Card>
            )}
            
            {/* Show products for quick selection */}
            <Card className="p-4">
              <h3 className="text-lg font-semibold mb-3">Add Another Product</h3>
              <ProductSelector
                categories={categories}
                onProductSelect={setCurrentProduct}
                settings={settings}
                contractorId={contractorId!}
              />
            </Card>
          </div>
        )}

        {widgetState.currentStep === 'contact-after' && (
          <ContactForm
            customerInfo={widgetState.customerInfo}
            onUpdate={updateCustomerInfo}
            onNext={nextStep}
            settings={settings}
            isServiceAreaValid={isServiceAreaValid}
            isValidating={isValidating}
          />
        )}

        {(widgetState.currentStep === 'project-comments' || 
          widgetState.currentStep === 'quote-review') && (
          <QuoteReview
            quoteItems={widgetState.quoteItems}
            customerInfo={widgetState.customerInfo}
            contractorId={contractorId!}
            settings={settings}
            currentStep={widgetState.currentStep}
            onNext={nextStep}
            onUpdateComments={(comments) => 
              setWidgetState(prev => ({ 
                ...prev, 
                quoteSummary: { ...prev.quoteSummary!, projectComments: comments }
              }))
            }
            onAddAnother={goToProductSelection}
            onRemoveItem={(itemId) => {
              setWidgetState(prev => ({
                ...prev,
                quoteItems: prev.quoteItems.filter(item => item.id !== itemId)
              }));
              // If no items left, go back to product selection
              const remainingItems = widgetState.quoteItems.filter(item => item.id !== itemId);
              if (remainingItems.length === 0) {
                goToProductSelection();
              }
            }}
          />
        )}

        {widgetState.currentStep === 'confirmation' && (
          <Card className="p-8 text-center">
            <div className="w-16 h-16 bg-success rounded-full flex items-center justify-center mx-auto mb-4">
              <svg className="w-8 h-8 text-success-foreground" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
              </svg>
            </div>
            <h3 className="text-2xl font-bold mb-2">Quote Submitted Successfully!</h3>
            <p className="text-muted-foreground mb-4">
              Thank you for your interest. A representative will contact you shortly to discuss your project.
            </p>
            <p className="text-sm text-muted-foreground">
              Quote ID: {Date.now()} {/* This will be replaced with actual quote ID from backend */}
            </p>
          </Card>
        )}
      </div>
    </div>
  );
};

// Helper function to get step index for progress bar
const getStepIndex = (step: WorkflowStep): number => {
  const steps: WorkflowStep[] = [
    'contact-before', 'product-selection', 'measurement', 'product-configuration', 
    'add-another-check', 'project-comments', 'quote-review', 'contact-after'
  ];
  return steps.indexOf(step) + 1;
};

export default Widget;