import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { AlertCircle, Package } from 'lucide-react';
import { calculateIncrementQuantity } from '@/lib/priceUtils';

interface IncrementConfirmationDialogProps {
  open: boolean;
  productName: string;
  measuredQuantity: number;
  measuredUnit: string;
  incrementSize: number;
  incrementLabel: string;
  incrementDescription?: string;
  allowPartial: boolean;
  onConfirm: (roundedQuantity: number, unitsNeeded: number) => void;
  onRemeasure: () => void;
}

export function IncrementConfirmationDialog({
  open,
  productName,
  measuredQuantity,
  measuredUnit,
  incrementSize,
  incrementLabel,
  incrementDescription,
  allowPartial,
  onConfirm,
  onRemeasure
}: IncrementConfirmationDialogProps) {
  const { unitsNeeded, totalCoverage, extra } = calculateIncrementQuantity(
    measuredQuantity,
    incrementSize,
    allowPartial
  );

  const extraPercentage = ((extra / measuredQuantity) * 100).toFixed(1);
  const isSignificantWaste = parseFloat(extraPercentage) > 30;

  return (
    <Dialog open={open} onOpenChange={(isOpen) => !isOpen && onRemeasure()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <div className="flex items-center gap-3">
            <div className="p-2 bg-primary/10 rounded-lg">
              <Package className="h-6 w-6 text-primary" />
            </div>
            <div className="flex-1">
              <DialogTitle className="text-left">Product Increment Notice</DialogTitle>
              <p className="text-sm text-muted-foreground mt-1">{productName}</p>
            </div>
          </div>
        </DialogHeader>

        <div className="space-y-4 py-4">
          {incrementDescription && (
            <div className="p-3 bg-muted/50 rounded-lg">
              <p className="text-sm text-foreground">{incrementDescription}</p>
            </div>
          )}

          <div className="space-y-3">
            <div className="flex justify-between items-center">
              <span className="text-sm text-muted-foreground">You measured:</span>
              <span className="font-semibold">{measuredQuantity.toLocaleString()} {measuredUnit}</span>
            </div>

            <div className="flex justify-between items-center">
              <span className="text-sm text-muted-foreground">Sold in increments of:</span>
              <span className="font-semibold">{incrementSize.toLocaleString()} {measuredUnit} per {incrementLabel}</span>
            </div>

            <div className="border-t pt-3">
              <div className="flex justify-between items-center mb-2">
                <span className="text-sm font-medium">You will need:</span>
                <span className="text-lg font-bold text-primary">
                  {unitsNeeded} {incrementLabel}{unitsNeeded !== 1 ? 's' : ''}
                </span>
              </div>
              
              <div className="flex justify-between items-center text-sm">
                <span className="text-muted-foreground">Total coverage:</span>
                <span className="font-medium">{totalCoverage.toLocaleString()} {measuredUnit}</span>
              </div>
              
              {extra > 0 && (
                <div className="flex items-start gap-2 mt-3 p-3 bg-muted/50 rounded-lg">
                  {isSignificantWaste && <AlertCircle className="h-4 w-4 text-amber-500 mt-0.5 flex-shrink-0" />}
                  <div className="flex-1">
                    <p className="text-sm font-medium">
                      Extra coverage: {extra.toLocaleString()} {measuredUnit} ({extraPercentage}%)
                    </p>
                    {isSignificantWaste && (
                      <p className="text-xs text-muted-foreground mt-1">
                        This is significantly more than measured. You may want to remeasure to confirm.
                      </p>
                    )}
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>

        <DialogFooter className="flex-col sm:flex-row gap-2">
          <Button
            variant="outline"
            onClick={onRemeasure}
            className="w-full sm:w-auto"
          >
            Re-measure
          </Button>
          <Button
            onClick={() => onConfirm(totalCoverage, unitsNeeded)}
            className="w-full sm:w-auto"
          >
            Continue with {unitsNeeded} {incrementLabel}{unitsNeeded !== 1 ? 's' : ''}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
