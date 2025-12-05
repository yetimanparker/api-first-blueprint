import { useState, useEffect, useRef } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ArrowLeft, Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/components/ui/use-toast";
import { useContractorId } from "@/hooks/useContractorId";
import { useGlobalSettings } from "@/hooks/useGlobalSettings";
import ProductSelector from "@/components/widget/ProductSelector";
import MeasurementTools from "@/components/widget/MeasurementTools";
import QuantityInput from "@/components/widget/QuantityInput";
import QuantityMethodDialog from "@/components/widget/QuantityMethodDialog";
import QuantityInputDialog from "@/components/widget/QuantityInputDialog";
import { IncrementConfirmationDialog } from "@/components/widget/IncrementConfirmationDialog";
import ProductConfiguration from "@/components/widget/ProductConfiguration";
import { AddonPlacement } from "@/components/widget/AddonPlacement";
import QuoteReview from "@/components/widget/QuoteReview";
import type { MeasurementData, QuoteItem, WorkflowStep } from "@/types/widget";

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
  const [subcategories, setSubcategories] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [currentProductId, setCurrentProductId] = useState<string | undefined>();
  const [currentMeasurement, setCurrentMeasurement] = useState<MeasurementData | undefined>();
  const [quoteItems, setQuoteItems] = useState<QuoteItem[]>([]);
  const [saving, setSaving] = useState(false);
  const [selectedProduct, setSelectedProduct] = useState<any>(null);
  const [showMethodDialog, setShowMethodDialog] = useState(false);
  const [showAddonMethodDialog, setShowAddonMethodDialog] = useState(false);
  const [showIncrementDialog, setShowIncrementDialog] = useState(false);
  const [pendingMeasurement, setPendingMeasurement] = useState<MeasurementData | null>(null);
  const [cachedProducts, setCachedProducts] = useState<any[]>([]);
  
  // New state for add-on workflow matching Widget.tsx
  const [pendingAddons, setPendingAddons] = useState<QuoteItem[]>([]);
  const [currentMainProductItem, setCurrentMainProductItem] = useState<QuoteItem | undefined>();
  const [pendingAddon, setPendingAddon] = useState<{
    addonId: string;
    addonName: string;
    priceValue: number;
    calculationType: string;
    selectedOptionId?: string;
    selectedOptionName?: string;
    selectedVariations?: any[];
    linkedProductId?: string;
  } | undefined>();
  
  // State for Add Another Segment workflow
  const [accumulatedSegments, setAccumulatedSegments] = useState<MeasurementData[]>([]);

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
      fetchCategoriesAndSubcategories();
      fetchAndCacheProducts();
    }
  }, [quoteId, contractorId, contractorLoading]);

  const fetchAndCacheProducts = async () => {
    if (!contractorId) return;
    
    try {
      const { data, error } = await supabase.functions.invoke('get-widget-products', {
        body: { contractor_id: contractorId }
      });
      
      if (error || !data?.success) {
        console.error('Failed to load products');
        return;
      }

      if (data.products) {
        setCachedProducts(data.products);
      }
    } catch (err) {
      console.error('Error fetching products:', err);
    }
  };

  const fetchCategoriesAndSubcategories = async () => {
    if (!contractorId) return;
    
    try {
      const { data, error } = await supabase.functions.invoke('get-widget-products', {
        body: { contractor_id: contractorId }
      });
      
      if (error || !data?.success) {
        console.error('Failed to load categories');
        return;
      }

      if (data.categories) {
        setCategories(data.categories);
      }
      if (data.subcategories) {
        setSubcategories(data.subcategories);
      }
    } catch (err) {
      console.error('Error fetching categories:', err);
    }
  };

  useEffect(() => {
    // Scroll to current step section
    const stepId = `step-${currentStep}`;
    const stepElement = document.getElementById(stepId);
    if (stepElement) {
      setTimeout(() => {
        stepElement.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }, 150);
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
        parentQuoteItemId: item.parent_quote_item_id,
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

  const handleProductSelect = async (productId: string) => {
    try {
      // Use cached products if available
      let productData;
      if (cachedProducts.length > 0) {
        productData = cachedProducts.find((p: any) => p.id === productId);
      }
      
      // Fallback to fetching if not in cache
      if (!productData) {
        const { data, error } = await supabase.functions.invoke('get-widget-products', {
          body: { contractor_id: contractorId }
        });
        
        if (error || !data?.success) {
          throw new Error('Failed to load product details');
        }
        
        productData = data.products.find((p: any) => p.id === productId);
      }
      
      if (!productData) {
        throw new Error('Product not found');
      }
      
      setSelectedProduct(productData);
      setCurrentProductId(productId);
      
      // For 'each' products, show method selection dialog
      if (productData.unit_type === 'each') {
        setShowMethodDialog(true);
      } else {
        // Other manual input products go straight to quantity input
        const manualInputUnits = ['ton', 'pound', 'pallet', 'hour'];
        const requiresManualInput = manualInputUnits.includes(productData.unit_type);
        
        const nextStep: WorkflowStep = requiresManualInput ? 'quantity-input' : 'measurement';
        setCurrentStep(nextStep);
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
    const nextStep: WorkflowStep = method === 'manual' ? 'quantity-input' : 'measurement';
    setCurrentStep(nextStep);
  };

  const handleAddonMethodSelect = (method: 'manual' | 'map') => {
    setShowAddonMethodDialog(false);
    const nextStep: WorkflowStep = method === 'manual' ? 'addon-quantity-input' : 'addon-placement';
    setCurrentStep(nextStep);
  };

  const handleMeasurementComplete = (measurement: MeasurementData) => {
    // Finalize measurement (make nodes non-editable)
    if ((window as any).__finalizeMeasurement) {
      (window as any).__finalizeMeasurement();
    }
    
    // If we have accumulated segments, combine them with this measurement
    let finalMeasurement = measurement;
    if (accumulatedSegments.length > 0) {
      const allSegments = [...accumulatedSegments, measurement];
      const totalValue = allSegments.reduce((sum, seg) => sum + seg.value, 0);
      
      // Create segments array with all coordinate sets
      const segments = allSegments
        .map(seg => seg.coordinates)
        .filter((coords): coords is number[][] => coords !== undefined && coords.length > 0);
      
      finalMeasurement = {
        ...measurement,
        value: totalValue,
        segments: segments,
        segmentCount: allSegments.length,
      };
      
      // Clear accumulated segments
      setAccumulatedSegments([]);
    }
    
    // Check if selected product requires increment confirmation
    if (selectedProduct?.sold_in_increments_of) {
      setPendingMeasurement(finalMeasurement);
      setShowIncrementDialog(true);
    } else {
      setCurrentMeasurement(finalMeasurement);
      setCurrentStep('product-configuration');
    }
  };
  
  // Handler for "Add Another Segment" workflow
  const handleAddAnotherSegment = (measurement: MeasurementData) => {
    console.log('🔄 Adding segment to accumulator:', measurement);
    setAccumulatedSegments(prev => [...prev, measurement]);
  };

  const handleIncrementConfirm = () => {
    if (pendingMeasurement) {
      setCurrentMeasurement(pendingMeasurement);
      setCurrentStep('product-configuration');
    }
    setShowIncrementDialog(false);
    setPendingMeasurement(null);
  };

  const handleIncrementCancel = () => {
    setShowIncrementDialog(false);
    setPendingMeasurement(null);
  };

  const handleQuantityComplete = (measurement: MeasurementData) => {
    setCurrentMeasurement(measurement);
    setCurrentStep('product-configuration');
  };

  const handleConfigurationComplete = (item: QuoteItem | QuoteItem[]) => {
    const items = Array.isArray(item) ? item : [item];
    console.log('🟢 Configuration complete, items:', items.length);
    
    // Finalize measurement
    if ((window as any).__finalizeMeasurement) {
      (window as any).__finalizeMeasurement();
    }
    
    // Store items temporarily and go to review
    setQuoteItems(prev => [...prev, ...items]);
    setPendingAddons([]);
    setCurrentMainProductItem(undefined);
    setCurrentStep('internal-quote-review');
  };

  const handleFinalSaveToDatabase = async () => {
    if (!quoteId) return;

    try {
      setSaving(true);

      // Get items that need to be saved (have temporary IDs)
      const itemsToSave = quoteItems.filter(item => item.id.startsWith('addon-') || !item.id.includes('-'));

      // Save all items to database
      const savedItems: QuoteItem[] = [];
      
      for (const item of itemsToSave) {
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
            parent_quote_item_id: item.parentQuoteItemId,
          })
          .select()
          .single();

        if (error) throw error;
        savedItems.push({ ...item, id: data.id });
      }

      // Recalculate quote total
      const newTotal = quoteItems.reduce((sum, i) => sum + i.lineTotal, 0);
      await supabase
        .from('quotes')
        .update({ total_amount: newTotal })
        .eq('id', quoteId);

      toast({
        title: "Items Added",
        description: `${savedItems.length} item(s) added successfully`,
      });

      // Navigate back to quote edit page
      navigate(`/quote/edit/${quoteId}`);

    } catch (error) {
      console.error('Error saving quote items:', error);
      toast({
        title: "Error",
        description: "Failed to add items to quote",
        variant: "destructive",
      });
    } finally {
      setSaving(false);
    }
  };

  const handleBack = () => {
    if (currentStep === 'quantity-input' || currentStep === 'measurement') {
      setCurrentStep('product-selection');
      setCurrentProductId(undefined);
      setSelectedProduct(null);
    } else if (currentStep === 'product-configuration') {
      // Go back to measurement or quantity-input depending on product type
      if (selectedProduct?.unit_type === 'each' || 
          ['ton', 'pound', 'pallet', 'hour'].includes(selectedProduct?.unit_type)) {
        setCurrentStep('quantity-input');
      } else {
        setCurrentStep('measurement');
      }
      setCurrentMeasurement(undefined);
    } else if (currentStep === 'internal-quote-review') {
      setCurrentStep('product-configuration');
    }
  };

  const resetToMeasurement = () => {
    setCurrentMeasurement(undefined);
    if (selectedProduct?.unit_type === 'each' || 
        ['ton', 'pound', 'pallet', 'hour'].includes(selectedProduct?.unit_type)) {
      setCurrentStep('quantity-input');
    } else {
      setCurrentStep('measurement');
    }
  };

  const goToProductSelection = () => {
    setSelectedProduct(null);
    setCurrentProductId(undefined);
    setCurrentMeasurement(undefined);
    setPendingAddons([]);
    setCurrentMainProductItem(undefined);
    setPendingAddon(undefined);
    setAccumulatedSegments([]);
    setCurrentStep('product-selection');
  };

  const handleRemoveItemFromReview = (itemId: string) => {
    const remainingItems = quoteItems.filter(item => item.id !== itemId);
    setQuoteItems(remainingItems);
    
    if (remainingItems.length === 0) {
      goToProductSelection();
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

  // Helper to check if a step should be visible
  const isStepVisible = (step: WorkflowStep): boolean => {
    const stepOrder: WorkflowStep[] = [
      'product-selection',
      'quantity-input',
      'measurement',
      'product-configuration',
      'addon-placement',
      'addon-quantity-input',
      'internal-quote-review',
    ];
    const currentIndex = stepOrder.indexOf(currentStep);
    const stepIndex = stepOrder.indexOf(step);
    
    if (step === 'product-selection' && currentIndex >= stepOrder.indexOf('product-selection')) {
      return true;
    }
    
    return stepIndex <= currentIndex;
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

  // Force pricing to always be visible for internal use
  const internalSettings = {
    ...settings,
    hide_pricing: false,
    use_price_ranges: false,
    pricing_visibility: 'before_submit' as const,
  };

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
            {currentStep !== 'internal-quote-review' && (
              <Button onClick={handleFinish} variant="outline">
                Cancel & Return
              </Button>
            )}
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Progress Indicator - Hide during review */}
        {currentStep !== 'internal-quote-review' && (
          <Card className="mb-6 hidden md:block">
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div className={`flex items-center gap-2 ${currentStep === 'product-selection' ? 'text-primary' : 'text-muted-foreground'}`}>
                  <div className={`w-8 h-8 rounded-full flex items-center justify-center border-2 ${currentStep === 'product-selection' ? 'border-primary bg-primary text-primary-foreground' : 'border-muted'}`}>
                    1
                  </div>
                  <span className="font-medium">Product</span>
                </div>
                <div className="flex-1 h-px bg-border mx-4" />
                <div className={`flex items-center gap-2 ${['measurement', 'quantity-input'].includes(currentStep) ? 'text-primary' : 'text-muted-foreground'}`}>
                  <div className={`w-8 h-8 rounded-full flex items-center justify-center border-2 ${['measurement', 'quantity-input'].includes(currentStep) ? 'border-primary bg-primary text-primary-foreground' : 'border-muted'}`}>
                    2
                  </div>
                  <span className="font-medium">Measure</span>
                </div>
                <div className="flex-1 h-px bg-border mx-4" />
                <div className={`flex items-center gap-2 ${['product-configuration', 'addon-placement', 'addon-quantity-input'].includes(currentStep) ? 'text-primary' : 'text-muted-foreground'}`}>
                  <div className={`w-8 h-8 rounded-full flex items-center justify-center border-2 ${['product-configuration', 'addon-placement', 'addon-quantity-input'].includes(currentStep) ? 'border-primary bg-primary text-primary-foreground' : 'border-muted'}`}>
                    3
                  </div>
                  <span className="font-medium">Configure</span>
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Product Selection Section */}
        {isStepVisible('product-selection') && !currentProductId && currentStep !== 'internal-quote-review' && (
          <div id="step-product-selection" className="w-full">
            <ProductSelector
              categories={categories}
              subcategories={subcategories}
              onProductSelect={handleProductSelect}
              settings={internalSettings}
              contractorId={contractorId!}
            />
          </div>
        )}

        {/* Quantity Method Dialog */}
        <QuantityMethodDialog
          open={showMethodDialog}
          productName={selectedProduct?.name || ''}
          onMethodSelect={handleMethodSelect}
          onCancel={() => setShowMethodDialog(false)}
        />

        {/* Increment Confirmation Dialog */}
        {showIncrementDialog && selectedProduct && pendingMeasurement && (
          <IncrementConfirmationDialog
            open={showIncrementDialog}
            productName={selectedProduct.name}
            measuredQuantity={pendingMeasurement.value}
            measuredUnit={selectedProduct.unit_type}
            incrementSize={selectedProduct.sold_in_increments_of}
            incrementLabel={selectedProduct.increment_unit_label || 'unit'}
            incrementDescription={selectedProduct.increment_description}
            allowPartial={selectedProduct.allow_partial_increments || false}
            onConfirm={handleIncrementConfirm}
            onRemeasure={handleIncrementCancel}
          />
        )}

        {/* Quantity Input Dialog - For 'each' type products */}
        {isStepVisible('quantity-input') && currentStep === 'quantity-input' && selectedProduct && (
          <QuantityInputDialog
            open={true}
            productId={currentProductId!}
            productName={selectedProduct.name}
            productImage={selectedProduct.photo_url}
            unitType={selectedProduct.unit_type}
            minQuantity={selectedProduct.min_order_quantity || 1}
            onQuantitySet={(quantity, measurement) => {
              setCurrentMeasurement(measurement);
              setCurrentStep('product-configuration');
            }}
            onCancel={goToProductSelection}
          />
        )}

        {/* Measurement / Add-on Placement Section - shared map area */}
        {isStepVisible('measurement') && currentProductId && currentStep !== 'internal-quote-review' && (
          <div id="step-measurement" className="w-full mb-2">
            {currentStep === 'addon-placement' && pendingAddon && currentMainProductItem ? (
              <AddonPlacement
                addonName={pendingAddon.addonName}
                linkedProductId={pendingAddon.linkedProductId}
                mainProductMeasurement={currentMainProductItem.measurement}
                customerAddress={getCustomerAddress()}
                existingAddonLocations={[
                  // Include ALL pending add-ons for visual reference (all product types)
                  ...pendingAddons,
                  // Include ALL already-committed add-on items for visual reference
                  ...quoteItems.filter(
                    (item) =>
                      item.parentQuoteItemId &&
                      currentMainProductItem &&
                      item.parentQuoteItemId === currentMainProductItem.id
                  ),
                ]
                  .map((item) => {
                    const m = item.measurement;
                    const center = m.centerPoint || m.pointLocations?.[0];
                    if (!center) return null;
                    return {
                      lat: center.lat,
                      lng: center.lng,
                      color: m.mapColor,
                    };
                  })
                  .filter(
                    (loc): loc is { lat: number; lng: number; color: string } =>
                      loc !== null,
                  )}
                onComplete={(locations, productColor) => {
                  const addonProductId = pendingAddon.linkedProductId || currentMainProductItem.productId;
                  const addonProductName = pendingAddon.linkedProductId
                    ? pendingAddon.addonName
                    : `${currentMainProductItem.productName} - ${pendingAddon.addonName}`;

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
                    unitPrice: pendingAddon.priceValue,
                    quantity: 1,
                    lineTotal: pendingAddon.priceValue,
                    parentQuoteItemId: currentMainProductItem.id,
                    addonId: pendingAddon.addonId,
                    isAddonItem: true,
                    variations: pendingAddon.selectedVariations,
                  }));

                  setPendingAddons(prev => [...prev, ...newAddonItems]);
                  setPendingAddon(undefined);
                  setCurrentStep('product-configuration');
                }}
                onCancel={() => {
                  setPendingAddon(undefined);
                  setCurrentStep('product-configuration');
                }}
              />
            ) : (
              <MeasurementTools
                contractorId={contractorId!}
                productId={currentProductId}
                onMeasurementComplete={handleMeasurementComplete}
                onNext={() => setCurrentStep('product-configuration')}
                customerAddress={getCustomerAddress()}
                selectedProduct={selectedProduct}
                onChangeProduct={goToProductSelection}
                isConfigurationMode={currentStep === 'product-configuration'}
                currentStep={currentStep}
                existingQuoteItems={[
                  ...quoteItems,
                  ...(currentMainProductItem ? [currentMainProductItem] : []),
                  ...pendingAddons
                ]}
                onResetToMeasurement={resetToMeasurement}
                isManualEntry={currentMeasurement?.manualEntry === true}
                onFinalizeMeasurement={() => {}}
                onAddressSelect={(address) => {}}
                accumulatedSegments={accumulatedSegments}
                onAddAnotherSegment={handleAddAnotherSegment}
              />
            )}
          </div>
        )}

        {/* Product Configuration Section */}
        {isStepVisible('product-configuration') && currentStep !== 'internal-quote-review' && currentStep !== 'addon-placement' && currentStep !== 'addon-quantity-input' && currentMeasurement && cachedProducts.length > 0 && (
          <div id="step-product-configuration" className="px-4 py-0 bg-background">
            <ProductConfiguration
              contractorId={contractorId!}
              productId={currentProductId!}
              measurement={currentMeasurement}
              onAddToQuote={handleConfigurationComplete}
              settings={internalSettings}
              onRemove={goToProductSelection}
              cachedProducts={cachedProducts}
              pendingAddons={pendingAddons}
              onAddonPlacementStart={(addon, mainItem) => {
                setPendingAddon({
                  ...addon,
                  calculationType: 'total'
                });
                setCurrentMainProductItem(mainItem);
                setShowAddonMethodDialog(true);
              }}
              onRemovePendingAddon={(addonItemId) => {
                setPendingAddons(prev => prev.filter(item => item.id !== addonItemId));
              }}
            />
          </div>
        )}

        {/* Addon Quantity Input Dialog - For manual quantity entry */}
        {currentStep === 'addon-quantity-input' && pendingAddon && currentMainProductItem && (
          <QuantityInputDialog
            open={true}
            productId={pendingAddon.linkedProductId || ''}
            productName={pendingAddon.addonName}
            productImage={undefined}
            unitType="each"
            minQuantity={1}
            onQuantitySet={(quantity, measurement) => {
              const addonProductId = pendingAddon.linkedProductId || currentMainProductItem.productId;
              const addonProductName = pendingAddon.linkedProductId 
                ? pendingAddon.addonName 
                : `${currentMainProductItem.productName} - ${pendingAddon.addonName}`;
              
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
                unitPrice: pendingAddon.priceValue,
                quantity: 1,
                lineTotal: pendingAddon.priceValue,
                parentQuoteItemId: currentMainProductItem.id,
                addonId: pendingAddon.addonId,
                isAddonItem: true,
                variations: pendingAddon.selectedVariations
              }));

              setPendingAddons(prev => [...prev, ...newAddonItems]);
              setPendingAddon(undefined);
              setCurrentStep('product-configuration');
            }}
            onCancel={() => {
              setPendingAddon(undefined);
              setCurrentStep('product-configuration');
            }}
          />
        )}

        {/* Method Selection Dialog for add-ons */}
        {pendingAddon && (
          <QuantityMethodDialog
            open={showAddonMethodDialog}
            productName={pendingAddon.addonName}
            onMethodSelect={handleAddonMethodSelect}
            onCancel={() => setShowAddonMethodDialog(false)}
          />
        )}

        {/* Internal Quote Review Section */}
        {currentStep === 'internal-quote-review' && (
          <div id="step-internal-quote-review" className="px-4 py-4 mt-2">
            <QuoteReview
              quoteItems={quoteItems}
              customerInfo={{
                firstName: customer?.first_name || '',
                lastName: customer?.last_name || '',
                email: customer?.email || '',
                address: getCustomerAddress(),
              }}
              contractorId={contractorId!}
              settings={internalSettings}
              currentStep={'quote-review' as WorkflowStep}
              onNext={() => {}}
              onUpdateComments={() => {}}
              onUpdateCustomerInfo={() => {}}
              onAddAnother={goToProductSelection}
              onRemoveItem={handleRemoveItemFromReview}
              onQuoteSubmitted={() => {}}
              clarifyingQuestionsEnabled={false}
              clarifyingQuestions={[]}
              onCustomSubmit={handleFinalSaveToDatabase}
              submitButtonText="Save to Quote"
            />
          </div>
        )}
      </main>
    </div>
  );
}
