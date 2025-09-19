import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogDescription } from "@/components/ui/dialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ProductForm } from "@/components/ProductForm";
import { ProductSettings } from "@/components/ProductSettings";
import { CategoryManagement } from "@/components/CategoryManagement";
import { BulkProductManagement } from "@/components/BulkProductManagement";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { useGlobalSettings, useProductCategories } from "@/hooks/useGlobalSettings";
import { displayPrice, formatExactPrice } from "@/lib/priceUtils";
import { ArrowLeft, Plus, Search, Eye, EyeOff, Edit2, Trash2, ShoppingBag, Package, Settings, Tag, Upload } from "lucide-react";
import { useNavigate } from "react-router-dom";

// Data structures
interface ProductVariation {
  id: string;
  name: string;
  description: string | null;
  price_adjustment: number;
  adjustment_type: "fixed" | "percentage";
  display_order: number;
  is_active: boolean;
  height_value?: number | null;
  unit_of_measurement: string;
  affects_area_calculation: boolean;
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
  categoryName?: string;
  subcategoryName?: string;
  product_addons?: ProductAddon[];
  product_variations?: ProductVariation[];
}

export default function Products() {
  const [products, setProducts] = useState<Product[]>([]);
  const [filteredProducts, setFilteredProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [editingProduct, setEditingProduct] = useState<Product | {} | null>(null);
  const [searchTerm, setSearchTerm] = useState("");
  const [categoryFilter, setCategoryFilter] = useState<string>("all");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const { toast } = useToast();
  const navigate = useNavigate();
  const { settings } = useGlobalSettings();
  const { categories } = useProductCategories();

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
        product.categoryName?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        product.subcategoryName?.toLowerCase().includes(searchTerm.toLowerCase())
      );
    }

    // Category filter
    if (categoryFilter !== "all") {
      filtered = filtered.filter(product => product.categoryName === categoryFilter);
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

      // Get categories separately for lookup
      const { data: categories } = await supabase
        .from("product_categories")
        .select("id, name, color_hex");

      const { data: subcategories } = await supabase
        .from("product_subcategories")  
        .select("id, name, category_id");

      const categoryMap = new Map(categories?.map(c => [c.id, c]) || []);
      const subcategoryMap = new Map(subcategories?.map(s => [s.id, s]) || []);

      setProducts((products || []).map(product => ({
        ...product,
        categoryName: product.category ? categoryMap.get(product.category)?.name || product.category : undefined,
        subcategoryName: product.subcategory ? subcategoryMap.get(product.subcategory)?.name || product.subcategory : undefined,
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
                <h1 className="text-xl font-semibold text-foreground">Product Management</h1>
                <p className="text-sm text-muted-foreground">
                  Manage products, settings, and categories
                </p>
              </div>
            </div>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <Tabs defaultValue="products" className="space-y-6">
          <TabsList>
            <TabsTrigger value="products" className="flex items-center gap-2">
              <Package className="h-4 w-4" />
              Products
            </TabsTrigger>
            <TabsTrigger value="bulk-pricing" className="flex items-center gap-2">
              <Upload className="h-4 w-4" />
              Bulk Pricing
            </TabsTrigger>
            <TabsTrigger value="settings" className="flex items-center gap-2">
              <Settings className="h-4 w-4" />
              Settings
            </TabsTrigger>
            <TabsTrigger value="categories" className="flex items-center gap-2">
              <Tag className="h-4 w-4" />
              Categories
            </TabsTrigger>
          </TabsList>

          <TabsContent value="products" className="space-y-6">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-2xl font-bold">Products</h2>
                <p className="text-muted-foreground">
                  {filteredProducts.length} product{filteredProducts.length !== 1 ? 's' : ''} found
                </p>
              </div>
              <Dialog open={!!editingProduct} onOpenChange={(open) => !open && setEditingProduct(null)}>
                <DialogTrigger asChild>
                  <Button onClick={() => setEditingProduct({})}>
                    <Plus className="h-4 w-4 mr-2" />
                    Add Product
                  </Button>
                </DialogTrigger>
                <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
                  <DialogHeader>
                    <DialogTitle>
                      {(editingProduct as Product)?.id ? 'Edit Product' : 'Add New Product'}
                    </DialogTitle>
                  </DialogHeader>
                  <ProductForm
                    product={(editingProduct as Product)?.id ? editingProduct as Product : null}
                    onSaved={handleProductSaved}
                    onCancel={() => setEditingProduct(null)}
                  />
                </DialogContent>
              </Dialog>
            </div>

            {products.length === 0 ? (
              <Card>
                <CardContent className="text-center py-12">
                  <ShoppingBag className="h-16 w-16 mx-auto text-muted-foreground mb-4" />
                  <h3 className="text-lg font-semibold mb-2">No products yet</h3>
                  <p className="text-muted-foreground mb-4">
                    Start building your product catalog by adding your first product.
                  </p>
                  <Dialog open={!!editingProduct} onOpenChange={(open) => !open && setEditingProduct(null)}>
                    <DialogTrigger asChild>
                      <Button onClick={() => setEditingProduct({})}>
                        <Plus className="h-4 w-4 mr-2" />
                        Add Your First Product
                      </Button>
                    </DialogTrigger>
                    <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
                      <DialogHeader>
                        <DialogTitle>Add New Product</DialogTitle>
                      </DialogHeader>
                      <ProductForm
                        product={null}
                        onSaved={handleProductSaved}
                        onCancel={() => setEditingProduct(null)}
                      />
                    </DialogContent>
                  </Dialog>
                </CardContent>
              </Card>
            ) : (
              <>
                {/* Filters */}
                <Card>
                  <CardHeader>
                    <CardTitle className="text-lg">Filter Products</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                      <div className="relative">
                        <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground h-4 w-4" />
                        <Input
                          placeholder="Search products..."
                          value={searchTerm}
                          onChange={(e) => setSearchTerm(e.target.value)}
                          className="pl-10"
                        />
                      </div>
                      
                      <Select value={categoryFilter} onValueChange={setCategoryFilter}>
                        <SelectTrigger>
                          <SelectValue placeholder="All categories" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="all">All Categories</SelectItem>
                          {categories.map((category) => (
                            <SelectItem key={category.id} value={category.name}>
                              {category.name}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>

                      <Select value={statusFilter} onValueChange={setStatusFilter}>
                        <SelectTrigger>
                          <SelectValue placeholder="All statuses" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="all">All Statuses</SelectItem>
                          <SelectItem value="active">Active</SelectItem>
                          <SelectItem value="inactive">Inactive</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </CardContent>
                </Card>

                {/* Products Table */}
                <Card>
                  <CardContent className="p-0">
                    <Table>
                      <TableHeader>
                        <TableRow>
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
                              <div className="flex items-center space-x-3">
                                {product.photo_url ? (
                                  <img
                                    src={product.photo_url}
                                    alt={product.name}
                                    className="h-12 w-12 rounded-lg object-cover"
                                  />
                                ) : (
                                  <div
                                    className="h-12 w-12 rounded-lg flex items-center justify-center text-white text-sm font-semibold"
                                    style={{ backgroundColor: product.color_hex }}
                                  >
                                    {product.name
                                      .split(' ')
                                      .map(word => word[0])
                                      .join('')
                                      .toUpperCase()
                                      .slice(0, 2)
                                    }
                                  </div>
                                )}
                                <div>
                                  <div className="font-medium">{product.name}</div>
                                  {product.description && (
                                    <div className="text-sm text-muted-foreground">
                                      {product.description}
                                    </div>
                                  )}
                                </div>
                              </div>
                            </TableCell>
                            <TableCell>
                              <div className="space-y-1">
                                 <Badge 
                                   variant="secondary" 
                                   style={{ 
                                     backgroundColor: categories.find(c => c.name === product.categoryName)?.color_hex + '20',
                                     color: categories.find(c => c.name === product.categoryName)?.color_hex
                                   }}
                                 >
                                   {product.categoryName || 'Uncategorized'}
                                 </Badge>
                                 {product.subcategoryName && (
                                   <div className="text-xs text-muted-foreground">
                                     {product.subcategoryName}
                                   </div>
                                 )}
                              </div>
                            </TableCell>
                            <TableCell>
                              <div className="font-medium">
                                {formatExactPrice(product.unit_price, { 
                                  currency_symbol: settings?.currency_symbol || '$',
                                  decimal_precision: settings?.decimal_precision || 2 
                                })}
                              </div>
                              <div className="text-sm text-muted-foreground">
                                per {product.unit_type.replace('_', ' ')}
                              </div>
                            </TableCell>
                            <TableCell>
                              <Badge variant={product.is_active ? "default" : "secondary"}>
                                {product.is_active ? (
                                  <>
                                    <Eye className="h-3 w-3 mr-1" />
                                    Active
                                  </>
                                ) : (
                                  <>
                                    <EyeOff className="h-3 w-3 mr-1" />
                                    Inactive
                                  </>
                                )}
                              </Badge>
                            </TableCell>
                            <TableCell>
                              <Badge variant="outline">
                                {product.product_variations?.length || 0}
                              </Badge>
                            </TableCell>
                            <TableCell>
                              <Badge variant="outline">
                                {product.product_addons?.length || 0}
                              </Badge>
                            </TableCell>
                            <TableCell className="text-right">
                              <div className="flex justify-end space-x-2">
                                <Button
                                  variant="outline"
                                  size="sm"
                                  onClick={() => setEditingProduct(product)}
                                >
                                  <Edit2 className="h-3 w-3" />
                                </Button>
                                <AlertDialog>
                                  <AlertDialogTrigger asChild>
                                    <Button variant="outline" size="sm">
                                      <Trash2 className="h-3 w-3" />
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
                                        className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
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
              </>
            )}
          </TabsContent>

          <TabsContent value="bulk-pricing">
            <BulkProductManagement />
          </TabsContent>

          <TabsContent value="settings">
            <ProductSettings />
          </TabsContent>

          <TabsContent value="categories">
            <CategoryManagement />
          </TabsContent>
        </Tabs>
      </main>
    </div>
  );
}