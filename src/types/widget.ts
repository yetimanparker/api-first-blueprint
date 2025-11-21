export interface CustomerInfo {
  firstName: string;
  lastName: string;
  email: string;
  phone?: string;
  address?: string;
  city?: string;
  state?: string;
  zipCode?: string;
  lat?: number;
  lng?: number;
}

export interface MeasurementData {
  type: 'area' | 'linear' | 'point';
  value: number;
  unit: string;
  coordinates?: number[][];
  pointLocations?: Array<{lat: number, lng: number}>; // For 'point' type measurements
  manualEntry?: boolean;
  customName?: string;
  variations?: ProductVariation[];
  addons?: ProductAddon[];
  depth?: number; // Depth in inches for volume-based products (sq_yd)
  mapColor?: string; // Color assigned to this measurement on the map
  isDimensional?: boolean; // Whether this is a predefined dimensional product
  dimensions?: {
    width: number;
    length: number;
    unit: string;
  };
  rotation?: number; // Rotation angle in degrees (0-360)
  centerPoint?: {lat: number, lng: number}; // Center coordinates for dimensional products
  originalMeasurement?: number; // Store the actual measured value before increment rounding
  wasRoundedForIncrements?: boolean; // Flag to indicate rounding occurred
  incrementsApplied?: {
    incrementSize: number;
    incrementLabel: string;
    unitsNeeded: number;
  };
}

export interface QuoteItem {
  id: string;
  productId: string;
  productName: string;
  unitType: string;
  measurement: MeasurementData;
  unitPrice: number;
  quantity: number;
  lineTotal: number;
  customName?: string;
  notes?: string;
  variations?: ProductVariation[];
  addons?: ProductAddon[];
  parentQuoteItemId?: string; // For add-on items that are children of a main product
  addonId?: string; // Reference to the addon configuration
  isAddonItem?: boolean; // Flag to identify if this is a placed add-on
}

export interface ProductVariation {
  id: string;
  name: string;
  priceAdjustment: number;
  adjustmentType: 'fixed' | 'percentage';
  height_value?: number | null;
  unit_of_measurement?: string;
  affects_area_calculation?: boolean;
  is_required?: boolean;
  is_default?: boolean;
}

export interface ProductAddon {
  id: string;
  name: string;
  priceValue: number;
  calculationType: 'total' | 'per_unit' | 'area_calculation';
  quantity: number;
  selectedOptionId?: string;
  selectedOptionName?: string;
  allowMapPlacement?: boolean; // Whether this addon can be placed on the map
  placedLocations?: Array<{lat: number, lng: number}>; // Coordinates where addon is placed
}

export interface QuoteSummary {
  items: QuoteItem[];
  subtotal: number;
  markupAmount: number;
  taxAmount: number;
  total: number;
  projectComments?: string;
}

export type WorkflowStep = 
  | 'contact-before' 
  | 'product-selection' 
  | 'quantity-input'
  | 'measurement' 
  | 'product-configuration' 
  | 'addon-placement' // New step for placing add-ons on map
  | 'addon-quantity-input' // New step for manual quantity entry of add-ons
  | 'add-another-check'
  | 'project-comments' 
  | 'quote-review' 
  | 'contact-after'
  | 'confirmation'
  | 'internal-quote-review'; // Internal contractor quote review (no customer contact capture)

export interface WidgetState {
  contractorId: string;
  currentStep: WorkflowStep;
  customerInfo: Partial<CustomerInfo>;
  currentProductId?: string;
  currentMeasurement?: MeasurementData;
  quoteItems: QuoteItem[];
  quoteSummary?: QuoteSummary;
  isServiceAreaValid?: boolean;
  pendingAddon?: {
    addonId: string;
    addonName: string;
    priceValue: number;
    calculationType: string;
    selectedOptionId?: string;
    selectedOptionName?: string;
    selectedVariations?: ProductVariation[];
    linkedProductId?: string;
  };
  currentMainProductItem?: QuoteItem; // Track the main product for addon placement context
  pendingAddons?: QuoteItem[]; // Track add-ons that have been configured but not yet added to quote
}