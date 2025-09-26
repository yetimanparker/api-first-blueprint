import { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Loader2 } from 'lucide-react';
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

  const setCurrentProduct = (productId: string) => {
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
      <div className="container mx-auto px-4 py-8 max-w-4xl">
        {/* Header with Branding */}
        <div className="mb-8 text-center">
          <div 
            className="inline-block px-6 py-3 rounded-full text-white font-semibold text-lg mb-4"
            style={{ backgroundColor: brandColor }}
          >
            {contractorInfo?.business_name || 'Professional Services'}
          </div>
          <h1 className="text-4xl font-bold text-foreground mb-2">
            {contractorInfo?.business_name || 'Professional Services'}
          </h1>
          <p className="text-muted-foreground text-lg">Professional outdoor services</p>
        </div>

        {/* Step Indicators */}
        <div className="mb-8">
          <div className="flex flex-col space-y-4">
            {stepConfig.map((step, index) => {
              const isActive = index === currentStepIndex;
              const isCompleted = index < currentStepIndex;
              const isAccessible = index <= currentStepIndex;
              
              return (
                <div
                  key={step.key}
                  className={`flex items-center p-4 rounded-lg border transition-all ${
                    isActive 
                      ? 'border-primary bg-primary/5 shadow-md' 
                      : isCompleted
                      ? 'border-success bg-success/5'
                      : 'border-border bg-card'
                  }`}
                >
                  <div
                    className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-semibold ${
                      isActive 
                        ? 'bg-primary text-primary-foreground' 
                        : isCompleted
                        ? 'bg-success text-success-foreground'
                        : 'bg-muted text-muted-foreground'
                    }`}
                  >
                    {isCompleted ? '✓' : index + 1}
                  </div>
                  <h3 className={`ml-4 font-medium ${isActive ? 'text-primary' : isCompleted ? 'text-success' : 'text-muted-foreground'}`}>
                    {step.label}
                  </h3>
                  {isActive && <span className="ml-auto text-sm text-muted-foreground">Current Step</span>}
                </div>
              );
            })}
          </div>
        </div>

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