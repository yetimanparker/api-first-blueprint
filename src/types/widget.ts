export interface CustomerInfo {
  firstName: string;
  lastName: string;
  email: string;
  phone?: string;
  address?: string;
  city?: string;
  state?: string;
  zipCode?: string;
}

export interface MeasurementData {
  type: 'area' | 'linear';
  value: number;
  unit: string;
  coordinates?: number[][];
  manualEntry?: boolean;
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
}

export interface ProductAddon {
  id: string;
  name: string;
  priceValue: number;
  calculationType: 'total' | 'per_unit';
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