import { useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';

interface ServiceAreaValidationRequest {
  contractor_id: string;
  customer_address?: string;
  customer_lat?: number;
  customer_lng?: number;
  customer_zip?: string;
}

interface ServiceAreaValidationResponse {
  valid: boolean;
  distance?: number;
  zip_code?: string;
  message: string;
  method: 'radius' | 'zipcodes';
}

export function useServiceArea() {
  const [isValidating, setIsValidating] = useState(false);
  const { toast } = useToast();

  const validateServiceArea = async (
    request: ServiceAreaValidationRequest
  ): Promise<ServiceAreaValidationResponse | null> => {
    setIsValidating(true);
    
    try {
      const { data, error } = await supabase.functions.invoke('validate-service-area', {
        body: request
      });

      if (error) {
        console.error('Service area validation error:', error);
        toast({
          title: "Service Area Check Failed",
          description: "Unable to validate service area. Please try again.",
          variant: "destructive",
        });
        return null;
      }

      return data as ServiceAreaValidationResponse;
    } catch (error) {
      console.error('Service area validation error:', error);
      toast({
        title: "Service Area Check Failed",
        description: "Unable to validate service area. Please try again.",
        variant: "destructive",
      });
      return null;
    } finally {
      setIsValidating(false);
    }
  };

  const validateByAddress = async (
    contractorId: string,
    address: string
  ): Promise<ServiceAreaValidationResponse | null> => {
    return validateServiceArea({
      contractor_id: contractorId,
      customer_address: address,
    });
  };

  const validateByZipCode = async (
    contractorId: string,
    zipCode: string
  ): Promise<ServiceAreaValidationResponse | null> => {
    return validateServiceArea({
      contractor_id: contractorId,
      customer_zip: zipCode,
    });
  };

  const validateByCoordinates = async (
    contractorId: string,
    lat: number,
    lng: number
  ): Promise<ServiceAreaValidationResponse | null> => {
    return validateServiceArea({
      contractor_id: contractorId,
      customer_lat: lat,
      customer_lng: lng,
    });
  };

  return {
    validateServiceArea,
    validateByAddress,
    validateByZipCode,
    validateByCoordinates,
    isValidating,
  };
}