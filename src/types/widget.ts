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
}

export interface QuoteItem {
  id: string;
  productId: string;
  productName: string;
  measurement: MeasurementData;
  unitPrice: number;
  quantity: number;
  lineTotal: number;
  customName?: string;
  notes?: string;
  variations?: ProductVariation[];
  addons?: ProductAddon[];
}

export interface ProductVariation {
  id: string;
  name: string;
  priceAdjustment: number;
  adjustmentType: 'fixed' | 'percentage';
  height_value?: number | null;
  unit_of_measurement?: string;
  affects_area_calculation?: boolean;
}

export interface ProductAddon {
  id: string;
  name: string;
  priceValue: number;
  calculationType: 'total' | 'per_unit' | 'area_calculation';
  quantity: number;
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
  | 'add-another-check'
  | 'project-comments' 
  | 'quote-review' 
  | 'contact-after'
  | 'confirmation';

export interface WidgetState {
  contractorId: string;
  currentStep: WorkflowStep;
  customerInfo: Partial<CustomerInfo>;
  currentProductId?: string;
  currentMeasurement?: MeasurementData;
  quoteItems: QuoteItem[];
  quoteSummary?: QuoteSummary;
  isServiceAreaValid?: boolean;
}