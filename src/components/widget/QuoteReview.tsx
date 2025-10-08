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
import { Input } from '@/components/ui/input';
import { Loader2, FileText, DollarSign, Plus, MessageSquare, Calculator, Trash2, User } from 'lucide-react';
import { QuoteItem, CustomerInfo, WorkflowStep } from '@/types/widget';
import { GlobalSettings } from '@/hooks/useGlobalSettings';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { 
  applyGlobalMarkup, 
  applyGlobalTax, 
  formatExactPrice,
  calculateFinalPrice 
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
  onRemoveItem
}: QuoteReviewProps) => {
  const [projectComments, setProjectComments] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [items, setItems] = useState<QuoteItem[]>(quoteItems);
  const [showContactDialog, setShowContactDialog] = useState(false);
  const [dialogCustomerInfo, setDialogCustomerInfo] = useState<Partial<CustomerInfo>>({});
  const [dialogErrors, setDialogErrors] = useState<Record<string, string>>({});
  const { toast } = useToast();
  const quoteSummaryRef = useRef<HTMLDivElement>(null);

  // Sync local items state with parent quoteItems prop
  useEffect(() => {
    setItems(quoteItems);
  }, [quoteItems]);

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
      
      const updatedAddons = item.addons?.map(addon => {
        if (addon.id === addonId) {
          const newQuantity = addon.quantity > 0 ? 0 : 1;
          return { ...addon, quantity: newQuantity };
        }
        return addon;
      }) || [];

      // Recalculate line total
      let basePrice = item.measurement.value * item.unitPrice;
      
      // Apply variations
      if (item.variations && item.variations.length > 0) {
        item.variations.forEach(variation => {
          if (variation.adjustmentType === 'percentage') {
            basePrice += basePrice * (variation.priceAdjustment / 100);
          } else {
            basePrice += variation.priceAdjustment * item.measurement.value;
          }
        });
      }
      
      // Apply active addons
      let addonsTotal = 0;
      updatedAddons.forEach(addon => {
        if (addon.quantity > 0) {
          if (addon.calculationType === 'per_unit') {
            addonsTotal += addon.priceValue * item.measurement.value * addon.quantity;
          } else {
            addonsTotal += addon.priceValue * addon.quantity;
          }
        }
      });

      const newLineTotal = basePrice + addonsTotal;

      return {
        ...item,
        addons: updatedAddons,
        lineTotal: newLineTotal
      };
    }));
  };

  const handleCommentsChange = (comments: string) => {
    setProjectComments(comments);
    onUpdateComments(comments);
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

    setDialogErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleContactDialogSubmit = () => {
    if (validateDialogForm()) {
      onUpdateCustomerInfo(dialogCustomerInfo);
      setShowContactDialog(false);
      // Now submit the quote with the updated info
      submitQuote(dialogCustomerInfo);
    }
  };

  const handleSubmitQuote = async () => {
    if (!contractorId) {
      toast({
        title: "Error",
        description: "Contractor information is missing",
        variant: "destructive",
      });
      return;
    }

    // If contact info is missing and timing requires capture on submit, show dialog
    if ((!customerInfo.firstName || !customerInfo.lastName || !customerInfo.email) && 
        (settings.contact_capture_timing === 'on_submit' || settings.contact_capture_timing === 'after_quote')) {
      setDialogCustomerInfo(customerInfo);
      setShowContactDialog(true);
      return;
    }

    // Otherwise proceed with submission
    submitQuote(customerInfo);
  };

  const submitQuote = async (contactInfo: Partial<CustomerInfo>) => {
    setIsSubmitting(true);

    try {
      const quoteItemsData = items.map(item => ({
        productId: item.productId,
        quantity: item.quantity,
        unitPrice: item.unitPrice,
        lineTotal: item.lineTotal,
        measurementData: {
          type: item.measurement.type,
          value: item.measurement.value,
          unit: item.measurement.unit,
          coordinates: item.measurement.coordinates || [],
          manualEntry: item.measurement.manualEntry || false,
          customName: item.customName || '',
          variations: (item.variations || []).map(v => ({
            id: v.id,
            name: v.name,
            priceAdjustment: v.priceAdjustment,
            adjustmentType: v.adjustmentType
          })),
          addons: (item.addons || []).map(a => ({
            id: a.id,
            name: a.name,
            priceValue: a.priceValue,
            calculationType: a.calculationType,
            quantity: a.quantity
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
        },
      });

      if (error) throw error;

      toast({
        title: "Quote Submitted!",
        description: `Your quote #${data.quoteNumber} has been submitted successfully. We'll be in touch soon!`,
      });

      onNext();
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
      <div className="max-w-3xl mx-auto px-4 py-6">
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

      <div className="max-w-4xl mx-auto px-4 py-6 space-y-6">
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
            {items.map((item) => {
              const basePrice = item.measurement.value * item.unitPrice;
              
              return (
                <div key={item.id} className="bg-background rounded-lg p-4 border border-green-200 dark:border-green-800">
                  <div className="flex items-start justify-between mb-3">
                    <div className="flex items-start gap-3 flex-1">
                      <div 
                        className="w-3 h-3 rounded-full flex-shrink-0 mt-1.5"
                        style={{ backgroundColor: '#10B981' }}
                      />
                      <div>
                        <p className="font-semibold text-lg">{item.productName}</p>
                        <p className="text-sm text-muted-foreground">
                          {item.measurement.value.toLocaleString()} {item.measurement.unit.replace('_', ' ')}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-3">
                      <p className="font-bold text-xl text-green-600">
                        {formatExactPrice(item.lineTotal, {
                          currency_symbol: settings.currency_symbol,
                          decimal_precision: settings.decimal_precision
                        })}
                      </p>
                      <Button 
                        variant="ghost" 
                        size="icon" 
                        className="text-destructive hover:text-destructive"
                        onClick={() => onRemoveItem?.(item.id)}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                  
                  {/* Itemized Breakdown */}
                  <div className="ml-6 space-y-2 text-sm">
                    {/* Base Product */}
                    <div className="text-muted-foreground">
                      Base {item.productName}: {item.measurement.value.toLocaleString()} {item.measurement.unit.replace('_', ' ')} × {formatExactPrice(item.unitPrice, {
                        currency_symbol: settings.currency_symbol,
                        decimal_precision: settings.decimal_precision
                      })} = {formatExactPrice(basePrice, {
                        currency_symbol: settings.currency_symbol,
                        decimal_precision: settings.decimal_precision
                      })}
                    </div>

                    {/* Variations */}
                    {item.variations && item.variations.length > 0 && item.variations.map((variation) => {
                      const variationPrice = variation.adjustmentType === 'percentage'
                        ? basePrice * (variation.priceAdjustment / 100)
                        : variation.priceAdjustment * item.measurement.value;
                      
                      return (
                        <div key={variation.id} className="text-muted-foreground">
                          {variation.name}: {variation.adjustmentType === 'percentage' ? `${variation.priceAdjustment}%` : `${item.measurement.value.toLocaleString()} ${item.measurement.unit.replace('_', ' ')} × ${formatExactPrice(variation.priceAdjustment, {
                            currency_symbol: settings.currency_symbol,
                            decimal_precision: settings.decimal_precision
                          })}`} = {formatExactPrice(variationPrice, {
                            currency_symbol: settings.currency_symbol,
                            decimal_precision: settings.decimal_precision
                          })}
                        </div>
                      );
                    })}

                    {/* Add-ons with Toggles */}
                    {item.addons && item.addons.length > 0 && item.addons.map((addon) => {
                      const addonPrice = addon.calculationType === 'per_unit'
                        ? addon.priceValue * item.measurement.value
                        : addon.priceValue;
                      const isEnabled = addon.quantity > 0;
                      
                      return (
                        <div key={addon.id} className="flex items-center gap-2">
                          <Switch
                            checked={isEnabled}
                            onCheckedChange={() => toggleAddon(item.id, addon.id)}
                            className="scale-75"
                          />
                          <span className={isEnabled ? 'text-foreground' : 'text-muted-foreground line-through'}>
                            {addon.name}: {addon.calculationType === 'per_unit' ? `${item.measurement.value.toLocaleString()} ${item.measurement.unit.replace('_', ' ')} × ` : ''}{formatExactPrice(addon.priceValue, {
                              currency_symbol: settings.currency_symbol,
                              decimal_precision: settings.decimal_precision
                            })} = {formatExactPrice(addonPrice, {
                              currency_symbol: settings.currency_symbol,
                              decimal_precision: settings.decimal_precision
                            })}
                          </span>
                        </div>
                      );
                    })}
                  </div>
                </div>
              );
            })}
          </div>

          <Separator className="my-4 bg-green-300 dark:bg-green-700" />

          <div className="space-y-2">
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

          <div className="flex flex-col sm:flex-row gap-3 mt-6">
            {onAddAnother && (
              <Button
                onClick={onAddAnother}
                variant="outline"
                size="lg"
                className="border-2 border-dashed border-primary hover:bg-accent"
              >
                <Plus className="h-5 w-5 mr-2" />
                Add Another Product
              </Button>
            )}
            <Button 
              onClick={handleSubmitQuote} 
              disabled={isSubmitting}
              variant="success"
              className="flex-1"
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
    </>
  );
};

export default QuoteReview;