import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Loader2, MapPin, Shield } from 'lucide-react';
import { CustomerInfo } from '@/types/widget';
import { GlobalSettings } from '@/hooks/useGlobalSettings';
import { useGooglePlaces } from '@/hooks/useGooglePlaces';

interface ContactFormProps {
  customerInfo: Partial<CustomerInfo>;
  onUpdate: (info: Partial<CustomerInfo>) => void;
  onNext: () => void;
  settings: GlobalSettings;
  isServiceAreaValid?: boolean;
  isValidating: boolean;
}

const ContactForm = ({ 
  customerInfo, 
  onUpdate, 
  onNext, 
  settings, 
  isServiceAreaValid,
  isValidating 
}: ContactFormProps) => {
  const [errors, setErrors] = useState<Record<string, string>>({});
  const { getAutocomplete, getPlaceDetails, predictions, loading } = useGooglePlaces();
  const [showPredictions, setShowPredictions] = useState(false);

  const handleInputChange = (field: keyof CustomerInfo, value: string) => {
    onUpdate({ [field]: value });
    if (errors[field]) {
      setErrors(prev => ({ ...prev, [field]: '' }));
    }

    // Handle address autocomplete
    if (field === 'address' && value.length > 2) {
      getAutocomplete(value);
      setShowPredictions(true);
    }
  };

  const handleAddressSelect = async (placeId: string, description: string) => {
    setShowPredictions(false);
    
    const placeDetails = await getPlaceDetails(placeId);
    if (placeDetails) {
        onUpdate({
          address: description,
          city: placeDetails?.city,
          state: placeDetails?.state,
          zipCode: placeDetails?.zipCode,
          lat: placeDetails?.lat,
          lng: placeDetails?.lng
        });
    } else {
      onUpdate({ address: description });
    }
  };

  const validateForm = () => {
    const newErrors: Record<string, string> = {};

    if (!customerInfo.firstName?.trim()) {
      newErrors.firstName = 'First name is required';
    }
    if (!customerInfo.lastName?.trim()) {
      newErrors.lastName = 'Last name is required';
    }
    if (settings.require_email !== false && !customerInfo.email?.trim()) {
      newErrors.email = 'Email is required';
    }
    if (customerInfo.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(customerInfo.email)) {
      newErrors.email = 'Please enter a valid email address';
    }
    if (settings.require_phone !== false && !customerInfo.phone?.trim()) {
      newErrors.phone = 'Phone number is required';
    }
    if (settings.require_address !== false && !customerInfo.address?.trim()) {
      newErrors.address = 'Address is required';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    console.log('ContactForm: Form submitted with:', customerInfo);
    console.log('ContactForm: Service area valid:', isServiceAreaValid);
    console.log('ContactForm: Is validating:', isValidating);
    
    if (validateForm()) {
      console.log('ContactForm: Form validation passed, calling onNext()');
      // Don't block on service area validation - let user proceed 
      onNext();
    } else {
      console.log('ContactForm: Form validation failed');
    }
  };

  return (
    <Card className="max-w-2xl mx-auto">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <MapPin className="h-5 w-5 text-primary" />
          Contact Information
        </CardTitle>
        <p className="text-sm text-muted-foreground">
          Please provide your contact details to get started
        </p>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <Label htmlFor="firstName">
                First Name <span className="text-destructive">*</span>
              </Label>
              <Input
                id="firstName"
                value={customerInfo.firstName || ''}
                onChange={(e) => handleInputChange('firstName', e.target.value)}
                className={errors.firstName ? 'border-destructive' : ''}
                placeholder="Enter your first name"
              />
              {errors.firstName && (
                <p className="text-sm text-destructive mt-1">{errors.firstName}</p>
              )}
            </div>

            <div>
              <Label htmlFor="lastName">
                Last Name <span className="text-destructive">*</span>
              </Label>
              <Input
                id="lastName"
                value={customerInfo.lastName || ''}
                onChange={(e) => handleInputChange('lastName', e.target.value)}
                className={errors.lastName ? 'border-destructive' : ''}
                placeholder="Enter your last name"
              />
              {errors.lastName && (
                <p className="text-sm text-destructive mt-1">{errors.lastName}</p>
              )}
            </div>
          </div>

          <div>
            <Label htmlFor="email">
              Email {settings.require_email && <span className="text-destructive">*</span>}
            </Label>
            <Input
              id="email"
              type="email"
              value={customerInfo.email || ''}
              onChange={(e) => handleInputChange('email', e.target.value)}
              className={errors.email ? 'border-destructive' : ''}
              placeholder="Enter your email address"
            />
            {errors.email && (
              <p className="text-sm text-destructive mt-1">{errors.email}</p>
            )}
          </div>

          <div>
            <Label htmlFor="phone">
              Phone Number {settings.require_phone && <span className="text-destructive">*</span>}
            </Label>
            <Input
              id="phone"
              type="tel"
              value={customerInfo.phone || ''}
              onChange={(e) => handleInputChange('phone', e.target.value)}
              className={errors.phone ? 'border-destructive' : ''}
              placeholder="Enter your phone number"
            />
            {errors.phone && (
              <p className="text-sm text-destructive mt-1">{errors.phone}</p>
            )}
          </div>

          <div className="relative">
            <Label htmlFor="address">
              Project Address {settings.require_address && <span className="text-destructive">*</span>}
            </Label>
            <Input
              id="address"
              value={customerInfo.address || ''}
              onChange={(e) => handleInputChange('address', e.target.value)}
              onFocus={() => setShowPredictions(true)}
              onBlur={() => setTimeout(() => setShowPredictions(false), 200)}
              className={errors.address ? 'border-destructive' : ''}
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
                    onClick={() => handleAddressSelect(prediction.place_id, prediction.description)}
                  >
                    {prediction.description}
                  </button>
                ))}
              </div>
            )}
            
            {errors.address && (
              <p className="text-sm text-destructive mt-1">{errors.address}</p>
            )}
            
            {/* Service area validation feedback */}
            {isValidating && customerInfo.address && (
              <p className="text-sm text-muted-foreground mt-1 flex items-center gap-1">
                <Loader2 className="h-3 w-3 animate-spin" />
                Checking service area...
              </p>
            )}
            
            {isServiceAreaValid === true && (
              <p className="text-sm text-success mt-1 flex items-center gap-1">
                <Shield className="h-3 w-3" />
                Address is within service area
              </p>
            )}
            
            {isServiceAreaValid === false && (
              <p className="text-sm text-destructive mt-1">
                This address may be outside our service area. We'll verify during quote review.
              </p>
            )}
          </div>

          <div className="bg-muted p-4 rounded-lg">
            <div className="flex items-start gap-2">
              <Shield className="h-4 w-4 text-muted-foreground mt-0.5 flex-shrink-0" />
              <div className="text-sm text-muted-foreground">
                <strong>Privacy Notice:</strong> Your information is secure and will only be used to provide your quote and follow up on your project. We do not share your data with third parties.
              </div>
            </div>
          </div>

          <Button 
            type="submit" 
            variant="default"
            size="lg"
            className="w-full mt-6 bg-primary text-primary-foreground hover:bg-primary/90"
          >
            Continue
          </Button>
        </form>
      </CardContent>
    </Card>
  );
};

export default ContactForm;