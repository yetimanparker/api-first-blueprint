import React, { useState } from "react";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { supabase } from "@/integrations/supabase/client";
import { FileText, Upload, AlertCircle, CheckCircle, Download, Undo, Settings, Plus } from "lucide-react";

// Enhanced types for comprehensive product management
interface ProductManagementItem {
  productId?: string;
  name: string;
  description?: string;
  unitPrice: number;
  oldPrice?: number;
  unitType: string;
  category?: string;
  subcategory?: string;
  colorHex: string;
  photoUrl?: string;
  isActive: boolean;
  showPricingBeforeSubmit: boolean;
  displayOrder: number;
  selected: boolean;
  isNew?: boolean;
  variations?: any[];
  addons?: any[];
}

interface ValidationError {
  row: number;
  field: string;
  message: string;
}

type ManagementPhase = "upload" | "preview" | "processing" | "complete";
type ManagementMode = "pricing_only" | "full_management";

export function BulkProductManagement() {
  const [uploadPhase, setUploadPhase] = useState<ManagementPhase>("upload");
  const [managementMode, setManagementMode] = useState<ManagementMode>("pricing_only");
  const [previewItems, setPreviewItems] = useState<ProductManagementItem[]>([]);
  const [validationErrors, setValidationErrors] = useState<ValidationError[]>([]);
  const [progress, setProgress] = useState(0);
  const [batchId, setBatchId] = useState<string>("");
  const { toast } = useToast();

  const downloadTemplate = async (mode: ManagementMode) => {
    try {
      const { data, error } = await supabase.functions.invoke('generate-product-template', {
        body: { mode }
      });

      if (error) throw error;

      const blob = new Blob([data.csvContent], { type: 'text/csv' });
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.style.display = 'none';
      a.href = url;
      a.download = mode === 'pricing_only' ? 'bulk-pricing-template.csv' : 'bulk-product-template.csv';
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);

      toast({
        title: "Template Downloaded",
        description: `${mode === 'pricing_only' ? 'Pricing' : 'Product management'} template ready for editing.`,
      });
    } catch (error: any) {
      toast({
        title: "Download Failed",
        description: error.message,
        variant: "destructive",
      });
    }
  };

  const handleFileUpload = async (file: File) => {
    if (!file) return;

    const formData = new FormData();
    formData.append('file', file);
    formData.append('mode', managementMode);

    setUploadPhase("processing");
    setProgress(25);

    try {
      const { data, error } = await supabase.functions.invoke('process-product-file', {
        body: formData
      });

      setProgress(75);

      if (error) throw error;

      if (data.errors && data.errors.length > 0) {
        setValidationErrors(data.errors);
        setUploadPhase("upload");
        setProgress(0);
        toast({
          title: "Validation Errors Found",
          description: `Found ${data.errors.length} errors in your file. Please fix them and try again.`,
          variant: "destructive",
        });
        return;
      }

      setPreviewItems(data.preview.map((item: any) => ({
        ...item,
        selected: true
      })));
      setUploadPhase("preview");
      setProgress(100);

      toast({
        title: "File Processed Successfully",
        description: `Found ${data.summary.validRows} valid ${managementMode === 'pricing_only' ? 'pricing updates' : 'product changes'}.`,
      });
    } catch (error: any) {
      setUploadPhase("upload");
      setProgress(0);
      toast({
        title: "Upload Failed",
        description: error.message,
        variant: "destructive",
      });
    }
  };

  const applyChanges = async () => {
    const selectedItems = previewItems.filter(item => item.selected);
    if (selectedItems.length === 0) {
      toast({
        title: "No Items Selected",
        description: "Please select at least one item to update.",
        variant: "destructive",
      });
      return;
    }

    setUploadPhase("processing");
    setProgress(0);

    try {
      const batchId = crypto.randomUUID();
      setBatchId(batchId);

      const { data, error } = await supabase.functions.invoke('apply-bulk-products', {
        body: {
          updates: selectedItems,
          batchId,
          mode: managementMode
        }
      });

      if (error) throw error;

      setUploadPhase("complete");
      setProgress(100);

      toast({
        title: "Changes Applied Successfully",
        description: `${managementMode === 'pricing_only' ? 'Updated pricing for' : 'Processed'} ${data.successCount} products.`,
      });
    } catch (error: any) {
      setUploadPhase("preview");
      toast({
        title: "Update Failed",
        description: error.message,
        variant: "destructive",
      });
    }
  };

  const undoLastUpdate = async () => {
    try {
      const { error } = await supabase.functions.invoke('undo-product-batch', {
        body: { batchId }
      });

      if (error) throw error;

      toast({
        title: "Changes Undone",
        description: "Successfully reverted the last batch of changes.",
      });

      resetUpload();
    } catch (error: any) {
      toast({
        title: "Undo Failed",
        description: error.message,
        variant: "destructive",
      });
    }
  };

  const resetUpload = () => {
    setUploadPhase("upload");
    setPreviewItems([]);
    setValidationErrors([]);
    setProgress(0);
    setBatchId("");
  };

  const toggleItemSelection = (index: number) => {
    setPreviewItems(prev => prev.map((item, i) => 
      i === index ? { ...item, selected: !item.selected } : item
    ));
  };

  const toggleAllItems = () => {
    const allSelected = previewItems.every(item => item.selected);
    setPreviewItems(prev => prev.map(item => ({ ...item, selected: !allSelected })));
  };

  const getChangeDescription = (item: ProductManagementItem) => {
    const changes = [];
    if (item.isNew) {
      changes.push("NEW PRODUCT");
    } else if (managementMode === 'pricing_only' && item.oldPrice && item.unitPrice !== item.oldPrice) {
      const diff = item.unitPrice - item.oldPrice;
      const percentage = ((diff / item.oldPrice) * 100).toFixed(1);
      changes.push(`Price: $${item.oldPrice} → $${item.unitPrice} (${diff >= 0 ? '+' : ''}${percentage}%)`);
    } else if (managementMode === 'full_management') {
      changes.push("Product details will be updated");
    }
    return changes.join(", ");
  };

  const selectedCount = previewItems.filter(item => item.selected).length;

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Settings className="h-5 w-5" />
            Bulk Product Management
          </CardTitle>
        </CardHeader>
        <CardContent>
          <Tabs value={managementMode} onValueChange={(value) => setManagementMode(value as ManagementMode)}>
            <TabsList className="grid w-full grid-cols-2">
              <TabsTrigger value="pricing_only">Pricing Only</TabsTrigger>
              <TabsTrigger value="full_management">Full Product Management</TabsTrigger>
            </TabsList>
            
            <TabsContent value="pricing_only" className="space-y-4 mt-4">
              <p className="text-sm text-muted-foreground">
                Update product pricing only. Perfect for regular price adjustments.
              </p>
            </TabsContent>
            
            <TabsContent value="full_management" className="space-y-4 mt-4">
              <p className="text-sm text-muted-foreground">
                Complete product management including names, descriptions, categories, pricing, and settings. 
                Ideal for onboarding and comprehensive product updates.
              </p>
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>

      {uploadPhase === "upload" && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Upload className="h-5 w-5" />
              Upload {managementMode === 'pricing_only' ? 'Pricing' : 'Product'} File
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <Label htmlFor="file-upload" className="text-sm font-medium">
                  Select CSV or Excel File
                </Label>
                <Input
                  id="file-upload"
                  type="file"
                  accept=".csv,.xlsx,.xls"
                  onChange={(e) => {
                    const file = e.target.files?.[0];
                    if (file) handleFileUpload(file);
                  }}
                  className="mt-1"
                />
              </div>
              <div className="flex flex-col justify-end">
                <Button
                  variant="outline"
                  onClick={() => downloadTemplate(managementMode)}
                  className="flex items-center gap-2"
                >
                  <Download className="h-4 w-4" />
                  Download Template
                </Button>
              </div>
            </div>

            <div className="space-y-2">
              <h4 className="text-sm font-medium">File Requirements:</h4>
              <ul className="text-sm text-muted-foreground space-y-1">
                {managementMode === 'pricing_only' ? (
                  <>
                    <li>• Required columns: Product ID or Name, New Price</li>
                    <li>• Maximum 1000 products per file</li>
                    <li>• Supports CSV and Excel formats</li>
                  </>
                ) : (
                  <>
                    <li>• Required columns: Name, Unit Price, Unit Type</li>
                    <li>• Optional: Description, Category, Subcategory, Color, Photo URL, etc.</li>
                    <li>• Maximum 500 products per file</li>
                    <li>• Categories will be auto-created if they don't exist</li>
                  </>
                )}
              </ul>
            </div>

            {validationErrors.length > 0 && (
              <div className="mt-4 p-4 border border-destructive/20 rounded-lg bg-destructive/5">
                <div className="flex items-center gap-2 mb-2">
                  <AlertCircle className="h-4 w-4 text-destructive" />
                  <h4 className="text-sm font-medium text-destructive">Validation Errors</h4>
                </div>
                <div className="space-y-1 max-h-40 overflow-y-auto">
                  {validationErrors.map((error, index) => (
                    <p key={index} className="text-sm text-destructive">
                      Row {error.row}: {error.field} - {error.message}
                    </p>
                  ))}
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {uploadPhase === "processing" && (
        <Card>
          <CardContent className="pt-6">
            <div className="space-y-4">
              <div className="flex items-center gap-2">
                <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-primary"></div>
                <span className="text-sm font-medium">Processing your file...</span>
              </div>
              <Progress value={progress} className="w-full" />
            </div>
          </CardContent>
        </Card>
      )}

      {uploadPhase === "preview" && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center justify-between">
              <span className="flex items-center gap-2">
                <CheckCircle className="h-5 w-5" />
                Review Changes
              </span>
              <div className="flex items-center gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={toggleAllItems}
                >
                  {previewItems.every(item => item.selected) ? "Deselect All" : "Select All"}
                </Button>
                <Badge variant="secondary">
                  {selectedCount} of {previewItems.length} selected
                </Badge>
              </div>
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="max-h-96 overflow-y-auto space-y-2">
              {previewItems.map((item, index) => (
                <div
                  key={index}
                  className="flex items-center gap-3 p-3 border rounded-lg hover:bg-muted/50"
                >
                  <Checkbox
                    checked={item.selected}
                    onCheckedChange={() => toggleItemSelection(index)}
                  />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <h4 className="font-medium truncate">{item.name}</h4>
                      {item.isNew && <Badge variant="secondary">NEW</Badge>}
                    </div>
                    {managementMode === 'full_management' && (
                      <div className="text-sm text-muted-foreground mt-1">
                        {item.category && <span>Category: {item.category}</span>}
                        {item.subcategory && <span> • Subcategory: {item.subcategory}</span>}
                        <span> • ${item.unitPrice} per {item.unitType}</span>
                      </div>
                    )}
                    <p className="text-sm text-muted-foreground mt-1">
                      {getChangeDescription(item)}
                    </p>
                  </div>
                </div>
              ))}
            </div>

            <div className="flex gap-2">
              <Button onClick={applyChanges} disabled={selectedCount === 0}>
                <Plus className="h-4 w-4 mr-2" />
                Apply {selectedCount} Changes
              </Button>
              <Button variant="outline" onClick={resetUpload}>
                Cancel
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {uploadPhase === "complete" && (
        <Card>
          <CardContent className="pt-6">
            <div className="text-center space-y-4">
              <div className="flex justify-center">
                <CheckCircle className="h-12 w-12 text-success" />
              </div>
              <div>
                <h3 className="text-lg font-semibold">Changes Applied Successfully!</h3>
                <p className="text-muted-foreground">
                  Your {managementMode === 'pricing_only' ? 'pricing updates' : 'product changes'} have been processed.
                </p>
              </div>
              <div className="flex justify-center gap-2">
                <Button onClick={resetUpload}>
                  <Upload className="h-4 w-4 mr-2" />
                  Upload Another File
                </Button>
                <Button variant="outline" onClick={undoLastUpdate}>
                  <Undo className="h-4 w-4 mr-2" />
                  Undo Changes
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}