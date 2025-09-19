import React, { useState, useRef, useEffect, useCallback } from 'react';
import { Input } from '@/components/ui/input';
import { cn } from '@/lib/utils';
import { useGooglePlaces, type PlacePrediction, type ParsedAddress } from '@/hooks/useGooglePlaces';
import { MapPin, Loader2 } from 'lucide-react';

export interface AddressAutocompleteProps extends React.InputHTMLAttributes<HTMLInputElement> {
  onAddressSelect?: (address: ParsedAddress) => void;
  onInputChange?: (value: string) => void;
  placeholder?: string;
  debounceMs?: number;
  countryRestriction?: string[];
  disabled?: boolean;
}

export const AddressAutocomplete = React.forwardRef<HTMLInputElement, AddressAutocompleteProps>(
  ({ 
    onAddressSelect, 
    onInputChange, 
    placeholder = "Enter address...", 
    debounceMs = 300,
    countryRestriction,
    disabled,
    className,
    value,
    onChange,
    ...props 
  }, ref) => {
    const [inputValue, setInputValue] = useState(value?.toString() || '');
    const [showPredictions, setShowPredictions] = useState(false);
    const [highlightedIndex, setHighlightedIndex] = useState(-1);
    
    const inputRef = useRef<HTMLInputElement>(null);
    const dropdownRef = useRef<HTMLDivElement>(null);
    const debounceRef = useRef<NodeJS.Timeout>();
    
    const {
      predictions,
      loading,
      error,
      getAutocomplete,
      getPlaceDetails,
      clearPredictions,
      clearError,
    } = useGooglePlaces();

    // Handle input changes with debouncing
    const handleInputChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
      const newValue = e.target.value;
      setInputValue(newValue);
      setHighlightedIndex(-1);
      
      // Call the original onChange if provided
      onChange?.(e);
      onInputChange?.(newValue);

      // Clear existing debounce
      if (debounceRef.current) {
        clearTimeout(debounceRef.current);
      }

      // Debounce the autocomplete request
      debounceRef.current = setTimeout(() => {
        if (newValue.trim().length >= 2) {
          setShowPredictions(true);
          getAutocomplete(newValue, {
            types: ['address'],
            componentRestrictions: countryRestriction ? { country: countryRestriction } : undefined,
          });
        } else {
          setShowPredictions(false);
          clearPredictions();
        }
      }, debounceMs);
    }, [onChange, onInputChange, getAutocomplete, clearPredictions, debounceMs, countryRestriction]);

    // Handle prediction selection
    const handlePredictionSelect = useCallback(async (prediction: PlacePrediction) => {
      setInputValue(prediction.description);
      setShowPredictions(false);
      clearPredictions();
      setHighlightedIndex(-1);

      // Get detailed address information
      const addressDetails = await getPlaceDetails(prediction.place_id);
      if (addressDetails && onAddressSelect) {
        onAddressSelect(addressDetails);
      }

      // Simulate onChange event for form integration
      if (onChange && inputRef.current) {
        const syntheticEvent = {
          target: { value: prediction.description },
          currentTarget: inputRef.current,
        } as React.ChangeEvent<HTMLInputElement>;
        onChange(syntheticEvent);
      }
    }, [getPlaceDetails, onAddressSelect, onChange, clearPredictions]);

    // Handle keyboard navigation
    const handleKeyDown = useCallback((e: React.KeyboardEvent<HTMLInputElement>) => {
      if (!showPredictions || predictions.length === 0) return;

      switch (e.key) {
        case 'ArrowDown':
          e.preventDefault();
          setHighlightedIndex(prev => 
            prev < predictions.length - 1 ? prev + 1 : 0
          );
          break;
        case 'ArrowUp':
          e.preventDefault();
          setHighlightedIndex(prev => 
            prev > 0 ? prev - 1 : predictions.length - 1
          );
          break;
        case 'Enter':
          e.preventDefault();
          if (highlightedIndex >= 0 && highlightedIndex < predictions.length) {
            handlePredictionSelect(predictions[highlightedIndex]);
          }
          break;
        case 'Escape':
          setShowPredictions(false);
          setHighlightedIndex(-1);
          inputRef.current?.blur();
          break;
      }
    }, [showPredictions, predictions, highlightedIndex, handlePredictionSelect]);

    // Handle clicks outside to close dropdown
    useEffect(() => {
      const handleClickOutside = (event: MouseEvent) => {
        if (
          dropdownRef.current && 
          !dropdownRef.current.contains(event.target as Node) &&
          !inputRef.current?.contains(event.target as Node)
        ) {
          setShowPredictions(false);
          setHighlightedIndex(-1);
        }
      };

      document.addEventListener('mousedown', handleClickOutside);
      return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    // Sync external value changes
    useEffect(() => {
      if (value !== undefined && value !== inputValue) {
        setInputValue(value.toString());
      }
    }, [value, inputValue]);

    // Clear error when input changes
    useEffect(() => {
      if (error) {
        clearError();
      }
    }, [inputValue, error, clearError]);

    // Cleanup debounce on unmount
    useEffect(() => {
      return () => {
        if (debounceRef.current) {
          clearTimeout(debounceRef.current);
        }
      };
    }, []);

    return (
      <div className="relative">
        <div className="relative">
          <Input
            {...props}
            ref={(node) => {
              if (typeof ref === 'function') {
                ref(node);
              } else if (ref) {
                ref.current = node;
              }
              (inputRef as React.MutableRefObject<HTMLInputElement | null>).current = node;
            }}
            value={inputValue}
            onChange={handleInputChange}
            onKeyDown={handleKeyDown}
            placeholder={placeholder}
            disabled={disabled}
            className={cn('pr-10', className)}
            autoComplete="off"
            role="combobox"
            aria-expanded={showPredictions}
            aria-haspopup="listbox"
            aria-autocomplete="list"
          />
          <div className="absolute inset-y-0 right-0 flex items-center pr-3 pointer-events-none">
            {loading ? (
              <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
            ) : (
              <MapPin className="h-4 w-4 text-muted-foreground" />
            )}
          </div>
        </div>

        {/* Predictions dropdown */}
        {showPredictions && (predictions.length > 0 || error) && (
          <div
            ref={dropdownRef}
            className="absolute z-50 w-full mt-1 bg-popover border border-border rounded-md shadow-lg max-h-60 overflow-y-auto"
            role="listbox"
          >
            {error ? (
              <div className="p-3 text-sm text-destructive">
                {error}
              </div>
            ) : (
              predictions.map((prediction, index) => (
                <button
                  key={prediction.place_id}
                  type="button"
                  className={cn(
                    'w-full text-left p-3 hover:bg-accent hover:text-accent-foreground focus:bg-accent focus:text-accent-foreground focus:outline-none',
                    index === highlightedIndex && 'bg-accent text-accent-foreground'
                  )}
                  onClick={() => handlePredictionSelect(prediction)}
                  role="option"
                  aria-selected={index === highlightedIndex}
                >
                  <div className="flex items-start space-x-3">
                    <MapPin className="h-4 w-4 mt-0.5 text-muted-foreground flex-shrink-0" />
                    <div className="flex-1 min-w-0">
                      <div className="text-sm font-medium truncate">
                        {prediction.structured_formatting.main_text}
                      </div>
                      <div className="text-xs text-muted-foreground truncate">
                        {prediction.structured_formatting.secondary_text}
                      </div>
                    </div>
                  </div>
                </button>
              ))
            )}
          </div>
        )}
      </div>
    );
  }
);

AddressAutocomplete.displayName = 'AddressAutocomplete';