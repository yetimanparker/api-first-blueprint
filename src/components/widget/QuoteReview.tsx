import { useState, useEffect, useRef } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Separator } from '@/components/ui/separator';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { ClarifyingQuestionsDialog } from '@/components/widget/ClarifyingQuestionsDialog';
import { Input } from '@/components/ui/input';
import { Loader2, FileText, DollarSign, Plus, MessageSquare, Calculator, Trash2, User } from 'lucide-react';
import { QuoteItem, CustomerInfo, WorkflowStep } from '@/types/widget';
import { GlobalSettings } from '@/hooks/useGlobalSettings';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { useGooglePlaces } from '@/hooks/useGooglePlaces';
import { 
  applyGlobalMarkup, 
  applyGlobalTax, 
  formatExactPrice,
  calculateFinalPrice,
  calculateAddonWithAreaData
} from '@/lib/priceUtils';

interface QuoteReviewProps {
  quoteItems: QuoteItem[];
  customerInfo: Partial<CustomerInfo>;
  contractorId: string;
  settings: GlobalSettings;
  currentStep: WorkflowStep;
  onNext: () => void;
  onUpdateComments: (comments: string) => void;
  onUpdateCustomerInfo: (info: Partial<CustomerInfo>) => void;
  onAddAnother?: () => void;
  onRemoveItem?: (itemId: string) => void;
  onQuoteSubmitted?: (quoteNumber: string) => void;
  clarifyingQuestionsEnabled?: boolean;
  clarifyingQuestions?: Array<{id: string; question: string; required: boolean}>;
}

interface ClarifyingAnswer {
  question: string;
  answer: string;
}

const QuoteReview = ({ 
  quoteItems, 
  customerInfo, 
  contractorId, 
  settings, 
  currentStep,
  onNext,
  onUpdateComments,
  onUpdateCustomerInfo,
  onAddAnother,
  onRemoveItem,
  onQuoteSubmitted,
  clarifyingQuestionsEnabled = false,
  clarifyingQuestions = []
}: QuoteReviewProps) => {
  console.log('🔄 QuoteReview v2.0 - Variations/Addons always visible with toggle - ' + new Date().toISOString());
  console.log('📦 Quote Items Data:', JSON.stringify(quoteItems, null, 2));
  const [projectComments, setProjectComments] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [items, setItems] = useState<QuoteItem[]>(quoteItems);
  const [showContactDialog, setShowContactDialog] = useState(false);
  const [dialogCustomerInfo, setDialogCustomerInfo] = useState<Partial<CustomerInfo>>(customerInfo);
  const [dialogErrors, setDialogErrors] = useState<Record<string, string>>({});
  const [showPredictions, setShowPredictions] = useState(false);
  const [showClarifyingDialog, setShowClarifyingDialog] = useState(false);
  const { toast } = useToast();
  const quoteSummaryRef = useRef<HTMLDivElement>(null);
  const { getAutocomplete, getPlaceDetails, predictions, loading } = useGooglePlaces();

  // Helper function to get display unit abbreviation
  const getDisplayUnit = (unitType: string, isVolumeBased: boolean = false) => {
    if (isVolumeBased) return 'cu yd';
    
    const unitMap: Record<string, string> = {
      'sq_ft': 'SF',
      'linear_ft': 'LF',
      'each': 'each',
      'cubic_yard': 'cu yd',
      'hour': 'hr',
      'pound': 'lb',
      'ton': 'ton',
      'pallet': 'pallet'
    };
    
    return unitMap[unitType] || unitType;
  };

  // Update dialog customer info when customerInfo prop changes
  useEffect(() => {
    setDialogCustomerInfo(customerInfo);
  }, [customerInfo]);

  // Sync local items state with parent quoteItems prop
  useEffect(() => {
    setItems(quoteItems);
  }, [quoteItems]);

  // Group items by parent-child relationships and consolidate duplicate add-ons
  const organizeItemsForDisplay = () => {
    const parentItems = items.filter(item => !item.parentQuoteItemId);
    const childItems = items.filter(item => item.parentQuoteItemId);
    
    // Create a map of parent ID to consolidated children
    const consolidatedChildrenByParent = new Map<string, Array<{
      productId: string;
      productName: string;
      unitPrice: number;
      unitType: string;
      quantity: number;
      lineTotal: number;
      mapColor: string;
      items: QuoteItem[];
    }>>();
    
    childItems.forEach(child => {
      const parentId = child.parentQuoteItemId!;
      if (!consolidatedChildrenByParent.has(parentId)) {
        consolidatedChildrenByParent.set(parentId, []);
      }
      
      const siblings = consolidatedChildrenByParent.get(parentId)!;
      const existing = siblings.find(s => s.productId === child.productId);
      
      if (existing) {
        // Consolidate duplicate products
        existing.quantity += child.quantity;
        existing.lineTotal += child.lineTotal;
        existing.items.push(child);
      } else {
        // New product type
        siblings.push({
          productId: child.productId,
          productName: child.productName,
          unitPrice: child.unitPrice,
          unitType: child.unitType,
          quantity: child.quantity,
          lineTotal: child.lineTotal,
          mapColor: child.measurement.mapColor || '#F59E0B',
          items: [child]
        });
      }
    });
    
    return { parentItems, consolidatedChildrenByParent };
  };

  const subtotal = items.reduce((sum, item) => sum + item.lineTotal, 0);
  const markupAmount = 0;
  const taxableAmount = subtotal;
  const taxAmount = settings.global_tax_rate > 0 
    ? applyGlobalTax(taxableAmount, settings.global_tax_rate) - taxableAmount 
    : 0;
  const total = taxableAmount + taxAmount;

  const toggleAddon = (itemId: string, addonId: string) => {
    setItems(prevItems => prevItems.map(item => {
      if (item.id !== itemId) return item;
      
      const updatedAddons = item.measurement.addons?.map(addon => {
        if (addon.id === addonId) {
          const newQuantity = addon.quantity > 0 ? 0 : 1;
          return { ...addon, quantity: newQuantity };
        }
        return addon;
      }) || [];

      // Calculate quantity (use cubic yards if depth is provided)
      const quantity = item.measurement.depth 
        ? (item.measurement.value * item.measurement.depth) / 324 
        : item.measurement.value;

      // Recalculate line total
      let basePrice = quantity * item.unitPrice;
      
      // Apply variations
      if (item.measurement.variations && item.measurement.variations.length > 0) {
        item.measurement.variations.forEach(variation => {
          if (variation.adjustmentType === 'percentage') {
            basePrice += basePrice * (variation.priceAdjustment / 100);
          } else {
            basePrice += variation.priceAdjustment * quantity;
          }
        });
      }
      
      // Apply active addons
      let addonsTotal = 0;
      updatedAddons.forEach(addon => {
        if (addon.quantity > 0) {
          // Get variation data for area calculations
          const variationData = item.measurement.variations && item.measurement.variations.length > 0
            ? {
                height: item.measurement.variations[0].height_value || null,
                unit: item.measurement.variations[0].unit_of_measurement || 'ft',
                affects_area_calculation: item.measurement.variations[0].affects_area_calculation || false
              }
            : undefined;
          
          // Use the same calculation method as ProductConfiguration
          const baseQuantity = item.measurement.depth
            ? (item.measurement.value * item.measurement.depth) / 324
            : item.measurement.value;
          
          const addonPrice = calculateAddonWithAreaData(
            addon.priceValue,
            baseQuantity,
            addon.calculationType,
            variationData
          );
          
          addonsTotal += addonPrice * addon.quantity;
        }
      });

      const newLineTotal = basePrice + addonsTotal;

      return {
        ...item,
        measurement: {
          ...item.measurement,
          addons: updatedAddons
        },
        lineTotal: newLineTotal
      };
    }));
  };

  const handleCommentsChange = (comments: string) => {
    setProjectComments(comments);
    onUpdateComments(comments);
  };

  const handleDialogAddressChange = async (value: string) => {
    setDialogCustomerInfo(prev => ({ ...prev, address: value }));
    setDialogErrors(prev => ({ ...prev, address: '' }));
    
    if (value.length > 2) {
      getAutocomplete(value);
      setShowPredictions(true);
    }
  };

  const handleDialogAddressSelect = async (placeId: string, description: string) => {
    setShowPredictions(false);
    
    const placeDetails = await getPlaceDetails(placeId);
    if (placeDetails) {
      setDialogCustomerInfo(prev => ({
        ...prev,
        address: description,
        city: placeDetails.city,
        state: placeDetails.state,
        zipCode: placeDetails.zipCode,
        lat: placeDetails.lat,
        lng: placeDetails.lng
      }));
    } else {
      setDialogCustomerInfo(prev => ({ ...prev, address: description }));
    }
  };

  const validateDialogForm = () => {
    const newErrors: Record<string, string> = {};

    if (!dialogCustomerInfo.firstName?.trim()) {
      newErrors.firstName = 'First name is required';
    }
    if (!dialogCustomerInfo.lastName?.trim()) {
      newErrors.lastName = 'Last name is required';
    }
    if (settings.require_email !== false && !dialogCustomerInfo.email?.trim()) {
      newErrors.email = 'Email is required';
    }
    if (dialogCustomerInfo.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(dialogCustomerInfo.email)) {
      newErrors.email = 'Please enter a valid email address';
    }
    if (settings.require_phone !== false && !dialogCustomerInfo.phone?.trim()) {
      newErrors.phone = 'Phone number is required';
    }
    if (settings.require_address !== false && !dialogCustomerInfo.address?.trim()) {
      newErrors.address = 'Address is required';
    }

    setDialogErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleContactDialogSubmit = () => {
    if (validateDialogForm()) {
      console.log('✅ Contact form validated');
      onUpdateCustomerInfo(dialogCustomerInfo);
      setShowContactDialog(false);
      
      // After contact form, submit with clarifying answers (already collected)
      console.log('➡️ Contact info complete, submitting quote with clarifying answers');
      submitQuote(dialogCustomerInfo, clarifyingAnswersRef.current || []);
    }
  };

  const handleSubmitQuote = async () => {
    console.log('🚀 handleSubmitQuote called');
    console.log('📋 Clarifying Questions Props:', {
      enabled: clarifyingQuestionsEnabled,
      questionsLength: clarifyingQuestions.length,
      questions: clarifyingQuestions
    });
    
    if (!contractorId) {
      toast({
        title: "Error",
        description: "Contractor information is missing",
        variant: "destructive",
      });
      return;
    }

    // CHECK CLARIFYING QUESTIONS FIRST (before contact info)
    console.log('🔍 Checking clarifying questions FIRST:', {
      enabled: clarifyingQuestionsEnabled,
      hasQuestions: clarifyingQuestions.length > 0,
      shouldShow: clarifyingQuestionsEnabled && clarifyingQuestions.length > 0
    });
    
    if (clarifyingQuestionsEnabled && clarifyingQuestions.length > 0) {
      console.log('✅ Showing clarifying questions dialog FIRST');
      setShowClarifyingDialog(true);
      return;
    }

    // Then validate required fields
    const missingRequiredFields = 
      !customerInfo.firstName?.trim() || 
      !customerInfo.lastName?.trim() || 
      (settings.require_email !== false && !customerInfo.email?.trim());

    if (missingRequiredFields) {
      console.log('⚠️ Missing required fields, showing contact dialog');
      setDialogCustomerInfo(customerInfo);
      setShowContactDialog(true);
      return;
    }

    console.log('➡️ Proceeding to submit quote directly');
    // Otherwise proceed with submission
    submitQuote(customerInfo, []);
  };

  const clarifyingAnswersRef = useRef<ClarifyingAnswer[]>([]);

  const handleClarifyingQuestionsSubmit = (answers: ClarifyingAnswer[]) => {
    console.log('✅ Clarifying questions submitted, storing answers');
    clarifyingAnswersRef.current = answers;
    setShowClarifyingDialog(false);
    
    // After clarifying questions, check if contact info is complete
    const missingRequiredFields = 
      !customerInfo.firstName?.trim() || 
      !customerInfo.lastName?.trim() || 
      (settings.require_email !== false && !customerInfo.email?.trim());

    if (missingRequiredFields) {
      console.log('⚠️ Missing required fields after clarifying questions, showing contact dialog');
      setDialogCustomerInfo(customerInfo);
      setTimeout(() => {
        setShowContactDialog(true);
      }, 150);
      return;
    }

    // If all info is complete, submit directly
    console.log('✅ All info complete, submitting quote');
    submitQuote(customerInfo, answers);
  };

  const submitQuote = async (contactInfo: Partial<CustomerInfo>, clarifyingAnswers: ClarifyingAnswer[]) => {
    setIsSubmitting(true);

    try {
      console.log('📤 QuoteReview: Preparing to submit quote');
      console.log('🆔 Items before transformation:', items.map(i => ({ id: i.id, productName: i.productName, parentQuoteItemId: i.parentQuoteItemId })));
      
      const quoteItemsData = items.map(item => ({
        id: item.id,
        productId: item.productId,
        quantity: item.quantity,
        unitPrice: item.unitPrice,
        lineTotal: item.lineTotal,
        parentQuoteItemId: item.parentQuoteItemId,
        measurementData: {
          type: item.measurement.type,
          value: item.measurement.value,
          unit: item.measurement.unit,
          coordinates: item.measurement.coordinates || [],
          pointLocations: item.measurement.pointLocations || [],
          manualEntry: item.measurement.manualEntry || false,
          customName: item.customName || '',
          mapColor: item.measurement.mapColor,
          depth: item.measurement.depth,
            variations: (item.variations || []).map(v => ({
              id: v.id,
              name: v.name,
              priceAdjustment: v.priceAdjustment,
              adjustmentType: v.adjustmentType,
              height_value: v.height_value || null,
              unit_of_measurement: v.unit_of_measurement || 'ft',
              affects_area_calculation: v.affects_area_calculation || false
            })),
          addons: (item.addons || []).map(a => ({
            id: a.id,
            name: a.name,
            priceValue: a.priceValue,
            calculationType: a.calculationType,
            quantity: a.quantity,
            selectedOptionId: a.selectedOptionId,
            selectedOptionName: a.selectedOptionName
          }))
        },
        notes: item.notes || '',
      }));

      const { data, error } = await supabase.functions.invoke('submit-widget-quote', {
        body: {
          customerInfo: {
            firstName: contactInfo.firstName,
            lastName: contactInfo.lastName,
            email: contactInfo.email,
            phone: contactInfo.phone,
            address: contactInfo.address,
            city: contactInfo.city,
            state: contactInfo.state,
            zipCode: contactInfo.zipCode,
          },
          quoteItems: quoteItemsData,
          contractorId,
          projectComments,
          clarifyingAnswers,
        },
      });

      if (error) throw error;

      toast({
        title: "Quote Submitted!",
        description: `Your quote #${data.quoteNumber} has been submitted successfully.`,
      });

      if (onQuoteSubmitted) {
        onQuoteSubmitted(data.quoteNumber);
      } else {
        onNext();
      }
    } catch (error: any) {
      console.error('Error submitting quote:', error);
      toast({
        title: "Error",
        description: error.message || "Failed to submit quote. Please try again.",
        variant: "destructive",
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  if (currentStep === 'project-comments') {
    return (
      <div className="max-w-3xl mx-auto px-4 py-3">
        <Card className="shadow-lg">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <MessageSquare className="h-5 w-5 text-primary" />
              Project Comments
            </CardTitle>
            <p className="text-sm text-muted-foreground">
              Tell us about your project in detail
            </p>
          </CardHeader>
          
          <CardContent className="space-y-6">
            <div>
              <Label htmlFor="projectComments">Project Details</Label>
              <Textarea
                id="projectComments"
                value={projectComments}
                onChange={(e) => handleCommentsChange(e.target.value)}
                placeholder="Tell us about your project in detail. Please provide access information, ground type, slope/elevation change etc."
                rows={6}
                className="mt-2"
              />
              <p className="text-xs text-muted-foreground mt-2">
                This information helps us provide a more accurate quote and better service.
              </p>
            </div>

            <div className="flex flex-col sm:flex-row gap-4">
              <Button onClick={onNext} className="flex-1" size="lg">
                Continue to Review
              </Button>
              <Button 
                onClick={onNext} 
                variant="outline" 
                size="lg"
                className="flex-1"
              >
                Skip
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <>
      {/* Contact Information Dialog */}
      <Dialog open={showContactDialog} onOpenChange={setShowContactDialog}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <User className="h-5 w-5 text-primary" />
              Contact Information Required
            </DialogTitle>
            <DialogDescription>
              Please provide your contact details to complete your quote request.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label htmlFor="dialog-firstName">
                  First Name <span className="text-destructive">*</span>
                </Label>
                <Input
                  id="dialog-firstName"
                  value={dialogCustomerInfo.firstName || ''}
                  onChange={(e) => {
                    setDialogCustomerInfo(prev => ({ ...prev, firstName: e.target.value }));
                    setDialogErrors(prev => ({ ...prev, firstName: '' }));
                  }}
                  className={dialogErrors.firstName ? 'border-destructive' : ''}
                  placeholder="Enter first name"
                />
                {dialogErrors.firstName && (
                  <p className="text-sm text-destructive mt-1">{dialogErrors.firstName}</p>
                )}
              </div>
              <div>
                <Label htmlFor="dialog-lastName">
                  Last Name <span className="text-destructive">*</span>
                </Label>
                <Input
                  id="dialog-lastName"
                  value={dialogCustomerInfo.lastName || ''}
                  onChange={(e) => {
                    setDialogCustomerInfo(prev => ({ ...prev, lastName: e.target.value }));
                    setDialogErrors(prev => ({ ...prev, lastName: '' }));
                  }}
                  className={dialogErrors.lastName ? 'border-destructive' : ''}
                  placeholder="Enter last name"
                />
                {dialogErrors.lastName && (
                  <p className="text-sm text-destructive mt-1">{dialogErrors.lastName}</p>
                )}
              </div>
            </div>
            <div>
              <Label htmlFor="dialog-email">
                Email {settings.require_email && <span className="text-destructive">*</span>}
              </Label>
              <Input
                id="dialog-email"
                type="email"
                value={dialogCustomerInfo.email || ''}
                onChange={(e) => {
                  setDialogCustomerInfo(prev => ({ ...prev, email: e.target.value }));
                  setDialogErrors(prev => ({ ...prev, email: '' }));
                }}
                className={dialogErrors.email ? 'border-destructive' : ''}
                placeholder="Enter email address"
              />
              {dialogErrors.email && (
                <p className="text-sm text-destructive mt-1">{dialogErrors.email}</p>
              )}
            </div>
            <div>
              <Label htmlFor="dialog-phone">
                Phone Number {settings.require_phone && <span className="text-destructive">*</span>}
              </Label>
              <Input
                id="dialog-phone"
                type="tel"
                value={dialogCustomerInfo.phone || ''}
                onChange={(e) => {
                  setDialogCustomerInfo(prev => ({ ...prev, phone: e.target.value }));
                  setDialogErrors(prev => ({ ...prev, phone: '' }));
                }}
                className={dialogErrors.phone ? 'border-destructive' : ''}
                placeholder="Enter phone number"
              />
              {dialogErrors.phone && (
                <p className="text-sm text-destructive mt-1">{dialogErrors.phone}</p>
              )}
            </div>
            <div className="relative">
              <Label htmlFor="dialog-address">
                Project Address {settings.require_address && <span className="text-destructive">*</span>}
              </Label>
              <Input
                id="dialog-address"
                value={dialogCustomerInfo.address || ''}
                onChange={(e) => handleDialogAddressChange(e.target.value)}
                onFocus={() => setShowPredictions(true)}
                onBlur={() => setTimeout(() => setShowPredictions(false), 200)}
                className={dialogErrors.address ? 'border-destructive' : ''}
                placeholder="Enter the project address"
              />
              
              {/* Address predictions dropdown */}
              {showPredictions && predictions.length > 0 && (
                <div className="absolute z-10 w-full mt-1 bg-popover border rounded-md shadow-lg max-h-40 overflow-auto">
                  {predictions.map((prediction) => (
                    <button
                      key={prediction.place_id}
                      type="button"
                      className="w-full px-3 py-2 text-left hover:bg-accent text-sm"
                      onClick={() => handleDialogAddressSelect(prediction.place_id, prediction.description)}
                    >
                      {prediction.description}
                    </button>
                  ))}
                </div>
              )}
              
              {dialogErrors.address && (
                <p className="text-sm text-destructive mt-1">{dialogErrors.address}</p>
              )}
            </div>
          </div>
          <div className="flex gap-3">
            <Button
              variant="outline"
              onClick={() => setShowContactDialog(false)}
              className="flex-1"
            >
              Cancel
            </Button>
            <Button
              onClick={handleContactDialogSubmit}
              className="flex-1"
              variant="success"
            >
              Continue & Submit
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      <div className="max-w-4xl mx-auto px-4 py-2 pb-24 md:pb-6 space-y-6">
      {/* Quote Summary Card with Items */}
      <Card ref={quoteSummaryRef} className="bg-green-50 dark:bg-green-950 border-2 border-green-200 dark:border-green-800 shadow-lg">
        <CardHeader>
          <CardTitle className="text-lg flex items-center gap-2 text-green-700 dark:text-green-400">
            <Calculator className="h-5 w-5" />
            Quote Summary ({items.length} {items.length === 1 ? 'Item' : 'Items'})
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Detailed Quote Items */}
          <div className="space-y-4 mb-6">
            {(() => {
              const { parentItems, consolidatedChildrenByParent } = organizeItemsForDisplay();
              
              return parentItems.map((item, itemIndex) => {
                const quantity = item.measurement.depth 
                  ? (item.measurement.value * item.measurement.depth) / 324 
                  : item.measurement.value;
                const basePrice = quantity * item.unitPrice;
                const consolidatedChildren = consolidatedChildrenByParent.get(item.id) || [];
                
                return (
                  <div key={item.id} className="space-y-2">
                    {/* Parent Product */}
                    <div className="bg-background rounded-lg p-4 border border-green-200 dark:border-green-800">
                  {/* Mobile-optimized layout: stack everything vertically on mobile */}
                  <div className="flex flex-col gap-3 mb-3">
                    {/* Row 1: Color badge + Product name with measurement inline */}
                    <div className="flex items-start gap-2">
                      <div 
                        className="w-3 h-3 rounded-full flex-shrink-0 mt-1.5" 
                        style={{ 
                          backgroundColor: item.measurement.mapColor || '#3B82F6',
                        }}
                      />
                      <h3 className="font-semibold text-base flex-1 break-words leading-tight">
                        {item.productName}
                        <span className="text-sm text-muted-foreground font-normal ml-2">
                          ({item.measurement.depth 
                            ? `${((item.measurement.value * item.measurement.depth) / 324).toFixed(2)} cubic yards`
                            : `${item.measurement.value.toLocaleString()} ${item.measurement.unit.replace('_', ' ')}`
                          })
                        </span>
                      </h3>
                      {onRemoveItem && (
                        <Button 
                          variant="ghost" 
                          size="icon" 
                          className="h-8 w-8 text-destructive hover:text-destructive hover:bg-destructive/10 flex-shrink-0"
                          onClick={() => onRemoveItem(item.id)}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      )}
                    </div>
                  </div>
                  
                  {/* Itemized Breakdown - Show variations and add-ons always, prices conditionally */}
                  <div className="space-y-2">
                    {/* Variation selection */}
                    {item.measurement.variations && item.measurement.variations.length > 0 && (
                      <div className="text-sm text-muted-foreground">
                        ({item.measurement.variations.map((v) => v.name).join(', ')})
                      </div>
                    )}

                    {/* Pricing Breakdown */}
                    {settings.pricing_visibility === 'before_submit' && (
                      <div className="space-y-2">
                        {/* Base Product Calculation */}
                        <div className="text-sm text-muted-foreground pl-3">
                          {(() => {
                            // Calculate variation-adjusted unit price
                            let adjustedUnitPrice = item.unitPrice;
                            if (item.measurement.variations && item.measurement.variations.length > 0) {
                              const variation = item.measurement.variations[0];
                              if (variation.adjustmentType === 'fixed') {
                                adjustedUnitPrice += variation.priceAdjustment;
                              } else if (variation.adjustmentType === 'percentage') {
                                adjustedUnitPrice += (item.unitPrice * variation.priceAdjustment) / 100;
                              }
                            }
                            
                            const displayQuantity = item.measurement.depth 
                              ? ((item.measurement.value * item.measurement.depth) / 324).toFixed(2)
                              : item.measurement.value.toLocaleString();
                            
                            const displayUnit = getDisplayUnit(item.unitType, !!item.measurement.depth);
                            
                            // Show increment info if rounded
                            const quantityLabel = item.measurement.wasRoundedForIncrements 
                              ? `${displayQuantity} ${displayUnit} (rounded)`
                              : `${displayQuantity} ${displayUnit}`;
                            
                            return (
                              <>
                                {quantityLabel} × {formatExactPrice(adjustedUnitPrice, {
                                  currency_symbol: settings.currency_symbol,
                                  decimal_precision: settings.decimal_precision
                                })}/{displayUnit} = <span className="font-semibold text-foreground">{formatExactPrice(basePrice, {
                                  currency_symbol: settings.currency_symbol,
                                  decimal_precision: settings.decimal_precision
                                })}</span>
                              </>
                            );
                          })()}
                        </div>
                        
                        {/* Show increment breakdown */}
                        {item.measurement.wasRoundedForIncrements && item.measurement.incrementsApplied && (
                          <div className="text-xs text-muted-foreground pl-6 space-y-0.5">
                            <div>
                              {item.measurement.originalMeasurement} {getDisplayUnit(item.unitType)} measured → {item.measurement.value} {getDisplayUnit(item.unitType)} 
                            </div>
                            <div>
                              ({item.measurement.incrementsApplied.unitsNeeded} {item.measurement.incrementsApplied.incrementLabel}
                              {item.measurement.incrementsApplied.unitsNeeded > 1 && !item.measurement.incrementsApplied.incrementLabel.endsWith('s') && 's'}
                              {' × '}{item.measurement.incrementsApplied.incrementSize} {getDisplayUnit(item.unitType)})
                            </div>
                          </div>
                        )}
                        
                        {/* Add-ons Section: Traditional measurement add-ons + map-placed add-ons */}
                        {((item.measurement.addons && item.measurement.addons.length > 0) || consolidatedChildren.length > 0) && (
                          <div className="space-y-1">
                            <div className="text-sm text-muted-foreground mt-2">Add-ons:</div>
                            
                            {/* Traditional measurement add-ons with toggles */}
                            {item.measurement.addons?.map((addon) => {
                              // Calculate addon price properly including area calculations
                              let addonPrice = 0;
                              
                              if (addon.calculationType === 'area_calculation') {
                                const variationData = item.measurement.variations && item.measurement.variations.length > 0
                                  ? {
                                      height: item.measurement.variations[0].height_value || null,
                                      unit: item.measurement.variations[0].unit_of_measurement || 'ft',
                                      affects_area_calculation: item.measurement.variations[0].affects_area_calculation || false
                                    }
                                  : undefined;
                                
                                const baseQuantity = item.measurement.depth
                                  ? (item.measurement.value * item.measurement.depth) / 324
                                  : item.measurement.value;
                                
                                addonPrice = calculateAddonWithAreaData(
                                  addon.priceValue,
                                  baseQuantity,
                                  addon.calculationType,
                                  variationData
                                );
                              } else if (addon.calculationType === 'per_unit') {
                                addonPrice = addon.priceValue * quantity;
                              } else {
                                addonPrice = addon.priceValue;
                              }
                              
                              const isEnabled = addon.quantity > 0;
                              
                              return (
                                <div key={addon.id} className="flex items-start justify-between gap-2 pl-3">
                                  <div className="flex-1 text-sm text-muted-foreground">
                                    <span className={`font-medium ${isEnabled ? 'text-foreground' : 'line-through text-muted-foreground'}`}>
                                      {addon.name}
                                      {addon.selectedOptionName && ` (${addon.selectedOptionName})`}
                                    </span>
                                    : {(() => {
                                      const variationData = item.measurement.variations && item.measurement.variations.length > 0
                                        ? {
                                            height: item.measurement.variations[0].height_value || null,
                                            unit: item.measurement.variations[0].unit_of_measurement || 'ft',
                                            affects_area_calculation: item.measurement.variations[0].affects_area_calculation || false
                                          }
                                        : undefined;
                                      
                                      let displayQuantity = '';
                                      let displayUnit = '';
                                      let displayPrice = addon.priceValue;
                                      
                                      if (addon.calculationType === 'area_calculation') {
                                        if (variationData?.height && variationData.affects_area_calculation) {
                                          const linearFeet = item.measurement.value;
                                          const heightFeet = variationData.height;
                                          const squareFeet = linearFeet * heightFeet;
                                          displayQuantity = squareFeet.toLocaleString();
                                          displayUnit = 'SF';
                                        } else {
                                          const baseQuantity = item.measurement.depth
                                            ? (item.measurement.value * item.measurement.depth) / 324
                                            : item.measurement.value;
                                          displayQuantity = baseQuantity.toLocaleString();
                                          displayUnit = getDisplayUnit(item.unitType, !!item.measurement.depth);
                                        }
                                      } else if (addon.calculationType === 'per_unit') {
                                        displayQuantity = quantity.toLocaleString();
                                        displayUnit = getDisplayUnit(item.unitType, !!item.measurement.depth);
                                      } else {
                                        displayQuantity = addon.quantity.toFixed(1);
                                        displayUnit = 'ea';
                                      }
                                      
                                      // Show quantity multiplier when > 1
                                      const qtyMultiplier = addon.quantity > 1 ? ` × ${addon.quantity}` : '';
                                      return ` ${displayQuantity} ${displayUnit} × ${formatExactPrice(displayPrice, {
                                        currency_symbol: settings.currency_symbol,
                                        decimal_precision: settings.decimal_precision
                                      })}/${displayUnit}${qtyMultiplier} = `;
                                    })()}
                                    <span className={`font-semibold ${isEnabled ? 'text-foreground' : 'line-through'}`}>
                                      {formatExactPrice(addonPrice * addon.quantity, {
                                        currency_symbol: settings.currency_symbol,
                                        decimal_precision: settings.decimal_precision
                                      })}
                                    </span>
                                  </div>
                                  <Switch
                                    checked={isEnabled}
                                    onCheckedChange={() => toggleAddon(item.id, addon.id)}
                                    className="scale-90 data-[state=checked]:bg-blue-600 flex-shrink-0"
                                  />
                                </div>
                              );
                            })}
                          </div>
                        )}
                      </div>
                    )}

                    {/* Variations for pricing hidden mode */}
                    {settings.pricing_visibility !== 'before_submit' && item.measurement.addons && item.measurement.addons.length > 0 && (
                      <div className="space-y-1">
                        <div className="text-sm font-bold text-muted-foreground">Add-ons:</div>
                        {item.measurement.addons.map((addon) => {
                          const isEnabled = addon.quantity > 0;
                          
                          return (
                            <div key={addon.id} className="flex items-center justify-between">
                              <div className={isEnabled ? '' : 'line-through text-muted-foreground'}>
                                {addon.name}
                                {addon.selectedOptionName && (
                                  <span className="text-sm text-muted-foreground ml-1">
                                    ({addon.selectedOptionName})
                                  </span>
                                )}
                              </div>
                              <Switch
                                checked={isEnabled}
                                onCheckedChange={() => toggleAddon(item.id, addon.id)}
                                className="scale-90 data-[state=checked]:bg-blue-600"
                              />
                            </div>
                          );
                        })}
                      </div>
                    )}
                    
                    {/* Item Total */}
                    {settings.pricing_visibility === 'before_submit' && (
                      <div className="border-t-2 border-border pt-3 mt-4">
                        <div className="flex justify-end">
                          <span className="text-lg font-bold text-green-600">
                            Total: {formatExactPrice(item.lineTotal, {
                              currency_symbol: settings.currency_symbol,
                              decimal_precision: settings.decimal_precision
                            })}
                          </span>
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            );
          });
        })()}
      </div>

          <Separator className="my-4 bg-green-300 dark:bg-green-700" />

          {settings.pricing_visibility === 'before_submit' && (
            <div id="quote-summary-total" className="space-y-2">
              <div className="flex justify-between text-base">
                <span>Subtotal:</span>
                <span className="font-semibold">
                  {formatExactPrice(subtotal, {
                    currency_symbol: settings.currency_symbol,
                    decimal_precision: settings.decimal_precision
                  })}
                </span>
              </div>
              
              {taxAmount > 0 && (
                <div className="flex justify-between text-sm text-muted-foreground">
                  <span>Tax ({settings.global_tax_rate}%):</span>
                  <span>
                    {formatExactPrice(taxAmount, {
                      currency_symbol: settings.currency_symbol,
                      decimal_precision: settings.decimal_precision
                    })}
                  </span>
                </div>
              )}
              
              <Separator className="my-2 bg-green-300 dark:bg-green-700" />
              
              <div className="flex justify-between text-2xl font-bold pt-2">
                <span>Total:</span>
                <span className="text-green-600">
                  {formatExactPrice(total, {
                    currency_symbol: settings.currency_symbol,
                    decimal_precision: settings.decimal_precision
                  })}
                </span>
              </div>
            </div>
          )}
          
          {settings.pricing_visibility === 'after_submit' && (
            <div id="quote-summary-total" className="text-center py-4">
              <p className="text-muted-foreground">
                Complete pricing details will be shown after you submit your quote request
              </p>
            </div>
          )}

          <div className="flex flex-col sm:flex-row gap-3 mt-6 md:static md:bg-transparent bg-background/95 backdrop-blur-sm md:p-0 p-3 md:rounded-none rounded-t-lg">
            {onAddAnother && (
              <Button
                onClick={onAddAnother}
                variant="outline"
                size="lg"
                className="flex-1 border-2 border-dashed border-primary hover:bg-accent"
              >
                <Plus className="h-5 w-5 mr-2" />
                Add Another Product
              </Button>
            )}
            <Button 
              onClick={handleSubmitQuote} 
              disabled={isSubmitting}
              className="flex-1 bg-green-600 hover:bg-green-700 text-white"
              size="lg"
            >
              {isSubmitting ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin mr-2" />
                  Submitting...
                </>
              ) : (
                <>
                  <FileText className="h-4 w-4 mr-2" />
                  Submit Quote
                </>
              )}
            </Button>
          </div>

        </CardContent>
      </Card>
      </div>

      {/* Contact Information Dialog */}
      <Dialog open={showContactDialog} onOpenChange={setShowContactDialog}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Contact Information</DialogTitle>
            <DialogDescription>
              Please provide your contact details to receive your quote
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label htmlFor="firstName">First Name *</Label>
                <Input
                  id="firstName"
                  value={dialogCustomerInfo.firstName || ''}
                  onChange={(e) => setDialogCustomerInfo(prev => ({ ...prev, firstName: e.target.value }))}
                  className={dialogErrors.firstName ? 'border-destructive' : ''}
                />
                {dialogErrors.firstName && <p className="text-xs text-destructive mt-1">{dialogErrors.firstName}</p>}
              </div>
              <div>
                <Label htmlFor="lastName">Last Name *</Label>
                <Input
                  id="lastName"
                  value={dialogCustomerInfo.lastName || ''}
                  onChange={(e) => setDialogCustomerInfo(prev => ({ ...prev, lastName: e.target.value }))}
                  className={dialogErrors.lastName ? 'border-destructive' : ''}
                />
                {dialogErrors.lastName && <p className="text-xs text-destructive mt-1">{dialogErrors.lastName}</p>}
              </div>
            </div>
            
            {settings.require_email !== false && (
              <div>
                <Label htmlFor="email">Email *</Label>
                <Input
                  id="email"
                  type="email"
                  value={dialogCustomerInfo.email || ''}
                  onChange={(e) => setDialogCustomerInfo(prev => ({ ...prev, email: e.target.value }))}
                  className={dialogErrors.email ? 'border-destructive' : ''}
                />
                {dialogErrors.email && <p className="text-xs text-destructive mt-1">{dialogErrors.email}</p>}
              </div>
            )}
            
            {settings.require_phone !== false && (
              <div>
                <Label htmlFor="phone">Phone *</Label>
                <Input
                  id="phone"
                  type="tel"
                  value={dialogCustomerInfo.phone || ''}
                  onChange={(e) => setDialogCustomerInfo(prev => ({ ...prev, phone: e.target.value }))}
                  className={dialogErrors.phone ? 'border-destructive' : ''}
                />
                {dialogErrors.phone && <p className="text-xs text-destructive mt-1">{dialogErrors.phone}</p>}
              </div>
            )}
            
            {settings.require_address !== false && (
              <div>
                <Label htmlFor="address">Address *</Label>
                <div className="relative">
                  <Input
                    id="address"
                    value={dialogCustomerInfo.address || ''}
                    onChange={(e) => {
                      setDialogCustomerInfo(prev => ({ ...prev, address: e.target.value }));
                      getAutocomplete(e.target.value);
                      setShowPredictions(true);
                    }}
                    onFocus={() => dialogCustomerInfo.address && predictions.length > 0 && setShowPredictions(true)}
                    className={dialogErrors.address ? 'border-destructive' : ''}
                  />
                  {showPredictions && predictions.length > 0 && (
                    <div className="absolute z-50 w-full bg-popover border rounded-md shadow-lg mt-1 max-h-60 overflow-auto">
                      {predictions.map((prediction) => (
                        <button
                          key={prediction.place_id}
                          type="button"
                          className="w-full text-left px-3 py-2 hover:bg-accent text-sm"
                          onClick={() => handleDialogAddressSelect(prediction.place_id, prediction.description)}
                        >
                          {prediction.description}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
                {dialogErrors.address && <p className="text-xs text-destructive mt-1">{dialogErrors.address}</p>}
              </div>
            )}

            <Button 
              onClick={handleContactDialogSubmit}
              className="w-full"
            >
              Continue
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Clarifying Questions Dialog */}
      <ClarifyingQuestionsDialog
        open={showClarifyingDialog}
        questions={clarifyingQuestions}
        onSubmit={handleClarifyingQuestionsSubmit}
        onCancel={() => setShowClarifyingDialog(false)}
      />
    </>
  );
};

export default QuoteReview;