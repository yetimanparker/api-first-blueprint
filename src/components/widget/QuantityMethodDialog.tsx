import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Calculator, Map } from 'lucide-react';

interface QuantityMethodDialogProps {
  open: boolean;
  productName: string;
  onMethodSelect: (method: 'manual' | 'map') => void;
  onCancel: () => void;
}

const QuantityMethodDialog = ({ open, productName, onMethodSelect, onCancel }: QuantityMethodDialogProps) => {
  return (
    <Dialog open={open} onOpenChange={(isOpen) => {
      if (!isOpen) onCancel();
    }}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>How would you like to add quantities?</DialogTitle>
          <DialogDescription>
            Choose how to specify quantities for {productName}
          </DialogDescription>
        </DialogHeader>
        
        <div className="flex flex-col gap-3 pt-4">
          <Button
            size="lg"
            variant="default"
            onClick={() => onMethodSelect('map')}
            className="w-full"
          >
            <Map className="mr-2" />
            Use Map to Add Quantities
          </Button>
          
          <Button
            size="lg"
            variant="outline"
            onClick={() => onMethodSelect('manual')}
            className="w-full"
          >
            <Calculator className="mr-2" />
            Enter Quantity Manually
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default QuantityMethodDialog;
