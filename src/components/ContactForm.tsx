import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { ContactInfo } from './MeasurementWidget';
import { useToast } from '@/hooks/use-toast';
import { User, Mail, Phone, MapPin } from 'lucide-react';

interface ContactFormProps {
  initialData: ContactInfo;
  onSubmit: (contactInfo: ContactInfo) => void;
  settings?: any;
  contractorId: string;
}

export const ContactForm: React.FC<ContactFormProps> = ({
  initialData,
  onSubmit,
  settings
}) => {
  const [formData, setFormData] = useState<ContactInfo>(initialData);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const { toast } = useToast();

  const validateForm = (): boolean => {
    const newErrors: Record<string, string> = {};

    // Required fields
    if (!formData.firstName.trim()) {
      newErrors.firstName = 'First name is required';
    }

    if (!formData.lastName.trim()) {
      newErrors.lastName = 'Last name is required';
    }

    if (!formData.email.trim()) {
      newErrors.email = 'Email is required';
    } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(formData.email)) {
      newErrors.email = 'Please enter a valid email address';
    }

    // Optional fields based on settings
    if (settings?.require_phone && !formData.phone?.trim()) {
      newErrors.phone = 'Phone number is required';
    }

    if (settings?.require_address && !formData.address?.trim()) {
      newErrors.address = 'Address is required';
    }

    // Phone validation if provided
    if (formData.phone && !/^[\d\s\-\(\)\+\.]+$/.test(formData.phone)) {
      newErrors.phone = 'Please enter a valid phone number';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    
    if (validateForm()) {
      onSubmit(formData);
    } else {
      toast({
        title: "Form Validation Error",
        description: "Please correct the errors in the form before continuing.",
        variant: "destructive",
      });
    }
  };

  const handleInputChange = (field: keyof ContactInfo, value: string) => {
    setFormData(prev => ({ ...prev, [field]: value }));
    
    // Clear error when user starts typing
    if (errors[field]) {
      setErrors(prev => ({ ...prev, [field]: '' }));
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="text-center mb-6">
        <h3 className="text-lg font-semibold text-foreground mb-2">
          Let's Get Started
        </h3>
        <p className="text-sm text-muted-foreground">
          We'll need some basic information to prepare your quote.
        </p>
      </div>

      {/* Required Fields Notice */}
      <Card className="p-3 bg-primary/5 border-primary/20">
        <div className="flex items-center gap-2 text-sm">
          <Badge variant="secondary" className="text-xs">Required</Badge>
          <span className="text-muted-foreground">
            Fields marked with * are required
          </span>
        </div>
      </Card>

      {/* Name Fields */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div>
          <Label htmlFor="firstName" className="flex items-center gap-2">
            <User className="h-4 w-4" />
            First Name *
          </Label>
          <Input
            id="firstName"
            type="text"
            value={formData.firstName}
            onChange={(e) => handleInputChange('firstName', e.target.value)}
            className={`mt-1 ${errors.firstName ? 'border-destructive' : ''}`}
            placeholder="Enter your first name"
          />
          {errors.firstName && (
            <p className="text-xs text-destructive mt-1">{errors.firstName}</p>
          )}
        </div>

        <div>
          <Label htmlFor="lastName" className="flex items-center gap-2">
            <User className="h-4 w-4" />
            Last Name *
          </Label>
          <Input
            id="lastName"
            type="text"
            value={formData.lastName}
            onChange={(e) => handleInputChange('lastName', e.target.value)}
            className={`mt-1 ${errors.lastName ? 'border-destructive' : ''}`}
            placeholder="Enter your last name"
          />
          {errors.lastName && (
            <p className="text-xs text-destructive mt-1">{errors.lastName}</p>
          )}
        </div>
      </div>

      {/* Email */}
      <div>
        <Label htmlFor="email" className="flex items-center gap-2">
          <Mail className="h-4 w-4" />
          Email Address *
        </Label>
        <Input
          id="email"
          type="email"
          value={formData.email}
          onChange={(e) => handleInputChange('email', e.target.value)}
          className={`mt-1 ${errors.email ? 'border-destructive' : ''}`}
          placeholder="Enter your email address"
        />
        {errors.email && (
          <p className="text-xs text-destructive mt-1">{errors.email}</p>
        )}
      </div>

      {/* Phone */}
      <div>
        <Label htmlFor="phone" className="flex items-center gap-2">
          <Phone className="h-4 w-4" />
          Phone Number {settings?.require_phone ? '*' : '(optional)'}
        </Label>
        <Input
          id="phone"
          type="tel"
          value={formData.phone || ''}
          onChange={(e) => handleInputChange('phone', e.target.value)}
          className={`mt-1 ${errors.phone ? 'border-destructive' : ''}`}
          placeholder="Enter your phone number"
        />
        {errors.phone && (
          <p className="text-xs text-destructive mt-1">{errors.phone}</p>
        )}
      </div>

      {/* Address */}
      <div>
        <Label htmlFor="address" className="flex items-center gap-2">
          <MapPin className="h-4 w-4" />
          Service Address {settings?.require_address ? '*' : '(optional)'}
        </Label>
        <Input
          id="address"
          type="text"
          value={formData.address || ''}
          onChange={(e) => handleInputChange('address', e.target.value)}
          className={`mt-1 ${errors.address ? 'border-destructive' : ''}`}
          placeholder="Enter the address where service will be performed"
        />
        {errors.address && (
          <p className="text-xs text-destructive mt-1">{errors.address}</p>
        )}
        <p className="text-xs text-muted-foreground mt-1">
          This helps us center the map for accurate measurements
        </p>
      </div>

      {/* Privacy Notice */}
      <Card className="p-3 bg-muted/50">
        <p className="text-xs text-muted-foreground">
          🔒 Your information is secure and will only be used to process your quote request. 
          We will not share your details with third parties.
        </p>
      </Card>

      {/* Submit Button */}
      <Button type="submit" className="w-full">
        Continue to Products
      </Button>
    </form>
  );
};