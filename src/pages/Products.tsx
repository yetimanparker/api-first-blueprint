import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Plus, Edit, Trash2, Package, Eye, EyeOff, ArrowLeft } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { ProductForm } from "@/components/ProductForm";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { PhoneQuoteDialog } from "@/components/PhoneQuoteDialog";

interface Product {
  id: string;
  name: string;
  description: string | null;
  unit_price: number;
  unit_type: string;
  color_hex: string;
  is_active: boolean;
  show_pricing_before_submit: boolean;
  display_order: number | null;
  photo_url?: string | null;
  product_addons?: ProductAddon[];
  product_variations?: ProductVariation[];
}

interface ProductVariation {
  id: string;
  name: string;
  description: string | null;
  price_adjustment: number;
  adjustment_type: "fixed" | "percentage";
  display_order: number;
  is_active: boolean;
}

interface ProductAddon {
  id: string;
  name: string;
  description: string | null;
  price_type: "fixed" | "percentage";
  price_value: number;
  display_order: number;
  is_active: boolean;
  calculation_type: "total" | "per_unit" | "area_calculation";
  calculation_formula?: string | null;
}

export default function Products() {
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [editingProduct, setEditingProduct] = useState<Product | null>(null);
  const [showProductForm, setShowProductForm] = useState(false);
  const { toast } = useToast();
  const navigate = useNavigate();

  const unitTypeLabels = {
    sq_ft: "Square Feet",
    linear_ft: "Linear Feet", 
    cu_ft: "Cubic Feet",
    each: "Each"
  };

  useEffect(() => {
    fetchProducts();
  }, []);

  const fetchProducts = async () => {
    try {
      const { data: products, error } = await supabase
        .from("products")
        .select(`
          *,
          product_addons(*),
          product_variations(*)
        `)
        .order("display_order", { ascending: true })
        .order("name", { ascending: true });

      if (error) throw error;
      setProducts((products || []).map(product => ({
        ...product,
        product_addons: product.product_addons?.map(addon => ({
          ...addon,
          price_type: addon.price_type as "fixed" | "percentage",
          calculation_type: addon.calculation_type as "total" | "per_unit" | "area_calculation" || "total"
        })),
        product_variations: product.product_variations?.map(variation => ({
          ...variation,
          adjustment_type: variation.adjustment_type as "fixed" | "percentage"
        }))
      })));
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteProduct = async (productId: string) => {
    try {
      const { error } = await supabase
        .from("products")
        .delete()
        .eq("id", productId);

      if (error) throw error;

      toast({
        title: "Success",
        description: "Product deleted successfully",
      });
      
      fetchProducts();
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    }
  };

  const handleProductSaved = () => {
    setShowProductForm(false);
    setEditingProduct(null);
    fetchProducts();
  };

  if (loading) {
    return (
      <div className="container mx-auto py-8">
        <div className="flex items-center justify-center h-64">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="border-b border-border bg-card">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16">
            <div className="flex items-center">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => navigate("/dashboard")}
                className="mr-4"
              >
                <ArrowLeft className="h-4 w-4 mr-2" />
                Back to Dashboard
              </Button>
              <div>
                <h1 className="text-xl font-semibold text-foreground">Products</h1>
                <p className="text-sm text-muted-foreground">Manage your product catalog</p>
              </div>
            </div>
            <Dialog open={showProductForm} onOpenChange={setShowProductForm}>
              <DialogTrigger asChild>
                <Button onClick={() => setEditingProduct(null)}>
                  <Plus className="h-4 w-4 mr-2" />
                  Add Product
                </Button>
              </DialogTrigger>
              <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
                <DialogHeader>
                  <DialogTitle>
                    {editingProduct ? "Edit Product" : "Add New Product"}
                  </DialogTitle>
                </DialogHeader>
                <ProductForm
                  product={editingProduct}
                  onSaved={handleProductSaved}
                  onCancel={() => setShowProductForm(false)}
                />
              </DialogContent>
            </Dialog>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">

      {products.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center">
            <Package className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
            <h3 className="text-lg font-semibold mb-2">No products yet</h3>
            <p className="text-muted-foreground mb-4">
              Create your first product to start building quotes
            </p>
            <Button onClick={() => setShowProductForm(true)}>
              <Plus className="h-4 w-4 mr-2" />
              Add Product
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {products.map((product) => (
            <Card key={product.id} className="relative">
              <CardHeader>
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <CardTitle className="flex items-center gap-2">
                      <div
                        className="w-4 h-4 rounded"
                        style={{ backgroundColor: product.color_hex }}
                      />
                      {product.name}
                    </CardTitle>
                    <CardDescription>{product.description}</CardDescription>
                  </div>
                  <div className="flex gap-1">
                    {product.photo_url && (
                      <img 
                        src={product.photo_url} 
                        alt={product.name}
                        className="w-12 h-12 object-cover rounded"
                      />
                    )}
                    {product.show_pricing_before_submit ? (
                      <Eye className="h-4 w-4 text-muted-foreground" />
                    ) : (
                      <EyeOff className="h-4 w-4 text-muted-foreground" />
                    )}
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  <div className="flex justify-between items-center">
                    <span className="text-sm text-muted-foreground">Price:</span>
                    <span className="font-semibold">
                      ${product.unit_price.toFixed(2)} / {unitTypeLabels[product.unit_type as keyof typeof unitTypeLabels]}
                    </span>
                  </div>
                  
                  <div className="flex justify-between items-center">
                    <span className="text-sm text-muted-foreground">Status:</span>
                    <Badge variant={product.is_active ? "default" : "secondary"}>
                      {product.is_active ? "Active" : "Inactive"}
                    </Badge>
                  </div>

                  {product.product_variations && product.product_variations.length > 0 && (
                    <div>
                      <span className="text-sm text-muted-foreground">Variations:</span>
                      <div className="mt-1 space-y-1">
                        {product.product_variations.slice(0, 2).map((variation) => (
                          <div key={variation.id} className="text-xs text-muted-foreground">
                            • {variation.name} ({variation.adjustment_type === 'fixed' ? `+$${variation.price_adjustment}` : `+${variation.price_adjustment}%`})
                          </div>
                        ))}
                        {product.product_variations.length > 2 && (
                          <div className="text-xs text-muted-foreground">
                            +{product.product_variations.length - 2} more variations
                          </div>
                        )}
                      </div>
                    </div>
                  )}

                  {product.product_addons && product.product_addons.length > 0 && (
                    <div>
                      <span className="text-sm text-muted-foreground">Add-ons:</span>
                      <div className="mt-1 space-y-1">
                        {product.product_addons.slice(0, 2).map((addon) => (
                          <div key={addon.id} className="text-xs text-muted-foreground">
                            • {addon.name} ({(addon.calculation_type || 'total') === 'per_unit' ? 'per unit' : (addon.calculation_type || 'total') === 'area_calculation' ? 'area calc' : 'total'}) - {addon.price_type === 'fixed' ? `$${addon.price_value}` : `${addon.price_value}%`}
                          </div>
                        ))}
                        {product.product_addons.length > 2 && (
                          <div className="text-xs text-muted-foreground">
                            +{product.product_addons.length - 2} more add-ons
                          </div>
                        )}
                      </div>
                    </div>
                  )}

                  <div className="flex gap-2 pt-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => {
                        setEditingProduct(product);
                        setShowProductForm(true);
                      }}
                      className="flex-1"
                    >
                      <Edit className="h-4 w-4 mr-2" />
                      Edit
                    </Button>
                    <AlertDialog>
                      <AlertDialogTrigger asChild>
                        <Button variant="outline" size="sm" className="text-destructive hover:text-destructive">
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </AlertDialogTrigger>
                      <AlertDialogContent>
                        <AlertDialogHeader>
                          <AlertDialogTitle>Delete Product</AlertDialogTitle>
                          <AlertDialogDescription>
                            Are you sure you want to delete "{product.name}"? This action cannot be undone.
                          </AlertDialogDescription>
                        </AlertDialogHeader>
                        <AlertDialogFooter>
                          <AlertDialogCancel>Cancel</AlertDialogCancel>
                          <AlertDialogAction
                            onClick={() => handleDeleteProduct(product.id)}
                            className="bg-destructive hover:bg-destructive/90"
                          >
                            Delete
                          </AlertDialogAction>
                        </AlertDialogFooter>
                      </AlertDialogContent>
                    </AlertDialog>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
      </main>
    </div>
  );
}