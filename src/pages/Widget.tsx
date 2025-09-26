import { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Loader2 } from 'lucide-react';
import { useGlobalSettings } from '@/hooks/useGlobalSettings';
import { useProductCategories } from '@/hooks/useGlobalSettings';
import { useServiceArea } from '@/hooks/useServiceArea';
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
  
  const { settings, loading: settingsLoading, error: settingsError } = useGlobalSettings();
  const { categories, loading: categoriesLoading } = useProductCategories();
  const { validateServiceArea, isValidating } = useServiceArea();

  const [widgetState, setWidgetState] = useState<WidgetState>({
    contractorId: contractorId!,
    currentStep: 'product-selection', // Will be updated based on settings
    customerInfo: {},
    quoteItems: [],
  });

  const [isLoading, setIsLoading] = useState(false);

  // Initialize workflow based on contractor settings
  useEffect(() => {
    if (settings && !settingsLoading) {
      const initialStep: WorkflowStep = 'product-selection';
      
      setWidgetState(prev => ({
        ...prev,
        currentStep: initialStep
      }));
    }
  }, [settings, settingsLoading]);

  // Handle service area validation when customer provides address
  useEffect(() => {
    const validateCustomerArea = async () => {
      if (widgetState.customerInfo.address && contractorId) {
        const result = await validateServiceArea({
          contractor_id: contractorId,
          customer_address: widgetState.customerInfo.address,
          customer_zip: widgetState.customerInfo.zipCode,
        });

        setWidgetState(prev => ({
          ...prev,
          isServiceAreaValid: result?.valid || false
        }));

        if (result && !result.valid) {
          toast({
            title: "Service Area Notice",
            description: result.message,
            variant: "destructive",
          });
        }
      }
    };

    validateCustomerArea();
  }, [widgetState.customerInfo.address, widgetState.customerInfo.zipCode, contractorId, settings, validateServiceArea, toast]);

  const updateCustomerInfo = (info: Partial<CustomerInfo>) => {
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

  const setCurrentProduct = (productId: string) => {
    setWidgetState(prev => ({
      ...prev,
      currentProductId: productId,
      currentStep: 'measurement'
    }));
  };

  const nextStep = () => {
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

    setWidgetState(prev => ({
      ...prev,
      currentStep: stepFlow[prev.currentStep]
    }));
  };

  const goToProductSelection = () => {
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
  const brandStyle = {
    '--primary': `hsl(${settings.widget_theme_color || '#3B82F6'})`,
  } as React.CSSProperties;

  return (
    <div className="min-h-screen bg-background" style={brandStyle}>
      <div className="container mx-auto px-4 py-8 max-w-4xl">
        <div className="mb-8 text-center">
          <h1 className="text-3xl font-bold text-foreground mb-2">Get Your Quote</h1>
          <p className="text-muted-foreground">Fast, accurate estimates for your project</p>
        </div>

        {/* Progress indicator */}
        <div className="mb-8">
          <div className="flex justify-between items-center mb-2">
            <span className="text-sm text-muted-foreground">Progress</span>
            <span className="text-sm text-muted-foreground">
              {widgetState.currentStep === 'confirmation' ? '100' : Math.round((getStepIndex(widgetState.currentStep) / 7) * 100)}%
            </span>
          </div>
          <div className="w-full bg-secondary rounded-full h-2">
            <div 
              className="bg-primary h-2 rounded-full transition-all duration-300"
              style={{ 
                width: `${widgetState.currentStep === 'confirmation' ? 100 : (getStepIndex(widgetState.currentStep) / 7) * 100}%` 
              }}
            />
          </div>
        </div>

        {/* Step content */}
        {widgetState.currentStep === 'contact-before' && (
          <ContactForm
            customerInfo={widgetState.customerInfo}
            onUpdate={updateCustomerInfo}
            onNext={nextStep}
            settings={settings}
            isServiceAreaValid={widgetState.isServiceAreaValid}
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

        {widgetState.currentStep === 'measurement' && widgetState.currentProductId && (
          <MeasurementTools
            productId={widgetState.currentProductId}
            onMeasurementComplete={updateCurrentMeasurement}
            onNext={() => setWidgetState(prev => ({ ...prev, currentStep: 'product-configuration' }))}
            customerAddress={widgetState.customerInfo.address}
          />
        )}

        {widgetState.currentStep === 'product-configuration' && 
         widgetState.currentProductId && 
         widgetState.currentMeasurement && (
          <ProductConfiguration
            productId={widgetState.currentProductId}
            measurement={widgetState.currentMeasurement}
            onAddToQuote={addQuoteItem}
            settings={settings}
          />
        )}

        {widgetState.currentStep === 'add-another-check' && (
          <Card className="p-8 text-center">
            <h3 className="text-xl font-semibold mb-4">Item Added to Quote</h3>
            <p className="text-muted-foreground mb-6">
              Would you like to add another product to your quote?
            </p>
            <div className="flex flex-col sm:flex-row gap-4 justify-center">
              <Button onClick={goToProductSelection} variant="default">
                Add Another Product
              </Button>
              <Button onClick={nextStep} variant="outline">
                Continue to Review
              </Button>
            </div>
          </Card>
        )}

        {widgetState.currentStep === 'contact-after' && (
          <ContactForm
            customerInfo={widgetState.customerInfo}
            onUpdate={updateCustomerInfo}
            onNext={nextStep}
            settings={settings}
            isServiceAreaValid={widgetState.isServiceAreaValid}
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