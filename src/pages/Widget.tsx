import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Loader2, ArrowLeft } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useGlobalSettings } from '@/hooks/useGlobalSettings';
import { useDebouncedServiceArea } from '@/hooks/useDebouncedServiceArea';
import { useToast } from '@/hooks/use-toast';
import ContactForm from '@/components/widget/ContactForm';
import ProductSelector from '@/components/widget/ProductSelector';
import MeasurementTools from '@/components/widget/MeasurementTools';
import QuantityInputDialog from '@/components/widget/QuantityInputDialog';
import QuantityMethodDialog from '@/components/widget/QuantityMethodDialog';
import { IncrementConfirmationDialog } from '@/components/widget/IncrementConfirmationDialog';
import ProductConfiguration from '@/components/widget/ProductConfiguration';
import QuoteReview from '@/components/widget/QuoteReview';
import QuoteSuccess from '@/components/widget/QuoteSuccess';
import { AddonPlacement } from '@/components/widget/AddonPlacement';
import { ClarifyingQuestionsDialog } from '@/components/widget/ClarifyingQuestionsDialog';
import { WidgetState, WorkflowStep, CustomerInfo, QuoteItem, MeasurementData } from '@/types/widget';

const Widget = () => {
  const { contractorId } = useParams<{ contractorId: string }>();
  const { toast } = useToast();
  const navigate = useNavigate();
  
  const { settings, loading: settingsLoading, error: settingsError } = useGlobalSettings(contractorId);

  const [widgetState, setWidgetState] = useState<WidgetState>({
    contractorId: contractorId!,
    currentStep: 'product-selection', // Will be updated by useEffect based on settings
    customerInfo: {},
    quoteItems: [],
    pendingAddons: [],
  });

  const [contractorInfo, setContractorInfo] = useState<any>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [selectedProduct, setSelectedProduct] = useState<any>(null);
  const [submittedQuoteNumber, setSubmittedQuoteNumber] = useState<string | null>(null);
  const [submittedProjectComments, setSubmittedProjectComments] = useState<string>('');
  const [showMethodDialog, setShowMethodDialog] = useState(false);
  const [showAddonMethodDialog, setShowAddonMethodDialog] = useState(false);
  const [showIncrementDialog, setShowIncrementDialog] = useState(false);
  const [pendingMeasurement, setPendingMeasurement] = useState<MeasurementData | null>(null);
  const [widgetCategories, setWidgetCategories] = useState<Array<{ id: string; name: string; color_hex: string }>>([]);
  const [widgetSubcategories, setWidgetSubcategories] = useState<Array<{ id: string; category_id: string; name: string; is_active: boolean; display_order: number }>>([]);
  const [widgetProducts, setWidgetProducts] = useState<any[]>([]);
  const [clarifyingQuestions, setClarifyingQuestions] = useState<Array<{id: string; question: string; required: boolean}>>([]);
  const [clarifyingQuestionsEnabled, setClarifyingQuestionsEnabled] = useState(false);

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
          .select('business_name, brand_color, secondary_color, logo_url')
          .eq('id', contractorId)
          .single();
        
        setContractorInfo(data);
      }
    };
    fetchContractor();
  }, [contractorId]);

  // Fetch widget data (categories, subcategories, products) on mount
  useEffect(() => {
    const fetchWidgetData = async () => {
      if (!contractorId) return;
      
      try {
        const { data, error } = await supabase.functions.invoke('get-widget-products', {
          body: { contractor_id: contractorId }
        });
        
        if (error || !data?.success) {
          console.error('Failed to load widget data');
          return;
        }

        console.log('Widget data received:', {
          categoriesCount: data.categories?.length || 0,
          subcategoriesCount: data.subcategories?.length || 0,
          productsCount: data.products?.length || 0
        });
        console.log('Categories data:', data.categories);
        console.log('Subcategories data:', data.subcategories);

        // Store categories, subcategories, and products
        if (data.categories) {
          setWidgetCategories(data.categories);
        }
        if (data.subcategories) {
          setWidgetSubcategories(data.subcategories);
        }
        if (data.products) {
          setWidgetProducts(data.products);
        }
      } catch (err) {
        console.error('Error fetching widget data:', err);
      }
    };
    
    fetchWidgetData();
  }, [contractorId]);

  // Initialize workflow based on contractor settings
  useEffect(() => {
    if (settings && !settingsLoading) {
      const initialStep: WorkflowStep = settings.contact_capture_timing === 'before_quote' 
        ? 'contact-before' 
        : 'product-selection';
      
      console.log('Initializing widget with step:', initialStep);
      console.log('Settings:', settings);
      
      // Store clarifying questions settings
      console.log('🔍 Clarifying Questions Settings:', {
        enabled: settings.clarifying_questions_enabled,
        questions: settings.clarifying_questions,
        questionsLength: settings.clarifying_questions?.length
      });
      
      if (settings.clarifying_questions_enabled && settings.clarifying_questions) {
        console.log('✅ Setting clarifying questions enabled with', settings.clarifying_questions.length, 'questions');
        setClarifyingQuestionsEnabled(true);
        setClarifyingQuestions(settings.clarifying_questions as Array<{id: string; question: string; required: boolean}>);
      } else {
        console.log('❌ Clarifying questions NOT enabled or no questions found');
      }
      
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
        // For measurement step, scroll to show the action buttons with retry
        const scrollToButtons = (attempts = 0) => {
          const actionButtonsRow = document.getElementById('measurement-action-buttons');
          console.log(`📍 Widget autoscroll attempt ${attempts + 1}:`, actionButtonsRow ? 'Found' : 'Not found');
          
          if (actionButtonsRow) {
            const header = document.querySelector('.sticky.top-0');
            const headerHeight = header?.getBoundingClientRect().height || 0;
            const elementPosition = actionButtonsRow.getBoundingClientRect().top + window.pageYOffset;
            const offsetPosition = elementPosition - headerHeight - 20;
            
            window.scrollTo({
              top: offsetPosition,
              behavior: 'smooth'
            });
          } else if (attempts < 10) {
            setTimeout(() => scrollToButtons(attempts + 1), 200);
          } else {
            console.log('⚠️ Action buttons not found after 10 attempts, falling back');
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
        };
        setTimeout(() => scrollToButtons(), 300);
      } else if (widgetState.currentStep === 'product-configuration') {
        // For product-configuration, scroll to show the configuration section
        setTimeout(() => {
          const configSection = document.getElementById('step-product-configuration');
          if (configSection) {
            console.log('📍 Found product-configuration section, scrolling into view');
            const header = document.querySelector('.sticky.top-0');
            const headerHeight = header?.getBoundingClientRect().height || 0;
            const elementPosition = configSection.getBoundingClientRect().top + window.pageYOffset;
            const offsetPosition = elementPosition - headerHeight - 20;
            
            window.scrollTo({
              top: offsetPosition,
              behavior: 'smooth'
            });
          }
        }, 300);
      } else if (widgetState.currentStep === 'addon-placement') {
        // For addon-placement, scroll to the map area
        setTimeout(() => {
          const measurementSection = document.getElementById('step-measurement');
          if (measurementSection) {
            console.log('📍 Found measurement section for addon placement, scrolling into view');
            const header = document.querySelector('.sticky.top-0');
            const headerHeight = header?.getBoundingClientRect().height || 0;
            const elementPosition = measurementSection.getBoundingClientRect().top + window.pageYOffset;
            const offsetPosition = elementPosition - headerHeight - 10;
            
            window.scrollTo({
              top: offsetPosition,
              behavior: 'smooth'
            });
          }
        }, 300);
      } else if (widgetState.currentStep === 'quote-review') {
        // For quote-review, scroll to show the Total and buttons
        setTimeout(() => {
          const totalSection = document.getElementById('quote-summary-total');
          if (totalSection) {
            const header = document.querySelector('.sticky.top-0');
            const headerHeight = header?.getBoundingClientRect().height || 0;
            const elementPosition = totalSection.getBoundingClientRect().top + window.pageYOffset;
            // Scroll to show the total with some padding, but ensure buttons are visible
            const offsetPosition = elementPosition - headerHeight - 100;
            
            window.scrollTo({
              top: offsetPosition,
              behavior: 'smooth'
            });
          } else {
            // Fallback to default behavior if element not found
            const stepId = `step-${widgetState.currentStep}`;
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

  const addQuoteItem = (item: QuoteItem | QuoteItem[]) => {
    const items = Array.isArray(item) ? item : [item];
    console.log('🟢 Widget.addQuoteItem called with items:', items.length);
    
    // Finalize the measurement (make nodes non-editable) before adding to quote
    if ((window as any).__finalizeMeasurement) {
      (window as any).__finalizeMeasurement();
      console.log('✅ Finalized measurement - nodes made non-editable');
    }
    
    const nextStep = settings.contact_capture_timing === 'after_quote' 
      ? 'contact-after' 
      : 'quote-review';
    
    console.log('🔄 Transitioning from product-configuration to:', nextStep);
    
    setWidgetState(prev => ({
      ...prev,
      quoteItems: [...prev.quoteItems, ...items],
      currentStep: nextStep,
      // Clear pending state after adding to quote
      pendingAddons: [],
      currentMainProductItem: undefined,
      pendingAddon: undefined
    }));
  };

  const updateCurrentMeasurement = async (measurement: MeasurementData) => {
    console.log('🔵 Widget.updateCurrentMeasurement called with:', {
      isDimensional: measurement.isDimensional,
      centerPoint: measurement.centerPoint,
      rotation: measurement.rotation,
      value: measurement.value,
      coordinates: measurement.coordinates?.length
    });
    
    // Check if selected product requires increment confirmation
    if (selectedProduct?.sold_in_increments_of) {
      setPendingMeasurement(measurement);
      setShowIncrementDialog(true);
    } else {
      // Normal flow - go directly to configuration
      setWidgetState(prev => {
        console.log('🟢 Updating widgetState.currentMeasurement');
        return {
          ...prev,
          currentMeasurement: measurement,
          currentStep: prev.currentStep === 'product-configuration' ? prev.currentStep : 'product-configuration'
        };
      });
    }
  };

  const setCurrentProduct = async (productId: string) => {
    try {
      // Fetch product details using secure edge function
      const { data, error } = await supabase.functions.invoke('get-widget-products', {
        body: { contractor_id: contractorId }
      });
      
      if (error || !data?.success) {
        throw new Error('Failed to load product details');
      }
      
      const productData = data.products.find((p: any) => p.id === productId);
      
      if (!productData) {
        throw new Error('Product not found');
      }
      
      setSelectedProduct(productData);
      
      setWidgetState(prev => ({
        ...prev,
        currentProductId: productId,
      }));
      
      // For 'each' products, show method selection dialog
      if (productData.unit_type === 'each') {
        setShowMethodDialog(true);
      } else {
        // Other manual input products go straight to quantity input
        const manualInputUnits = ['ton', 'pound', 'pallet', 'hour'];
        const requiresManualInput = manualInputUnits.includes(productData.unit_type);
        
        const nextStep = requiresManualInput ? 'quantity-input' : 'measurement';
        
        setWidgetState(prev => ({
          ...prev,
          currentStep: nextStep
        }));
      }
    } catch (error) {
      console.error('Error fetching product:', error);
      toast({
        title: "Error",
        description: "Failed to load product details",
        variant: "destructive",
      });
    }
  };

  const handleMethodSelect = (method: 'manual' | 'map') => {
    setShowMethodDialog(false);
    const nextStep = method === 'manual' ? 'quantity-input' : 'measurement';
    setWidgetState(prev => ({
      ...prev,
      currentStep: nextStep
    }));
  };

  const handleAddonMethodSelect = (method: 'manual' | 'map') => {
    setShowAddonMethodDialog(false);
    const nextStep = method === 'manual' ? 'addon-quantity-input' : 'addon-placement';
    setWidgetState(prev => ({
      ...prev,
      currentStep: nextStep
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
      'quantity-input': 'product-configuration',
      'measurement': 'product-configuration',
      'product-configuration': 'addon-placement', // May skip to add-another-check if no map-placeable addons
      'addon-placement': 'add-another-check',
      'addon-quantity-input': 'add-another-check',
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
      currentMeasurement: undefined,
      pendingAddon: undefined,
      currentMainProductItem: undefined,
      pendingAddons: []
    }));
  };

  const handleIncrementConfirm = (roundedQuantity: number, unitsNeeded: number) => {
    if (pendingMeasurement && selectedProduct) {
      const updatedMeasurement: MeasurementData = {
        ...pendingMeasurement,
        value: roundedQuantity, // 900 SF (the rounded amount)
        originalMeasurement: pendingMeasurement.value, // 700 SF (what they measured)
        wasRoundedForIncrements: true,
        incrementsApplied: {
          incrementSize: selectedProduct.sold_in_increments_of!,
          incrementLabel: selectedProduct.increment_unit_label || 'unit',
          unitsNeeded: unitsNeeded // 2 (number of pallets, for display only)
        }
      };
      
      setWidgetState(prev => ({
        ...prev,
        currentMeasurement: updatedMeasurement,
        currentStep: 'product-configuration'
      }));
    }
    setShowIncrementDialog(false);
    setPendingMeasurement(null);
  };

  const handleRemeasure = () => {
    setShowIncrementDialog(false);
    setPendingMeasurement(null);
    // Stay on measurement step
  };

  const handleQuoteSubmitted = (quoteNumber: string) => {
    setSubmittedQuoteNumber(quoteNumber);
    setWidgetState(prev => ({
      ...prev,
      currentStep: 'confirmation'
    }));
  };

  if (settingsLoading) {
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
      'contact-before',
      'product-selection',
      'quantity-input',
      'measurement',
      'product-configuration',
      'addon-placement',
      'addon-quantity-input',
      'add-another-check',
      'contact-after',
      'project-comments',
      'quote-review',
      'confirmation',
    ];
    const currentIndex = stepOrder.indexOf(widgetState.currentStep);
    const stepIndex = stepOrder.indexOf(step);
    
    // Special handling: product-selection should always be visible after contact-before is complete
    if (step === 'product-selection' && currentIndex >= stepOrder.indexOf('product-selection')) {
      return true;
    }
    
    return stepIndex <= currentIndex;
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-background to-muted/30" style={brandStyle}>
      {/* Business Header - Hide on confirmation step */}
      {contractorInfo && widgetState.currentStep !== 'confirmation' && (
        <div 
          className="py-4 px-6 shadow-sm"
          style={{ 
            backgroundColor: contractorInfo.brand_color || '#3B82F6',
          }}
        >
          <div className="flex items-center justify-center gap-3">
            {contractorInfo.logo_url && (
              <img 
                src={contractorInfo.logo_url} 
                alt={`${contractorInfo.business_name} logo`}
                className="h-16 w-auto max-w-[300px] object-contain"
              />
            )}
            <h1 className="text-2xl font-bold text-white">
              {contractorInfo.business_name}
            </h1>
          </div>
        </div>
      )}
      
      <div className="max-w-[1920px] mx-auto">
        {/* Contact Form Section - Only show when actively on this step */}
        {widgetState.currentStep === 'contact-before' && settings.contact_capture_timing === 'before_quote' && (
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
        {isStepVisible('product-selection') && !widgetState.currentProductId && widgetState.currentStep !== 'confirmation' && (
          <div id="step-product-selection" className="w-full py-6">
            <ProductSelector
              categories={widgetCategories}
              subcategories={widgetSubcategories}
              onProductSelect={setCurrentProduct}
              settings={settings}
              contractorId={contractorId!}
            />
          </div>
        )}

        {/* Quantity Input Section - For 'each' type products */}
        {isStepVisible('quantity-input') && widgetState.currentStep === 'quantity-input' && selectedProduct && (
          <QuantityInputDialog
            open={true}
            productId={widgetState.currentProductId!}
            productName={selectedProduct.name}
            productImage={selectedProduct.photo_url}
            unitType={selectedProduct.unit_type}
            minQuantity={selectedProduct.min_order_quantity || 1}
            onQuantitySet={(quantity, measurement) => {
              updateCurrentMeasurement(measurement);
              nextStep();
            }}
            onCancel={() => {
              goToProductSelection();
            }}
          />
        )}

        {/* Measurement / Add-on Placement Section - shared map area */}
        {isStepVisible('measurement') && widgetState.currentProductId && widgetState.currentStep !== 'confirmation' && (
          <div id="step-measurement" className="w-full mb-2">
            {widgetState.currentStep === 'addon-placement' && widgetState.pendingAddon && widgetState.currentMainProductItem ? (
              <AddonPlacement
                addonName={widgetState.pendingAddon.addonName}
                linkedProductId={widgetState.pendingAddon.linkedProductId}
                mainProductMeasurement={widgetState.currentMainProductItem.measurement}
                customerAddress={widgetState.customerInfo.address}
                onComplete={(locations, productColor) => {
                  const addonProductId = widgetState.pendingAddon!.linkedProductId || widgetState.currentMainProductItem!.productId;
                  const addonProductName = widgetState.pendingAddon!.linkedProductId
                    ? widgetState.pendingAddon!.addonName
                    : `${widgetState.currentMainProductItem!.productName} - ${widgetState.pendingAddon!.addonName}`;

                  const newAddonItems = locations.map((location, index) => ({
                    id: `addon-${Date.now()}-${index}`,
                    productId: addonProductId,
                    productName: addonProductName,
                    unitType: 'each' as const,
                    measurement: {
                      type: 'point' as const,
                      value: 1,
                      unit: 'each',
                      pointLocations: [location],
                      centerPoint: location,
                      mapColor: productColor,
                    },
                    unitPrice: widgetState.pendingAddon!.priceValue,
                    quantity: 1,
                    lineTotal: widgetState.pendingAddon!.priceValue,
                    parentQuoteItemId: widgetState.currentMainProductItem!.id,
                    addonId: widgetState.pendingAddon!.addonId,
                    isAddonItem: true,
                    variations: widgetState.pendingAddon!.selectedVariations,
                  }));

                  setWidgetState(prev => ({
                    ...prev,
                    pendingAddons: [...(prev.pendingAddons || []), ...newAddonItems],
                    pendingAddon: undefined,
                    currentStep: 'product-configuration',
                  }));
                }}
                onCancel={() => {
                  setWidgetState(prev => ({
                    ...prev,
                    pendingAddon: undefined,
                    currentStep: 'product-configuration',
                  }));
                }}
              />
            ) : (
              <MeasurementTools
                contractorId={contractorId!}
                productId={widgetState.currentProductId}
                onMeasurementComplete={updateCurrentMeasurement}
                onNext={() => {
                  setWidgetState(prev => ({ ...prev, currentStep: 'product-configuration' }));
                }}
                customerAddress={widgetState.customerInfo.address}
                selectedProduct={selectedProduct}
                onChangeProduct={goToProductSelection}
                isConfigurationMode={widgetState.currentStep === 'product-configuration'}
                currentStep={widgetState.currentStep}
                existingQuoteItems={[
                  ...widgetState.quoteItems,
                  // Include current main product item if it exists (during addon placement workflow)
                  ...(widgetState.currentMainProductItem ? [widgetState.currentMainProductItem] : []),
                  // Include pending addons
                  ...(widgetState.pendingAddons || [])
                ]}
                onResetToMeasurement={resetToMeasurement}
                isManualEntry={widgetState.currentMeasurement?.manualEntry === true}
                onFinalizeMeasurement={() => {}}
                onAddressSelect={(address) => {
                  updateCustomerInfo({
                    address: `${address.streetAddress}, ${address.city}, ${address.state} ${address.zipCode}`,
                    city: address.city,
                    state: address.state,
                    zipCode: address.zipCode,
                    lat: address.lat,
                    lng: address.lng,
                  });
                }}
              />
            )}
          </div>
        )}
        
        {/* Product Configuration Section - Appears below map */}
        {isStepVisible('product-configuration') && widgetState.currentStep !== 'confirmation' && widgetState.currentMeasurement && widgetProducts.length > 0 && (
          <div id="step-product-configuration" className="px-4 py-0 bg-background">
            <ProductConfiguration
              contractorId={contractorId!}
              productId={widgetState.currentProductId!}
              measurement={widgetState.currentMeasurement}
              onAddToQuote={addQuoteItem}
              settings={settings}
              onRemove={goToProductSelection}
              cachedProducts={widgetProducts}
              pendingAddons={widgetState.pendingAddons}
              onAddonPlacementStart={(addon, mainItem) => {
                // Don't add mainItem yet - keep it for reference
                setWidgetState(prev => ({
                  ...prev,
                  pendingAddon: {
                    ...addon,
                    calculationType: 'total'
                  },
                  currentMainProductItem: mainItem
                }));
                setShowAddonMethodDialog(true);
              }}
              onRemovePendingAddon={(addonItemId) => {
                setWidgetState(prev => ({
                  ...prev,
                  pendingAddons: prev.pendingAddons?.filter(item => item.id !== addonItemId) || []
                }));
              }}
            />
          </div>
        )}


        {/* Addon Quantity Input Dialog - For manual quantity entry */}
        {widgetState.currentStep === 'addon-quantity-input' && widgetState.pendingAddon && widgetState.currentMainProductItem && (
          <QuantityInputDialog
            open={true}
            productId={widgetState.pendingAddon.linkedProductId || ''}
            productName={widgetState.pendingAddon.addonName}
            productImage={undefined}
            unitType="each"
            minQuantity={1}
            onQuantitySet={(quantity, measurement) => {
              const addonProductId = widgetState.pendingAddon!.linkedProductId || widgetState.currentMainProductItem!.productId;
              const addonProductName = widgetState.pendingAddon!.linkedProductId 
                ? widgetState.pendingAddon!.addonName 
                : `${widgetState.currentMainProductItem!.productName} - ${widgetState.pendingAddon!.addonName}`;
              
              const newAddonItems = Array.from({ length: quantity }, (_, index) => ({
                id: `addon-${Date.now()}-${index}`,
                productId: addonProductId,
                productName: addonProductName,
                unitType: 'each' as const,
                measurement: {
                  type: 'point' as const,
                  value: 1,
                  unit: 'each',
                  pointLocations: [],
                  centerPoint: undefined,
                  mapColor: '#' + Math.floor(Math.random()*16777215).toString(16).padStart(6, '0')
                },
                unitPrice: widgetState.pendingAddon!.priceValue,
                quantity: 1,
                lineTotal: widgetState.pendingAddon!.priceValue,
                parentQuoteItemId: widgetState.currentMainProductItem!.id,
                addonId: widgetState.pendingAddon!.addonId,
                isAddonItem: true,
                variations: widgetState.pendingAddon!.selectedVariations
              }));

              // Add to pending addons instead of quoteItems and return to configuration
              setWidgetState(prev => ({
                ...prev,
                pendingAddons: [...(prev.pendingAddons || []), ...newAddonItems],
                pendingAddon: undefined,
                currentStep: 'product-configuration'
              }));
            }}
            onCancel={() => {
              setWidgetState(prev => ({
                ...prev,
                pendingAddon: undefined,
                currentStep: 'product-configuration'
              }));
            }}
          />
        )}

        {/* Contact After Section - Only show when actively on this step */}
        {widgetState.currentStep === 'contact-after' && settings.contact_capture_timing === 'after_quote' && (
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
              clarifyingQuestionsEnabled={clarifyingQuestionsEnabled}
              clarifyingQuestions={clarifyingQuestions}
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

      </div>

      {/* Method Selection Dialog for 'each' products */}
      {selectedProduct && (
        <QuantityMethodDialog
          open={showMethodDialog}
          productName={selectedProduct.name}
          onMethodSelect={handleMethodSelect}
        />
      )}

      {/* Method Selection Dialog for add-ons */}
      {widgetState.pendingAddon && (
        <QuantityMethodDialog
          open={showAddonMethodDialog}
          productName={widgetState.pendingAddon.addonName}
          onMethodSelect={handleAddonMethodSelect}
        />
      )}

      {/* Increment Confirmation Dialog */}
      {showIncrementDialog && selectedProduct && pendingMeasurement && (
        <IncrementConfirmationDialog
          open={showIncrementDialog}
          productName={selectedProduct.name}
          measuredQuantity={pendingMeasurement.value}
          measuredUnit={
            selectedProduct.unit_type === 'sq_ft' ? 'SF' :
            selectedProduct.unit_type === 'linear_ft' ? 'LF' :
            selectedProduct.unit_type
          }
          incrementSize={selectedProduct.sold_in_increments_of!}
          incrementLabel={selectedProduct.increment_unit_label || 'unit'}
          incrementDescription={selectedProduct.increment_description}
          allowPartial={selectedProduct.allow_partial_increments || false}
          onConfirm={handleIncrementConfirm}
          onRemeasure={handleRemeasure}
        />
      )}
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