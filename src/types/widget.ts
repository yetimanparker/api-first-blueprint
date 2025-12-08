export interface CustomerInfo {
  firstName?: string;
  lastName?: string;
  email?: string;
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
  segments?: number[][][]; // Array of coordinate arrays for multiple independent segments
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
  segmentCount?: number; // Number of segments when using "Add Another Segment" workflow
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
  priceType?: 'fixed' | 'percentage'; // Whether price_value is a fixed amount or percentage of product total
  calculationType: 'total' | 'per_unit' | 'area_calculation';
  quantity: number;
  selectedOptionId?: string;
  selectedOptionName?: string;
  allowMapPlacement?: boolean; // Whether this addon can be placed on the map
  placedLocations?: Array<{lat: number, lng: number}>; // Coordinates where addon is placed
  inputMode?: 'toggle' | 'quantity'; // How addon is selected: toggle (on/off) or quantity (+/-)
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

// Pending addon configuration before placement
export interface PendingAddonConfig {
  addonId: string;
  addonName: string;
  priceValue: number;
  selectedOptionId?: string;
  selectedOptionName?: string;
  selectedVariations?: any[];
  linkedProductId?: string;
  calculationType: string;
}

export interface WidgetState {
  currentStep: WorkflowStep;
  customerInfo: CustomerInfo;
  quoteItems: QuoteItem[];
  currentProductId?: string;
  currentMeasurement?: MeasurementData;
  quoteSummary?: QuoteSummary;
  pendingProduct?: {
    productId: string;
    measurement: MeasurementData;
    variations?: ProductVariation[];
    addons?: ProductAddon[];
  };
  // Array of add-ons currently being configured/placed before adding to quote
  pendingAddons?: QuoteItem[];
  // Reference to the main product item for add-on configuration
  currentMainProductItem?: QuoteItem;
  // Single pending add-on currently being placed
  pendingAddon?: PendingAddonConfig;
  // Accumulated segments for "Add Another Segment" workflow
  accumulatedSegments?: MeasurementData[];
}