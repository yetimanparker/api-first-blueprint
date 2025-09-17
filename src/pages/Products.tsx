import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Plus, Edit, Trash2, Package, Eye, EyeOff, ArrowLeft, Search, Filter } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { ProductForm } from "@/components/ProductForm";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";

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
  category?: string | null;
  subcategory?: string | null;
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
  const [filteredProducts, setFilteredProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [editingProduct, setEditingProduct] = useState<Product | null>(null);
  const [showProductForm, setShowProductForm] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  const [categoryFilter, setCategoryFilter] = useState<string>("all");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const { toast } = useToast();
  const navigate = useNavigate();

  const unitTypeLabels = {
    sq_ft: "sq ft",
    linear_ft: "lin ft", 
    cu_ft: "cu ft",
    each: "each"
  };

  const categoryLabels: Record<string, string> = {
    fencing: "Fencing",
    flooring: "Flooring",
    roofing: "Roofing",
    painting: "Painting",
    landscaping: "Landscaping",
    plumbing: "Plumbing",
    electrical: "Electrical",
    hvac: "HVAC",
    concrete: "Concrete",
    other: "Other",
  };

  useEffect(() => {
    fetchProducts();
  }, []);

  useEffect(() => {
    filterProducts();
  }, [products, searchTerm, categoryFilter, statusFilter]);

  const filterProducts = () => {
    let filtered = products;

    // Search filter
    if (searchTerm) {
      filtered = filtered.filter(product =>
        product.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        product.description?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        product.category?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        product.subcategory?.toLowerCase().includes(searchTerm.toLowerCase())
      );
    }

    // Category filter
    if (categoryFilter !== "all") {
      filtered = filtered.filter(product => product.category === categoryFilter);
    }

    // Status filter
    if (statusFilter !== "all") {
      filtered = filtered.filter(product => 
        statusFilter === "active" ? product.is_active : !product.is_active
      );
    }

    setFilteredProducts(filtered);
  };

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

  const uniqueCategories = Array.from(new Set(products.filter(p => p.category).map(p => p.category)));

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
          <div className="space-y-4">
            {/* Filters */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Filter className="h-5 w-5" />
                  Filters
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                  <div className="relative">
                    <Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                    <Input
                      placeholder="Search products..."
                      value={searchTerm}
                      onChange={(e) => setSearchTerm(e.target.value)}
                      className="pl-10"
                    />
                  </div>
                  
                  <Select value={categoryFilter} onValueChange={setCategoryFilter}>
                    <SelectTrigger>
                      <SelectValue placeholder="All Categories" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All Categories</SelectItem>
                      {uniqueCategories.map((category) => (
                        <SelectItem key={category} value={category!}>
                          {categoryLabels[category!] || category}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>

                  <Select value={statusFilter} onValueChange={setStatusFilter}>
                    <SelectTrigger>
                      <SelectValue placeholder="All Status" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All Status</SelectItem>
                      <SelectItem value="active">Active Only</SelectItem>
                      <SelectItem value="inactive">Inactive Only</SelectItem>
                    </SelectContent>
                  </Select>

                  <div className="text-sm text-muted-foreground flex items-center">
                    Showing {filteredProducts.length} of {products.length} products
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Products Table */}
            <Card>
              <CardContent className="p-0">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-16"></TableHead>
                      <TableHead>Product</TableHead>
                      <TableHead>Category</TableHead>
                      <TableHead>Price</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Variations</TableHead>
                      <TableHead>Add-ons</TableHead>
                      <TableHead className="text-right">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredProducts.map((product) => (
                      <TableRow key={product.id}>
                        <TableCell>
                          {product.photo_url ? (
                            <img 
                              src={product.photo_url} 
                              alt={product.name}
                              className="w-12 h-12 object-cover rounded border"
                            />
                          ) : (
                            <div
                              className="w-12 h-12 rounded border flex items-center justify-center"
                              style={{ backgroundColor: product.color_hex }}
                            >
                              <Package className="h-6 w-6 text-white" />
                            </div>
                          )}
                        </TableCell>
                        <TableCell>
                          <div>
                            <div className="font-medium flex items-center gap-2">
                              {product.name}
                              {product.show_pricing_before_submit ? (
                                <Eye className="h-3 w-3 text-muted-foreground" />
                              ) : (
                                <EyeOff className="h-3 w-3 text-muted-foreground" />
                              )}
                            </div>
                            {product.description && (
                              <div className="text-sm text-muted-foreground">
                                {product.description}
                              </div>
                            )}
                          </div>
                        </TableCell>
                        <TableCell>
                          <div>
                            <div className="font-medium">
                              {product.category ? categoryLabels[product.category] || product.category : "Uncategorized"}
                            </div>
                            {product.subcategory && (
                              <div className="text-sm text-muted-foreground">
                                {product.subcategory}
                              </div>
                            )}
                          </div>
                        </TableCell>
                        <TableCell>
                          <div className="font-medium">
                            ${product.unit_price.toFixed(2)}
                          </div>
                          <div className="text-sm text-muted-foreground">
                            per {unitTypeLabels[product.unit_type as keyof typeof unitTypeLabels]}
                          </div>
                        </TableCell>
                        <TableCell>
                          <Badge variant={product.is_active ? "default" : "secondary"}>
                            {product.is_active ? "Active" : "Inactive"}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          {product.product_variations && product.product_variations.length > 0 ? (
                            <div className="text-sm">
                              <div className="font-medium">{product.product_variations.length} variations</div>
                              <div className="text-muted-foreground text-xs">
                                {product.product_variations.slice(0, 2).map(v => v.name).join(", ")}
                                {product.product_variations.length > 2 && "..."}
                              </div>
                            </div>
                          ) : (
                            <span className="text-muted-foreground text-sm">None</span>
                          )}
                        </TableCell>
                        <TableCell>
                          {product.product_addons && product.product_addons.length > 0 ? (
                            <div className="text-sm">
                              <div className="font-medium">{product.product_addons.length} add-ons</div>
                              <div className="text-muted-foreground text-xs">
                                {product.product_addons.slice(0, 2).map(a => a.name).join(", ")}
                                {product.product_addons.length > 2 && "..."}
                              </div>
                            </div>
                          ) : (
                            <span className="text-muted-foreground text-sm">None</span>
                          )}
                        </TableCell>
                        <TableCell className="text-right">
                          <div className="flex gap-2 justify-end">
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => {
                                setEditingProduct(product);
                                setShowProductForm(true);
                              }}
                            >
                              <Edit className="h-4 w-4" />
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
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          </div>
        )}
      </main>
    </div>
  );
}