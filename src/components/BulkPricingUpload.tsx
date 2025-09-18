import React, { useState, useRef } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Progress } from '@/components/ui/progress';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { Checkbox } from '@/components/ui/checkbox';
import { Download, Upload, FileText, AlertTriangle, CheckCircle, X, Undo2 } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';

interface PricingPreviewItem {
  productId: string;
  productName: string;
  currentPrice: number;
  newPrice: number;
  priceChange: number;
  percentChange: number;
  selected: boolean;
}

interface ValidationError {
  row: number;
  field: string;
  message: string;
}

export function BulkPricingUpload() {
  const [uploadPhase, setUploadPhase] = useState<'upload' | 'preview' | 'processing' | 'complete'>('upload');
  const [previewItems, setPreviewItems] = useState<PricingPreviewItem[]>([]);
  const [validationErrors, setValidationErrors] = useState<ValidationError[]>([]);
  const [progress, setProgress] = useState(0);
  const [lastBatchId, setLastBatchId] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { toast } = useToast();

  const downloadTemplate = async () => {
    try {
      const { data, error } = await supabase.functions.invoke('generate-pricing-template');
      
      if (error) throw error;

      const blob = new Blob([data.csv], { type: 'text/csv' });
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `pricing-template-${new Date().toISOString().split('T')[0]}.csv`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);

      toast({
        title: "Template Downloaded",
        description: "Your pricing template has been downloaded successfully."
      });
    } catch (error: any) {
      toast({
        title: "Download Failed",
        description: error.message || "Failed to download template",
        variant: "destructive"
      });
    }
  };

  const handleFileUpload = async (file: File) => {
    if (!file) return;

    const formData = new FormData();
    formData.append('file', file);

    try {
      setUploadPhase('processing');
      setProgress(25);

      const { data, error } = await supabase.functions.invoke('process-pricing-file', {
        body: formData
      });

      setProgress(50);

      if (error) throw error;

      if (data.errors?.length > 0) {
        setValidationErrors(data.errors);
        setProgress(0);
        setUploadPhase('upload');
        return;
      }

      setPreviewItems(data.preview.map((item: any) => ({ ...item, selected: true })));
      setProgress(75);
      setUploadPhase('preview');
      
      toast({
        title: "File Processed",
        description: `Found ${data.preview.length} products ready for update.`
      });
    } catch (error: any) {
      toast({
        title: "Processing Failed", 
        description: error.message || "Failed to process file",
        variant: "destructive"
      });
      setProgress(0);
      setUploadPhase('upload');
    }
  };

  const applyPricingUpdates = async () => {
    const selectedItems = previewItems.filter(item => item.selected);
    
    if (selectedItems.length === 0) {
      toast({
        title: "No Items Selected",
        description: "Please select at least one item to update.",
        variant: "destructive"
      });
      return;
    }

    try {
      setUploadPhase('processing');
      setProgress(0);

      const batchId = crypto.randomUUID();
      const updates = selectedItems.map(item => ({
        productId: item.productId,
        oldPrice: item.currentPrice,
        newPrice: item.newPrice
      }));

      let completed = 0;
      const total = updates.length;

      // Process in batches of 10
      for (let i = 0; i < updates.length; i += 10) {
        const batch = updates.slice(i, i + 10);
        
        const { error } = await supabase.functions.invoke('apply-bulk-pricing', {
          body: { updates: batch, batchId }
        });

        if (error) throw error;
        
        completed += batch.length;
        setProgress(Math.round((completed / total) * 100));
      }

      setLastBatchId(batchId);
      setUploadPhase('complete');
      
      toast({
        title: "Pricing Updated",
        description: `Successfully updated ${selectedItems.length} products.`
      });
    } catch (error: any) {
      toast({
        title: "Update Failed",
        description: error.message || "Failed to apply pricing updates",
        variant: "destructive"
      });
      setProgress(0);
      setUploadPhase('preview');
    }
  };

  const undoLastUpdate = async () => {
    if (!lastBatchId) return;

    try {
      const { error } = await supabase.functions.invoke('undo-pricing-batch', {
        body: { batchId: lastBatchId }
      });

      if (error) throw error;

      setLastBatchId(null);
      toast({
        title: "Changes Reverted",
        description: "All pricing changes have been successfully reverted."
      });
      
      resetUpload();
    } catch (error: any) {
      toast({
        title: "Undo Failed",
        description: error.message || "Failed to revert changes",
        variant: "destructive"
      });
    }
  };

  const resetUpload = () => {
    setUploadPhase('upload');
    setPreviewItems([]);
    setValidationErrors([]);
    setProgress(0);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const toggleItemSelection = (productId: string) => {
    setPreviewItems(items =>
      items.map(item =>
        item.productId === productId ? { ...item, selected: !item.selected } : item
      )
    );
  };

  const toggleAllItems = () => {
    const allSelected = previewItems.every(item => item.selected);
    setPreviewItems(items =>
      items.map(item => ({ ...item, selected: !allSelected }))
    );
  };

  if (uploadPhase === 'upload') {
    return (
      <div className="space-y-6">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Upload className="h-5 w-5" />
              Bulk Pricing Update
            </CardTitle>
            <CardDescription>
              Upload a CSV or Excel file to update pricing for multiple products at once.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="flex items-center gap-4">
              <Button onClick={downloadTemplate} variant="outline" className="flex items-center gap-2">
                <Download className="h-4 w-4" />
                Download Template
              </Button>
              <span className="text-sm text-muted-foreground">
                Download a template with your current products
              </span>
            </div>

            <Separator />

            <div className="space-y-4">
              <div>
                <Input
                  ref={fileInputRef}
                  type="file"
                  accept=".csv,.xlsx,.xls"
                  onChange={(e) => {
                    const file = e.target.files?.[0];
                    if (file) handleFileUpload(file);
                  }}
                  className="cursor-pointer"
                />
                <p className="text-sm text-muted-foreground mt-2">
                  Supported formats: CSV, Excel (.xlsx, .xls)
                </p>
              </div>

              {validationErrors.length > 0 && (
                <Alert variant="destructive">
                  <AlertTriangle className="h-4 w-4" />
                  <AlertDescription>
                    <div className="font-medium mb-2">File validation errors:</div>
                    <ul className="space-y-1">
                      {validationErrors.slice(0, 5).map((error, index) => (
                        <li key={index} className="text-sm">
                          Row {error.row}, {error.field}: {error.message}
                        </li>
                      ))}
                      {validationErrors.length > 5 && (
                        <li className="text-sm font-medium">
                          ...and {validationErrors.length - 5} more errors
                        </li>
                      )}
                    </ul>
                  </AlertDescription>
                </Alert>
              )}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <FileText className="h-5 w-5" />
              File Format Requirements
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3 text-sm">
              <p><strong>Required Columns:</strong></p>
              <ul className="list-disc list-inside space-y-1 ml-4">
                <li><code>Product ID</code> or <code>Product Name</code> - To identify the product</li>
                <li><code>New Price</code> - The updated unit price</li>
              </ul>
              <p><strong>Optional Columns:</strong></p>
              <ul className="list-disc list-inside space-y-1 ml-4">
                <li><code>Current Price</code> - For verification (will be auto-populated if missing)</li>
              </ul>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (uploadPhase === 'preview') {
    const selectedCount = previewItems.filter(item => item.selected).length;
    const totalIncrease = previewItems
      .filter(item => item.selected)
      .reduce((sum, item) => sum + item.priceChange, 0);
    const avgPercentChange = selectedCount > 0 
      ? previewItems
          .filter(item => item.selected)
          .reduce((sum, item) => sum + item.percentChange, 0) / selectedCount
      : 0;

    return (
      <div className="space-y-6">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center justify-between">
              <span className="flex items-center gap-2">
                <CheckCircle className="h-5 w-5 text-green-500" />
                Preview Pricing Changes
              </span>
              <div className="flex items-center gap-2">
                <Button onClick={resetUpload} variant="outline" size="sm">
                  <X className="h-4 w-4 mr-1" />
                  Cancel
                </Button>
                <Button 
                  onClick={applyPricingUpdates} 
                  disabled={selectedCount === 0}
                  className="bg-primary hover:bg-primary/90"
                >
                  Apply Changes ({selectedCount})
                </Button>
              </div>
            </CardTitle>
            <CardDescription>
              Review and confirm the pricing changes before applying them to your products.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-3 gap-6 mb-6">
              <div className="text-center">
                <div className="text-2xl font-bold text-primary">{selectedCount}</div>
                <div className="text-sm text-muted-foreground">Products Selected</div>
              </div>
              <div className="text-center">
                <div className="text-2xl font-bold text-green-600">${totalIncrease.toFixed(2)}</div>
                <div className="text-sm text-muted-foreground">Total Price Increase</div>
              </div>
              <div className="text-center">
                <div className="text-2xl font-bold text-blue-600">
                  {avgPercentChange > 0 ? '+' : ''}{avgPercentChange.toFixed(1)}%
                </div>
                <div className="text-sm text-muted-foreground">Avg % Change</div>
              </div>
            </div>
            
            <div className="space-y-4">
              <div className="flex items-center gap-2">
                <Checkbox 
                  checked={previewItems.every(item => item.selected)}
                  onCheckedChange={toggleAllItems}
                />
                <span className="text-sm font-medium">Select All</span>
              </div>

              <div className="max-h-96 overflow-y-auto space-y-2">
                {previewItems.map((item) => (
                  <div key={item.productId} className="flex items-center justify-between p-3 border rounded-lg">
                    <div className="flex items-center gap-3">
                      <Checkbox
                        checked={item.selected}
                        onCheckedChange={() => toggleItemSelection(item.productId)}
                      />
                      <div>
                        <div className="font-medium">{item.productName}</div>
                        <div className="text-sm text-muted-foreground">ID: {item.productId}</div>
                      </div>
                    </div>
                    <div className="flex items-center gap-4">
                      <div className="text-right">
                        <div className="text-sm text-muted-foreground">
                          ${item.currentPrice.toFixed(2)} → <span className="font-medium">${item.newPrice.toFixed(2)}</span>
                        </div>
                        <div className="flex items-center gap-2">
                          <Badge variant={item.priceChange >= 0 ? "default" : "destructive"}>
                            {item.priceChange >= 0 ? '+' : ''}${item.priceChange.toFixed(2)}
                          </Badge>
                          <Badge variant={item.percentChange >= 0 ? "secondary" : "destructive"}>
                            {item.percentChange >= 0 ? '+' : ''}{item.percentChange.toFixed(1)}%
                          </Badge>
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (uploadPhase === 'processing') {
    return (
      <Card>
        <CardContent className="text-center py-12">
          <div className="space-y-4">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto"></div>
            <div>
              <div className="text-lg font-medium">Processing Pricing Updates</div>
              <div className="text-muted-foreground">Updating products in your catalog...</div>
            </div>
            <div className="max-w-xs mx-auto">
              <Progress value={progress} />
              <div className="text-sm text-muted-foreground mt-1">{progress}% complete</div>
            </div>
          </div>
        </CardContent>
      </Card>
    );
  }

  if (uploadPhase === 'complete') {
    return (
      <div className="space-y-6">
        <Card>
          <CardContent className="text-center py-12">
            <div className="space-y-4">
              <CheckCircle className="h-16 w-16 text-green-500 mx-auto" />
              <div>
                <div className="text-xl font-bold text-green-700">Pricing Update Complete!</div>
                <div className="text-muted-foreground">
                  All selected products have been updated successfully.
                </div>
              </div>
              <div className="flex items-center justify-center gap-4">
                <Button onClick={resetUpload} variant="outline">
                  Upload Another File
                </Button>
                {lastBatchId && (
                  <Button onClick={undoLastUpdate} variant="outline" className="flex items-center gap-2">
                    <Undo2 className="h-4 w-4" />
                    Undo Changes
                  </Button>
                )}
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  return null;
}