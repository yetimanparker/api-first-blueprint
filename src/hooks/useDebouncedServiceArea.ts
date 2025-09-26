import { useState, useEffect, useCallback, useRef } from 'react';
import { useServiceArea } from './useServiceArea';
import { CustomerInfo } from '@/types/widget';

interface UseDebouncedServiceAreaProps {
  customerInfo: Partial<CustomerInfo>;
  contractorId: string;
  delay?: number;
}

export function useDebouncedServiceArea({ 
  customerInfo, 
  contractorId, 
  delay = 1500 
}: UseDebouncedServiceAreaProps) {
  const [isServiceAreaValid, setIsServiceAreaValid] = useState<boolean | undefined>(undefined);
  const { validateServiceArea, isValidating } = useServiceArea();
  const timeoutRef = useRef<NodeJS.Timeout>();
  const lastValidatedRef = useRef<string>('');

  const debouncedValidate = useCallback(async () => {
    // Only validate if we have sufficient address information
    const hasAddress = customerInfo.address && customerInfo.address.length > 5;
    const hasCoordinates = customerInfo.lat && customerInfo.lng;
    const hasZipCode = customerInfo.zipCode;

    if (!hasAddress || (!hasCoordinates && !hasZipCode)) {
      return;
    }

    // Create a key to track what we're validating to prevent duplicate calls
    const validationKey = `${customerInfo.address}-${customerInfo.lat}-${customerInfo.lng}-${customerInfo.zipCode}`;
    
    if (lastValidatedRef.current === validationKey) {
      return;
    }

    console.log('Debounced service area validation starting:', {
      address: customerInfo.address,
      lat: customerInfo.lat,
      lng: customerInfo.lng,
      zipCode: customerInfo.zipCode
    });

    try {
      const result = await validateServiceArea({
        contractor_id: contractorId,
        customer_address: customerInfo.address,
        customer_lat: customerInfo.lat,
        customer_lng: customerInfo.lng,
        customer_zip: customerInfo.zipCode,
      });

      console.log('Debounced service area validation result:', result);

      if (result) {
        setIsServiceAreaValid(result.valid);
        lastValidatedRef.current = validationKey;
      }
    } catch (error) {
      console.error('Debounced service area validation error:', error);
    }
  }, [customerInfo, contractorId, validateServiceArea]);

  // Debounce the validation
  useEffect(() => {
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
    }

    // Only start validation timer if we have essential info
    if (customerInfo.address && customerInfo.address.length > 5) {
      timeoutRef.current = setTimeout(debouncedValidate, delay);
    }

    return () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
    };
  }, [debouncedValidate, delay]);

  // Reset validation state when address changes significantly
  useEffect(() => {
    const currentKey = `${customerInfo.address}-${customerInfo.lat}-${customerInfo.lng}-${customerInfo.zipCode}`;
    if (lastValidatedRef.current && lastValidatedRef.current !== currentKey) {
      setIsServiceAreaValid(undefined);
    }
  }, [customerInfo.address, customerInfo.lat, customerInfo.lng, customerInfo.zipCode]);

  return {
    isServiceAreaValid,
    isValidating,
    manualValidate: debouncedValidate
  };
}