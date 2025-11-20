import { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Plus, Minus } from 'lucide-react';
import { MeasurementData } from '@/types/widget';

interface QuantityInputDialogProps {
  open: boolean;
  productId: string;
  productName: string;
  productImage?: string;
  unitType: string;
  minQuantity: number;
  onQuantitySet: (quantity: number, measurement: MeasurementData) => void;
  onCancel: () => void;
}

const QuantityInputDialog = ({ 
  open,
  productId, 
  productName, 
  productImage,
  unitType,
  minQuantity, 
  onQuantitySet,
  onCancel
}: QuantityInputDialogProps) => {
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
    <Dialog open={open} onOpenChange={(isOpen) => !isOpen && onCancel()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>How many would you like?</DialogTitle>
          <DialogDescription>
            Enter quantity for {productName}
          </DialogDescription>
        </DialogHeader>
        
        <div className="space-y-6 py-4">
          {/* Product Display */}
          {productImage && (
            <div className="flex items-center gap-4 p-4 bg-muted/50 rounded-lg">
              <div className="w-16 h-16 rounded-lg overflow-hidden bg-background border">
                <img
                  src={productImage}
                  alt={productName}
                  className="w-full h-full object-cover"
                  onError={(e) => {
                    e.currentTarget.style.display = 'none';
                  }}
                />
              </div>
              <div className="flex-1">
                <h3 className="font-semibold">{productName}</h3>
              </div>
            </div>
          )}

          {/* Quantity Input */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <Label htmlFor="quantity" className="text-base font-semibold">
                Quantity ({unitType})
              </Label>
              {minQuantity > 1 && (
                <span className="text-sm text-muted-foreground">
                  Min: {minQuantity}
                </span>
              )}
            </div>
            <div className="flex items-center gap-3">
              <Button
                size="default"
                variant="outline"
                onClick={handleDecrement}
                disabled={quantity <= (minQuantity || 1)}
                className="h-12 w-12"
              >
                <Minus className="h-5 w-5" />
              </Button>
              
              <Input
                id="quantity"
                type="number"
                value={quantity}
                onChange={handleInputChange}
                min={minQuantity || 1}
                className="text-center text-xl font-bold h-12"
              />
              
              <Button
                size="default"
                variant="outline"
                onClick={handleIncrement}
                className="h-12 w-12"
              >
                <Plus className="h-5 w-5" />
              </Button>
            </div>
          </div>

          {/* Action Buttons */}
          <div className="flex gap-2 pt-2">
            <Button
              variant="outline"
              onClick={onCancel}
              className="flex-1"
            >
              Cancel
            </Button>
            <Button
              onClick={handleContinue}
              className="flex-1"
              disabled={quantity < (minQuantity || 1)}
            >
              Continue
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default QuantityInputDialog;
