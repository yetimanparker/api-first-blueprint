import React, { useState, useCallback, useRef, useEffect } from 'react';
import { MapContainer, TileLayer, useMap } from 'react-leaflet';
import { LatLng, Map as LeafletMap } from 'leaflet';
import 'leaflet/dist/leaflet.css';
import 'leaflet-draw/dist/leaflet.draw.css';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Ruler, Square, MapPin, ArrowLeft, ArrowRight, Plus, Trash2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useServiceArea } from '@/hooks/useServiceArea';
import { MeasurementTools } from './MeasurementTools';
import { ProductSelector } from './ProductSelector';
import { QuoteBuilder } from './QuoteBuilder';
import { ContactForm } from './ContactForm';
import { useGlobalSettings } from '@/hooks/useGlobalSettings';

export interface MeasurementData {
  type: 'area' | 'line';
  value: number;
  coordinates: LatLng[];
  unit: string;
}

export interface QuoteItem {
  id: string;
  productId: string;
  productName: string;
  measurement: MeasurementData;
  unitPrice: number;
  subtotal: number;
  customName?: string;
  notes?: string;
  variations?: Array<{ id: string; name: string; price: number }>;
  addons?: Array<{ id: string; name: string; quantity: number; price: number }>;
}

export interface ContactInfo {
  firstName: string;
  lastName: string;
  email: string;
  phone?: string;
  address?: string;
}

interface MeasurementWidgetProps {
  contractorId: string;
  mode?: 'embedded' | 'standalone';
  onQuoteSubmit?: (quote: any) => void;
  className?: string;
}

type WidgetStep = 'contact' | 'address' | 'product' | 'measure' | 'configure' | 'quote' | 'complete';

export const MeasurementWidget: React.FC<MeasurementWidgetProps> = ({
  contractorId,
  mode = 'standalone',
  onQuoteSubmit,
  className
}) => {
  const { settings, loading: settingsLoading } = useGlobalSettings();
  const { validateByAddress, isValidating } = useServiceArea();

  const [currentStep, setCurrentStep] = useState<WidgetStep>('contact');
  const [progress, setProgress] = useState(0);
  const [contactInfo, setContactInfo] = useState<ContactInfo>({
    firstName: '',
    lastName: '',
    email: '',
    phone: '',
    address: ''
  });
  const [serviceAreaValid, setServiceAreaValid] = useState<boolean | null>(null);
  const [currentMeasurement, setCurrentMeasurement] = useState<MeasurementData | null>(null);
  const [selectedProduct, setSelectedProduct] = useState<any>(null);
  const [quoteItems, setQuoteItems] = useState<QuoteItem[]>([]);
  const [mapCenter, setMapCenter] = useState<LatLng>(new LatLng(39.8283, -98.5795)); // Default to US center
  const [manualMeasurement, setManualMeasurement] = useState<string>('');

  // Update step when settings load
  useEffect(() => {
    if (!settingsLoading && settings) {
      setCurrentStep(settings.contactCaptureFlow === 'after_quote' ? 'product' : 'contact');
    }
  }, [settings, settingsLoading]);

  const steps: WidgetStep[] = !settings || settings.contactCaptureFlow === 'before_quote' 
    ? ['contact', 'address', 'product', 'measure', 'configure', 'quote', 'complete']
    : ['product', 'measure', 'configure', 'contact', 'quote', 'complete'];

  const stepTitles = {
    'contact': 'Contact Information',
    'address': 'Service Address',
    'product': 'Select Product',
    'measure': 'Measure Area',
    'configure': 'Configure Quote Item',
    'quote': 'Review Quote',
    'complete': 'Quote Complete'
  };

  useEffect(() => {
    const currentIndex = steps.indexOf(currentStep);
    setProgress((currentIndex / (steps.length - 1)) * 100);
  }, [currentStep, steps]);

  const validateServiceArea = useCallback(async (address: string) => {
    if (!settings?.serviceAreaEnabled || !address.trim()) {
      setServiceAreaValid(true);
      return true;
    }

    const result = await validateByAddress(contractorId, address);
    const isValid = result?.valid || false;
    setServiceAreaValid(isValid);
    
    if (isValid && result?.method === 'radius' && contactInfo.address) {
      // If we have coordinates from the validation, center the map there
      // This would need to be extracted from the validation result
    }
    
    return isValid;
  }, [contractorId, settings, validateByAddress, contactInfo.address]);

  const handleContactSubmit = useCallback(async (contact: ContactInfo) => {
    setContactInfo(contact);
    
    if (contact.address && settings?.serviceAreaEnabled) {
      const isValid = await validateServiceArea(contact.address);
      if (!isValid) {
        return; // Stay on current step if service area is invalid
      }
    }

    const nextStepIndex = steps.indexOf(currentStep) + 1;
    if (nextStepIndex < steps.length) {
      setCurrentStep(steps[nextStepIndex]);
    }
  }, [currentStep, steps, settings, validateServiceArea]);

  const handleProductSelect = useCallback((product: any) => {
    setSelectedProduct(product);
    const nextStepIndex = steps.indexOf(currentStep) + 1;
    if (nextStepIndex < steps.length) {
      setCurrentStep(steps[nextStepIndex]);
    }
  }, [currentStep, steps]);

  const handleMeasurementComplete = useCallback((measurement: MeasurementData) => {
    setCurrentMeasurement(measurement);
    const nextStepIndex = steps.indexOf(currentStep) + 1;
    if (nextStepIndex < steps.length) {
      setCurrentStep(steps[nextStepIndex]);
    }
  }, [currentStep, steps]);

  const handleManualMeasurement = useCallback(() => {
    if (!manualMeasurement || !selectedProduct) return;

    const value = parseFloat(manualMeasurement);
    if (isNaN(value) || value <= 0) return;

    const measurement: MeasurementData = {
      type: selectedProduct.unit_type === 'sq_ft' ? 'area' : 'line',
      value: Math.ceil(value), // Round up as per PRD
      coordinates: [],
      unit: selectedProduct.unit_type
    };

    handleMeasurementComplete(measurement);
  }, [manualMeasurement, selectedProduct, handleMeasurementComplete]);

  const handleQuoteItemSave = useCallback((item: QuoteItem) => {
    setQuoteItems(prev => [...prev, item]);
    
    // Reset for next item
    setCurrentMeasurement(null);
    setSelectedProduct(null);
    setManualMeasurement('');
    
    // Go back to product selection
    setCurrentStep('product');
  }, []);

  const handleFinishQuote = useCallback(() => {
    const nextStepIndex = steps.indexOf(currentStep) + 1;
    if (nextStepIndex < steps.length) {
      setCurrentStep(steps[nextStepIndex]);
    }
  }, [currentStep, steps]);

  const handleBack = useCallback(() => {
    const currentIndex = steps.indexOf(currentStep);
    if (currentIndex > 0) {
      setCurrentStep(steps[currentIndex - 1]);
    }
  }, [currentStep, steps]);

  const renderCurrentStep = () => {
    switch (currentStep) {
      case 'contact':
        return (
          <ContactForm
            initialData={contactInfo}
            onSubmit={handleContactSubmit}
            settings={settings}
            contractorId={contractorId}
          />
        );

      case 'address':
        return (
          <div className="space-y-4">
            <div>
              <Label htmlFor="address">Service Address *</Label>
              <Input
                id="address"
                value={contactInfo.address || ''}
                onChange={(e) => setContactInfo(prev => ({ ...prev, address: e.target.value }))}
                placeholder="Enter the address where service will be performed"
                className="mt-1"
              />
            </div>
            
            {serviceAreaValid === false && (
              <div className="p-4 bg-destructive/10 border border-destructive/20 rounded-lg">
                <p className="text-destructive text-sm">
                  Sorry, this address appears to be outside our service area. Please contact us directly for assistance.
                </p>
              </div>
            )}

            <Button 
              onClick={() => validateServiceArea(contactInfo.address || '')}
              disabled={!contactInfo.address?.trim() || isValidating}
              className="w-full"
            >
              {isValidating ? 'Checking Service Area...' : 'Continue'}
            </Button>
          </div>
        );

      case 'product':
        return (
          <ProductSelector
            contractorId={contractorId}
            onProductSelect={handleProductSelect}
            onFinishQuote={quoteItems.length > 0 ? handleFinishQuote : undefined}
          />
        );

      case 'measure':
        return (
          <div className="space-y-4">
            {/* Map Container */}
            <div className="h-64 md:h-96 relative bg-muted rounded-lg overflow-hidden">
              <MapContainer
                center={mapCenter}
                zoom={13}
                className="h-full w-full"
                zoomControl={false}
              >
                <TileLayer
                  url="https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}"
                  attribution='&copy; <a href="https://www.esri.com/">Esri</a>'
                />
                <MeasurementTools
                  measurementType={selectedProduct?.unit_type === 'sq_ft' ? 'area' : 'line'}
                  onMeasurementComplete={handleMeasurementComplete}
                />
              </MapContainer>
            </div>

            {/* Manual Entry Option */}
            <div className="space-y-2">
              <Label htmlFor="manual-measurement">
                Or enter measurement manually ({selectedProduct?.unit_type || 'sq_ft'})
              </Label>
              <div className="flex gap-2">
                <Input
                  id="manual-measurement"
                  type="number"
                  value={manualMeasurement}
                  onChange={(e) => setManualMeasurement(e.target.value)}
                  placeholder={`Enter ${selectedProduct?.unit_type === 'sq_ft' ? 'square feet' : 'linear feet'}`}
                  className="flex-1"
                />
                <Button onClick={handleManualMeasurement} disabled={!manualMeasurement}>
                  Use This
                </Button>
              </div>
            </div>

            <div className="text-sm text-muted-foreground">
              {selectedProduct?.unit_type === 'sq_ft' 
                ? 'Draw a polygon around the area to be measured'
                : 'Draw a line along the perimeter to be measured'
              }
            </div>
          </div>
        );

      case 'configure':
        return currentMeasurement && selectedProduct ? (
          <QuoteBuilder
            product={selectedProduct}
            measurement={currentMeasurement}
            onSave={handleQuoteItemSave}
            contractorId={contractorId}
          />
        ) : null;

      case 'quote':
        return (
          <div className="space-y-4">
            <h3 className="text-lg font-semibold">Quote Summary</h3>
            
            {quoteItems.map((item, index) => (
              <Card key={item.id} className="p-4">
                <div className="flex justify-between items-start">
                  <div className="flex-1">
                    <h4 className="font-medium">{item.customName || item.productName}</h4>
                    <p className="text-sm text-muted-foreground">
                      {item.measurement.value} {item.measurement.unit} × ${item.unitPrice}
                    </p>
                    {item.notes && (
                      <p className="text-sm text-muted-foreground mt-1">{item.notes}</p>
                    )}
                  </div>
                  <div className="text-right">
                    <p className="font-medium">${item.subtotal.toFixed(2)}</p>
                  </div>
                </div>
              </Card>
            ))}

            <div className="border-t pt-4">
              <div className="flex justify-between items-center text-lg font-semibold">
                <span>Total</span>
                <span>${quoteItems.reduce((sum, item) => sum + item.subtotal, 0).toFixed(2)}</span>
              </div>
            </div>

            <Button onClick={() => setCurrentStep('complete')} className="w-full">
              Submit Quote Request
            </Button>
          </div>
        );

      case 'complete':
        return (
          <div className="text-center space-y-4">
            <div className="w-16 h-16 bg-success/10 rounded-full flex items-center justify-center mx-auto">
              <Badge className="w-8 h-8 text-success" />
            </div>
            <h3 className="text-lg font-semibold">Quote Request Submitted!</h3>
            <p className="text-muted-foreground">
              Thank you for your request. We'll review your quote and get back to you shortly.
            </p>
          </div>
        );

      default:
        return null;
    }
  };

  if (settingsLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    );
  }

  return (
    <div className={cn('max-w-2xl mx-auto bg-background rounded-lg shadow-lg overflow-hidden', className)}>
      {/* Header */}
      <div className="bg-primary text-primary-foreground p-4">
        <div className="flex items-center justify-between mb-2">
          <h2 className="text-lg font-semibold">Get Your Quote</h2>
          {currentStep !== 'complete' && steps.indexOf(currentStep) > 0 && (
            <Button
              variant="ghost"
              size="sm"
              onClick={handleBack}
              className="text-primary-foreground hover:bg-primary-foreground/20"
            >
              <ArrowLeft className="h-4 w-4 mr-1" />
              Back
            </Button>
          )}
        </div>
        
        {currentStep !== 'complete' && (
          <>
            <div className="text-sm opacity-90 mb-2">
              {stepTitles[currentStep]}
            </div>
            <Progress value={progress} className="h-2 bg-primary-foreground/20" />
          </>
        )}
      </div>

      {/* Content */}
      <div className="p-4 md:p-6">
        {renderCurrentStep()}
      </div>

      {/* Quote Items Summary (if any) */}
      {quoteItems.length > 0 && currentStep !== 'quote' && currentStep !== 'complete' && (
        <div className="border-t bg-muted/50 p-4">
          <div className="flex items-center justify-between text-sm">
            <span>{quoteItems.length} item{quoteItems.length > 1 ? 's' : ''} added</span>
            <span className="font-medium">
              ${quoteItems.reduce((sum, item) => sum + item.subtotal, 0).toFixed(2)}
            </span>
          </div>
        </div>
      )}
    </div>
  );
};