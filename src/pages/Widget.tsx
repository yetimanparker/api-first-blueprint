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
import QuoteSuccess from '@/components/widget/QuoteSuccess';
import { WidgetState, WorkflowStep, CustomerInfo, QuoteItem, MeasurementData } from '@/types/widget';

const Widget = () => {
  const { contractorId } = useParams<{ contractorId: string }>();
  const { toast } = useToast();
  const navigate = useNavigate();
  
  const { settings, loading: settingsLoading, error: settingsError } = useGlobalSettings(contractorId);
  const { categories, loading: categoriesLoading } = useProductCategories(contractorId);

  const [widgetState, setWidgetState] = useState<WidgetState>({
    contractorId: contractorId!,
    currentStep: 'product-selection', // Will be updated by useEffect based on settings
    customerInfo: {},
    quoteItems: [],
  });

  const [contractorInfo, setContractorInfo] = useState<any>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [selectedProduct, setSelectedProduct] = useState<any>(null);
  const [submittedQuoteNumber, setSubmittedQuoteNumber] = useState<string | null>(null);
  const [submittedProjectComments, setSubmittedProjectComments] = useState<string>('');

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
      const initialStep: WorkflowStep = settings.contact_capture_timing === 'before_quote' 
        ? 'contact-before' 
        : 'product-selection';
      
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

  // Auto-scroll to current step with debugging
  useEffect(() => {
    console.log('🔄 Step changed to:', widgetState.currentStep);
    
    const scrollToStep = () => {
      // For product-selection step, scroll to show categories at top
      if (widgetState.currentStep === 'product-selection') {
        console.log('📍 Attempting to scroll to product-selection');
        let attempts = 0;
        const maxAttempts = 15;
        
        const attemptScroll = () => {
          const productSection = document.getElementById('step-product-selection');
          console.log(`🔍 Attempt ${attempts + 1}: Element found:`, !!productSection);
          
          if (productSection) {
            // Get the sticky header height
            const header = document.querySelector('.sticky.top-0');
            const headerHeight = header?.getBoundingClientRect().height || 0;
            
            console.log('📏 Header height:', headerHeight);
            console.log('📐 Current scroll position:', window.pageYOffset);
            
            // Get absolute position of product section
            const rect = productSection.getBoundingClientRect();
            const absolutePosition = rect.top + window.pageYOffset;
            
            console.log('📍 Product section absolute position:', absolutePosition);
            console.log('📍 Product section viewport position:', rect.top);
            
            // Scroll to position the product section right below header
            const targetScroll = absolutePosition - headerHeight;
            
            console.log('🎯 Scrolling to position:', targetScroll);
            
            window.scrollTo({
              top: targetScroll,
              behavior: 'smooth'
            });
          } else if (attempts < maxAttempts) {
            attempts++;
            setTimeout(attemptScroll, 100);
          } else {
            console.error('❌ Failed to find product-selection element after', maxAttempts, 'attempts');
          }
        };
        
        // Delay initial attempt to ensure DOM is ready
        setTimeout(attemptScroll, 200);
      } else if (widgetState.currentStep === 'measurement') {
        // For measurement step, scroll to show the action buttons
        setTimeout(() => {
          const actionButtonsRow = document.getElementById('action-buttons-row');
          
          if (actionButtonsRow) {
            console.log('📍 Found action buttons row, scrolling into view');
            
            // Get the sticky header height to offset scroll properly
            const header = document.querySelector('.sticky.top-0');
            const headerHeight = header?.getBoundingClientRect().height || 0;
            
            // Calculate position to scroll to
            const elementPosition = actionButtonsRow.getBoundingClientRect().top + window.pageYOffset;
            const offsetPosition = elementPosition - headerHeight - 20; // 20px extra padding
            
            window.scrollTo({
              top: offsetPosition,
              behavior: 'smooth'
            });
          } else {
            console.log('⚠️ Action buttons row not found, falling back to measurement header scroll');
            // Fallback to original behavior if action buttons not found
            const measurementHeader = document.querySelector('[class*="bg-background border-b"]') as HTMLElement;
            
            if (measurementHeader) {
              const yOffset = -100;
              const elementPosition = measurementHeader.getBoundingClientRect().top + window.pageYOffset;
              const offsetPosition = elementPosition + yOffset;
              
              window.scrollTo({
                top: offsetPosition,
                behavior: 'smooth'
              });
            }
          }
        }, 300);
      } else {
        // For other steps, use default scroll behavior
        const stepId = `step-${widgetState.currentStep}`;
        setTimeout(() => {
          const element = document.getElementById(stepId);
          if (element) {
            const header = document.querySelector('.sticky.top-0');
            const headerHeight = header?.getBoundingClientRect().height || 0;
            const elementPosition = element.getBoundingClientRect().top + window.pageYOffset;
            const offsetPosition = elementPosition - headerHeight - 20;
            
            window.scrollTo({
              top: offsetPosition,
              behavior: 'smooth'
            });
          }
        }, 200);
      }
    };
    scrollToStep();
  }, [widgetState.currentStep]);

  const updateCustomerInfo = (info: Partial<CustomerInfo>) => {
    console.log('Updating customer info:', info);
    setWidgetState(prev => ({
      ...prev,
      customerInfo: { ...prev.customerInfo, ...info }
    }));
  };

  const addQuoteItem = (item: QuoteItem) => {
    const nextStep = settings.contact_capture_timing === 'after_quote' 
      ? 'contact-after' 
      : 'quote-review';
    
    setWidgetState(prev => ({
      ...prev,
      quoteItems: [...prev.quoteItems, item],
      currentStep: nextStep
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

  const resetToMeasurement = () => {
    console.log('Resetting to measurement step, clearing current measurement');
    setWidgetState(prev => ({
      ...prev,
      currentStep: 'measurement',
      currentMeasurement: undefined
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

  const handleQuoteSubmitted = (quoteNumber: string) => {
    setSubmittedQuoteNumber(quoteNumber);
    setWidgetState(prev => ({
      ...prev,
      currentStep: 'confirmation'
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
    { key: 'product-selection', label: '1. Select Your Products', active: false },
    { key: 'measurement', label: '2. Measure Your Project', active: false },
    { key: 'quote-review', label: '3. Review Your Quote', active: false }
  ];

  const currentStepIndex = stepConfig.findIndex(step => {
    if (step.key === 'contact-before') return ['contact-before', 'contact-after'].includes(widgetState.currentStep);
    if (step.key === 'product-selection') return ['product-selection'].includes(widgetState.currentStep);
    if (step.key === 'measurement') return ['measurement', 'product-configuration', 'add-another-check'].includes(widgetState.currentStep);
    if (step.key === 'quote-review') return ['project-comments', 'quote-review', 'confirmation'].includes(widgetState.currentStep);
    return false;
  });

  // Helper to check if a step should be visible
  const isStepVisible = (step: WorkflowStep): boolean => {
    const stepOrder: WorkflowStep[] = [
      'contact-before', 'product-selection', 'measurement', 'product-configuration',
      'add-another-check', 'contact-after', 'project-comments', 'quote-review', 'confirmation'
    ];
    const currentIndex = stepOrder.indexOf(widgetState.currentStep);
    const stepIndex = stepOrder.indexOf(step);
    return stepIndex <= currentIndex;
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-background to-muted/30" style={brandStyle}>
      {/* Header with Steps */}
      <div className="border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60 sticky top-0 z-50">
        <div className="container mx-auto px-4 py-4">
          <div className="flex items-center justify-between gap-4">
            {stepConfig.map((step, index) => (
              <div key={step.key} className="flex items-center gap-2 flex-1">
                <div className={`flex items-center gap-2 ${index <= currentStepIndex ? 'opacity-100' : 'opacity-40'}`}>
                  <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-medium ${
                    index <= currentStepIndex ? 'bg-primary text-primary-foreground' : 'bg-muted text-muted-foreground'
                  }`}>
                    {index + 1}
                  </div>
                  <span className="text-sm font-medium hidden sm:inline">{step.label}</span>
                </div>
                {index < stepConfig.length - 1 && (
                  <div className={`flex-1 h-1 rounded ${index < currentStepIndex ? 'bg-primary' : 'bg-muted'}`} />
                )}
              </div>
            ))}
          </div>
        </div>
      </div>
      
      <div className="max-w-[1920px] mx-auto">
        {/* Contact Form Section */}
        {isStepVisible('contact-before') && settings.contact_capture_timing === 'before_quote' && (
          <div id="step-contact-before" className="px-4 py-6">
            <ContactForm
              customerInfo={widgetState.customerInfo}
              onUpdate={updateCustomerInfo}
              onNext={nextStep}
              settings={settings}
              isServiceAreaValid={isServiceAreaValid}
              isValidating={isValidating}
            />
          </div>
        )}

        {/* Product Selection Section */}
        {isStepVisible('product-selection') && !widgetState.currentProductId && (
          <div id="step-product-selection" className="w-full py-6">
            <ProductSelector
              categories={categories}
              onProductSelect={setCurrentProduct}
              settings={settings}
              contractorId={contractorId!}
            />
          </div>
        )}

        {/* Measurement Section - Full width, always visible once reached */}
        {isStepVisible('measurement') && widgetState.currentProductId && (
          <div id="step-measurement" className="w-full mb-2">
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
              onResetToMeasurement={resetToMeasurement}
              onAddressSelect={(address) => {
                updateCustomerInfo({
                  address: `${address.streetAddress}, ${address.city}, ${address.state} ${address.zipCode}`,
                  city: address.city,
                  state: address.state,
                  zipCode: address.zipCode,
                  lat: address.lat,
                  lng: address.lng
                });
              }}
            />
          </div>
        )}
        
        {/* Product Configuration Section - Appears below map */}
        {isStepVisible('product-configuration') && widgetState.currentMeasurement && (
          <div id="step-product-configuration" className="px-4 py-0 bg-background">
            <ProductConfiguration
              productId={widgetState.currentProductId!}
              measurement={widgetState.currentMeasurement}
              onAddToQuote={addQuoteItem}
              settings={settings}
              onRemove={goToProductSelection}
            />
          </div>
        )}

        {/* Contact After Section */}
        {isStepVisible('contact-after') && settings.contact_capture_timing === 'after_quote' && (
          <div id="step-contact-after" className="px-4 py-6">
            <ContactForm
              customerInfo={widgetState.customerInfo}
              onUpdate={updateCustomerInfo}
              onNext={nextStep}
              settings={settings}
              isServiceAreaValid={isServiceAreaValid}
              isValidating={isValidating}
            />
          </div>
        )}

        {/* Quote Review Section - Only show when actually on review step */}
        {(widgetState.currentStep === 'quote-review' || widgetState.currentStep === 'project-comments') && (
          <div id="step-quote-review" className="px-4 py-4 mt-2">
            <QuoteReview
              key={`review-${widgetState.quoteItems.length}-${Date.now()}`}
              quoteItems={widgetState.quoteItems}
              customerInfo={widgetState.customerInfo}
              contractorId={contractorId!}
              settings={settings}
              currentStep={widgetState.currentStep}
              onNext={nextStep}
              onUpdateComments={(comments) => {
                setSubmittedProjectComments(comments);
                setWidgetState(prev => ({ 
                  ...prev, 
                  quoteSummary: { ...prev.quoteSummary!, projectComments: comments }
                }));
              }}
              onUpdateCustomerInfo={updateCustomerInfo}
              onAddAnother={goToProductSelection}
              onRemoveItem={(itemId) => {
                console.log('🗑️ Deleting item:', itemId);
                console.log('📋 Current quote items:', widgetState.quoteItems.length);
                const remainingItems = widgetState.quoteItems.filter(item => item.id !== itemId);
                console.log('📋 Remaining items after delete:', remainingItems.length);
                setWidgetState(prev => ({
                  ...prev,
                  quoteItems: remainingItems
                }));
                // If no items left, go back to product selection
                if (remainingItems.length === 0) {
                  console.log('⚠️ No items left, going back to product selection');
                  goToProductSelection();
                }
              }}
              onQuoteSubmitted={handleQuoteSubmitted}
            />
          </div>
        )}

        {/* Quote Success Section */}
        {widgetState.currentStep === 'confirmation' && submittedQuoteNumber && (
          <div id="step-confirmation" className="px-4 py-6">
            <QuoteSuccess
              quoteNumber={submittedQuoteNumber}
              quoteItems={widgetState.quoteItems}
              customerInfo={widgetState.customerInfo}
              contractorId={contractorId!}
              settings={settings}
              projectComments={submittedProjectComments}
            />
          </div>
        )}

        {/* Confirmation Section */}
        {isStepVisible('confirmation') && (
          <div id="step-confirmation" className="px-4 py-6">
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
          </div>
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