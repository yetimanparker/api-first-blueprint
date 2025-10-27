import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Plus, Minus, Package } from 'lucide-react';
import { GlobalSettings } from '@/hooks/useGlobalSettings';
import { MeasurementData } from '@/types/widget';

interface QuantityInputProps {
  productId: string;
  productName: string;
  productImage?: string;
  unitType: string;
  minQuantity: number;
  onQuantitySet: (quantity: number, measurement: MeasurementData) => void;
  settings: GlobalSettings;
}

const QuantityInput = ({ 
  productId, 
  productName, 
  productImage,
  unitType,
  minQuantity, 
  onQuantitySet,
  settings 
}: QuantityInputProps) => {
  const [quantity, setQuantity] = useState<number>(minQuantity || 1);

  const handleIncrement = () => {
    setQuantity(prev => prev + 1);
  };

  const handleDecrement = () => {
    setQuantity(prev => Math.max(minQuantity || 1, prev - 1));
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = parseInt(e.target.value);
    if (!isNaN(value) && value >= (minQuantity || 1)) {
      setQuantity(value);
    }
  };

  const handleContinue = () => {
    if (quantity >= (minQuantity || 1)) {
      // Create a point measurement for manual quantity products
      const measurement: MeasurementData = {
        type: 'point',
        value: quantity,
        unit: unitType,
        manualEntry: true
      };
      onQuantitySet(quantity, measurement);
    }
  };

  return (
    <div className="max-w-2xl mx-auto px-4 py-6">
      <Card className="border-2 border-primary/20">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Package className="h-5 w-5 text-primary" />
            How many would you like?
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Product Display */}
          <div className="flex items-center gap-4 p-4 bg-muted/50 rounded-lg">
            {productImage && (
              <div className="w-20 h-20 rounded-lg overflow-hidden bg-background border">
                <img
                  src={productImage}
                  alt={productName}
                  className="w-full h-full object-cover"
                  onError={(e) => {
                    e.currentTarget.style.display = 'none';
                  }}
                />
              </div>
            )}
            <div className="flex-1">
              <h3 className="font-semibold text-lg">{productName}</h3>
              <p className="text-sm text-muted-foreground">
                Select quantity to continue
              </p>
            </div>
          </div>

          {/* Quantity Input */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <Label htmlFor="quantity" className="text-base font-semibold">
                Quantity ({unitType})
              </Label>
              {minQuantity > 1 && (
                <span className="text-sm text-muted-foreground">
                  Min: {minQuantity} {unitType}
                </span>
              )}
            </div>
            <div className="flex items-center gap-4">
              <Button
                size="lg"
                variant="outline"
                onClick={handleDecrement}
                disabled={quantity <= (minQuantity || 1)}
                className="h-16 w-16"
              >
                <Minus className="h-6 w-6" />
              </Button>
              
              <Input
                id="quantity"
                type="number"
                value={quantity}
                onChange={handleInputChange}
                min={minQuantity || 1}
                className="text-center text-2xl font-bold h-16 text-primary"
              />
              
              <Button
                size="lg"
                variant="outline"
                onClick={handleIncrement}
                className="h-16 w-16"
              >
                <Plus className="h-6 w-6" />
              </Button>
            </div>
          </div>

          {/* Action Buttons */}
          <div className="flex flex-col gap-3 pt-4">
            <Button
              size="lg"
              onClick={handleContinue}
              className="w-full text-black"
              disabled={quantity < (minQuantity || 1)}
            >
              Continue to Configure
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default QuantityInput;
