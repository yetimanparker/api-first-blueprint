import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { MapPin, Ruler, Package } from "lucide-react";

interface MeasurementData {
  type: 'area' | 'linear' | 'point';
  value: number;
  unit: string;
  coordinates?: number[][];
  manualEntry?: boolean;
  variations?: Array<{
    id: string;
    name: string;
    priceAdjustment: number;
    adjustmentType: 'fixed' | 'percentage';
  }>;
  addons?: Array<{
    id: string;
    name: string;
    priceValue: number;
    calculationType: 'total' | 'per_unit' | 'area_calculation';
    quantity: number;
  }>;
}

interface MeasurementDetailsProps {
  measurement: MeasurementData;
  productName: string;
  customName?: string;
  notes?: string;
}

export default function MeasurementDetails({ 
  measurement, 
  productName, 
  customName,
  notes 
}: MeasurementDetailsProps) {
  const formatPrice = (price: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
    }).format(price);
  };

  // Safety check for measurement data
  if (!measurement || measurement.value === undefined || measurement.value === null) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-lg">
            <Package className="h-5 w-5" />
            {customName || productName}
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">Measurement data unavailable</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-lg">
          <Package className="h-5 w-5" />
          {customName || productName}
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Measurement Info */}
        <div className="flex items-start gap-3">
          <Ruler className="h-5 w-5 text-muted-foreground mt-0.5" />
          <div className="flex-1">
            <p className="font-medium">Measurement</p>
            <p className="text-sm text-muted-foreground">
              {measurement.type === 'area' ? 'Area: ' : measurement.type === 'linear' ? 'Linear: ' : 'Quantity: '}
              <span className="font-semibold">{measurement.value.toLocaleString()} {measurement.unit || 'units'}</span>
            </p>
            {measurement.manualEntry && (
              <Badge variant="outline" className="mt-1">Manual Entry</Badge>
            )}
          </div>
        </div>

        {/* Coordinates Info */}
        {measurement.coordinates && measurement.coordinates.length > 0 && (
          <div className="flex items-start gap-3">
            <MapPin className="h-5 w-5 text-muted-foreground mt-0.5" />
            <div className="flex-1">
              <p className="font-medium">Location Data</p>
              <p className="text-sm text-muted-foreground">
                {measurement.coordinates.length} coordinate points mapped
              </p>
            </div>
          </div>
        )}

        {/* Variations */}
        {measurement.variations && measurement.variations.length > 0 && (
          <div>
            <p className="font-medium mb-2">Selected Variations</p>
            <div className="space-y-2">
              {measurement.variations.map((variation) => (
                <div key={variation.id} className="flex justify-between items-center text-sm bg-muted/50 rounded px-3 py-2">
                  <span>{variation.name}</span>
                  <span className="font-medium">
                    {variation.adjustmentType === 'percentage' 
                      ? `${variation.priceAdjustment > 0 ? '+' : ''}${variation.priceAdjustment}%`
                      : `${variation.priceAdjustment > 0 ? '+' : ''}${formatPrice(variation.priceAdjustment)}`
                    }
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Add-ons */}
        {measurement.addons && measurement.addons.length > 0 && (
          <div>
            <p className="font-medium mb-2">Add-ons</p>
            <div className="space-y-2">
              {measurement.addons.map((addon) => (
                <div key={addon.id} className="flex justify-between items-center text-sm bg-muted/50 rounded px-3 py-2">
                  <span>
                    {addon.name}
                    {addon.quantity > 1 && ` (×${addon.quantity})`}
                  </span>
                  <span className="font-medium">
                    +{formatPrice(addon.priceValue)}
                    {addon.calculationType === 'per_unit' && ` per ${measurement.unit}`}
                    {addon.calculationType === 'area_calculation' && ` per sq ft`}
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Notes */}
        {notes && (
          <div>
            <p className="font-medium mb-1">Notes</p>
            <p className="text-sm text-muted-foreground bg-muted/50 rounded px-3 py-2">{notes}</p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
