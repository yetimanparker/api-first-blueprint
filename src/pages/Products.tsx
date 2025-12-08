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
import { ArrowLeft, Plus, Search, Eye, EyeOff, Edit2, Trash2, ShoppingBag, Package, Settings, Tag, Upload, ChevronUp, ChevronDown, ChevronsUpDown } from "lucide-react";
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
  is_required: boolean;
  is_default: boolean;
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
  input_mode?: "toggle" | "quantity";
}

interface Product {
  id: string;
  name: string;
  description: string | null;
  unit_price: number;
  min_order_quantity: number;
  unit_type: string;
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
  base_height?: number | null;
  base_height_unit?: string | null;
  use_height_in_calculation?: boolean;
}

type SortField = 'name' | 'category' | 'price' | 'status';
type SortDirection = 'asc' | 'desc' | null;

export default function Products() {
  const [products, setProducts] = useState<Product[]>([]);
  const [filteredProducts, setFilteredProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [editingProduct, setEditingProduct] = useState<Product | {} | null>(null);
  const [searchTerm, setSearchTerm] = useState("");
  const [categoryFilter, setCategoryFilter] = useState<string>("all");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [sortField, setSortField] = useState<SortField | null>(null);
  const [sortDirection, setSortDirection] = useState<SortDirection>(null);
  const { toast } = useToast();
  const navigate = useNavigate();
  const { settings } = useGlobalSettings();
  const { categories } = useProductCategories();

  useEffect(() => {
    fetchProducts();
  }, []);

  useEffect(() => {
    filterProducts();
  }, [products, searchTerm, categoryFilter, statusFilter, sortField, sortDirection]);

  const handleSort = (field: SortField) => {
    if (sortField === field) {
      // Cycle through: asc -> desc -> none
      if (sortDirection === 'asc') {
        setSortDirection('desc');
      } else if (sortDirection === 'desc') {
        setSortField(null);
        setSortDirection(null);
      }
    } else {
      setSortField(field);
      setSortDirection('asc');
    }
  };

  const sortProducts = (products: Product[]) => {
    if (!sortField || !sortDirection) return products;

    return [...products].sort((a, b) => {
      let aValue: any;
      let bValue: any;

      switch (sortField) {
        case 'name':
          aValue = a.name.toLowerCase();
          bValue = b.name.toLowerCase();
          break;
        case 'category':
          aValue = a.categoryName?.toLowerCase() || 'zzz'; // Put uncategorized last
          bValue = b.categoryName?.toLowerCase() || 'zzz';
          break;
        case 'price':
          aValue = a.unit_price;
          bValue = b.unit_price;
          break;
        case 'status':
          aValue = a.is_active ? 0 : 1; // Active first
          bValue = b.is_active ? 0 : 1;
          break;
        default:
          return 0;
      }

      if (aValue < bValue) return sortDirection === 'asc' ? -1 : 1;
      if (aValue > bValue) return sortDirection === 'asc' ? 1 : -1;
      return 0;
    });
  };

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

    // Apply sorting
    filtered = sortProducts(filtered);

    setFilteredProducts(filtered);
  };

  const fetchProducts = async () => {
    try {
      const { data: products, error } = await supabase
        .from("products")
        .select(`
          *,
          product_addons!product_addons_product_id_fkey(*),
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
          calculation_type: addon.calculation_type as "total" | "per_unit" | "area_calculation" || "total",
          input_mode: (addon.input_mode as "toggle" | "quantity") || "quantity"
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

  const handleStatusChange = async (productId: string, newStatus: boolean) => {
    try {
      const { error } = await supabase
        .from("products")
        .update({ is_active: newStatus })
        .eq("id", productId);

      if (error) throw error;

      toast({
        title: "Success",
        description: `Product ${newStatus ? 'activated' : 'deactivated'} successfully`,
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
          <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center py-4 sm:h-16 gap-2">
            <div className="flex flex-col sm:flex-row sm:items-center gap-2">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => navigate("/dashboard")}
                className="self-start sm:mr-4"
              >
                <ArrowLeft className="h-4 w-4 mr-2" />
                Back
              </Button>
              <div>
                <h1 className="text-lg sm:text-xl font-semibold text-foreground">Product Management</h1>
                <p className="text-xs sm:text-sm text-muted-foreground">
                  Manage products, settings, and categories
                </p>
              </div>
            </div>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4 sm:py-8">
        <Tabs defaultValue="products" className="space-y-4 sm:space-y-6">
          <TabsList className="grid w-full grid-cols-2 sm:grid-cols-4 h-auto gap-1">
            <TabsTrigger value="products" className="text-xs sm:text-sm py-2 px-2">
              Products
            </TabsTrigger>
            <TabsTrigger value="bulk-pricing" className="text-xs sm:text-sm py-2 px-2">
              Bulk Pricing
            </TabsTrigger>
            <TabsTrigger value="settings" className="text-xs sm:text-sm py-2 px-2">
              Settings
            </TabsTrigger>
            <TabsTrigger value="categories" className="text-xs sm:text-sm py-2 px-2">
              Categories
            </TabsTrigger>
          </TabsList>

          <TabsContent value="products" className="space-y-4 sm:space-y-6">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
              <div>
                <h2 className="text-xl sm:text-2xl font-bold">Products</h2>
                <p className="text-sm text-muted-foreground">
                  {filteredProducts.length} product{filteredProducts.length !== 1 ? 's' : ''} found
                </p>
              </div>
              <Dialog open={!!editingProduct} onOpenChange={(open) => !open && setEditingProduct(null)}>
                <DialogTrigger asChild>
                  <Button onClick={() => setEditingProduct({})} className="w-full sm:w-auto">
                    <Plus className="h-4 w-4 mr-2" />
                    Add Product
                  </Button>
                </DialogTrigger>
                 <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
                   <DialogHeader>
                     <DialogTitle>
                       {(editingProduct as Product)?.id ? 'Edit Product' : 'Add New Product'}
                     </DialogTitle>
                     <DialogDescription>
                       {(editingProduct as Product)?.id ? 'Make changes to your product information.' : 'Fill out the form below to add a new product to your catalog.'}
                     </DialogDescription>
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
                         <DialogDescription>
                           Fill out the form below to add your first product to your catalog.
                         </DialogDescription>
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
                    <CardTitle className="text-base sm:text-lg">Filter Products</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
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
                    <div className="overflow-x-auto">
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead 
                              className="cursor-pointer select-none hover:bg-muted/50 transition-colors whitespace-nowrap"
                              onClick={() => handleSort('name')}
                            >
                              <div className="flex items-center gap-2">
                                Product
                                {sortField === 'name' ? (
                                  sortDirection === 'asc' ? (
                                    <ChevronUp className="h-4 w-4" />
                                  ) : (
                                    <ChevronDown className="h-4 w-4" />
                                  )
                                ) : (
                                  <ChevronsUpDown className="h-4 w-4 opacity-50" />
                                )}
                              </div>
                            </TableHead>
                            <TableHead 
                              className="cursor-pointer select-none hover:bg-muted/50 transition-colors whitespace-nowrap"
                              onClick={() => handleSort('category')}
                            >
                              <div className="flex items-center gap-2">
                                Category
                                {sortField === 'category' ? (
                                  sortDirection === 'asc' ? (
                                    <ChevronUp className="h-4 w-4" />
                                  ) : (
                                    <ChevronDown className="h-4 w-4" />
                                  )
                                ) : (
                                  <ChevronsUpDown className="h-4 w-4 opacity-50" />
                                )}
                              </div>
                            </TableHead>
                            <TableHead 
                              className="cursor-pointer select-none hover:bg-muted/50 transition-colors whitespace-nowrap"
                              onClick={() => handleSort('price')}
                            >
                              <div className="flex items-center gap-2">
                                Price
                                {sortField === 'price' ? (
                                  sortDirection === 'asc' ? (
                                    <ChevronUp className="h-4 w-4" />
                                  ) : (
                                    <ChevronDown className="h-4 w-4" />
                                  )
                                ) : (
                                  <ChevronsUpDown className="h-4 w-4 opacity-50" />
                                )}
                              </div>
                            </TableHead>
                            <TableHead className="whitespace-nowrap">Min Order</TableHead>
                            <TableHead 
                              className="cursor-pointer select-none hover:bg-muted/50 transition-colors whitespace-nowrap"
                              onClick={() => handleSort('status')}
                            >
                              <div className="flex items-center gap-2">
                                Status
                                {sortField === 'status' ? (
                                  sortDirection === 'asc' ? (
                                    <ChevronUp className="h-4 w-4" />
                                  ) : (
                                    <ChevronDown className="h-4 w-4" />
                                  )
                                ) : (
                                  <ChevronsUpDown className="h-4 w-4 opacity-50" />
                                )}
                              </div>
                            </TableHead>
                            <TableHead className="whitespace-nowrap">Variations</TableHead>
                            <TableHead className="whitespace-nowrap">Add-ons</TableHead>
                            <TableHead className="text-right whitespace-nowrap">Actions</TableHead>
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
                                  <div className="h-12 w-12 rounded-lg flex items-center justify-center bg-muted text-muted-foreground text-sm font-semibold">
                                    <Package className="h-6 w-6" />
                                  </div>
                                )}
                              <div>
                                  <div className="font-medium">{product.name}</div>
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
                              <div className="font-medium">
                                {product.min_order_quantity}
                              </div>
                              <div className="text-sm text-muted-foreground">
                                {product.unit_type.replace('_', ' ')}
                              </div>
                            </TableCell>
                            <TableCell>
                              <Select 
                                value={product.is_active ? "active" : "inactive"}
                                onValueChange={(value) => handleStatusChange(product.id, value === "active")}
                              >
                                <SelectTrigger className="w-[130px]">
                                  <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                  <SelectItem value="active">
                                    <div className="flex items-center">
                                      <Eye className="h-3 w-3 mr-2" />
                                      Active
                                    </div>
                                  </SelectItem>
                                  <SelectItem value="inactive">
                                    <div className="flex items-center">
                                      <EyeOff className="h-3 w-3 mr-2" />
                                      Inactive
                                    </div>
                                  </SelectItem>
                                </SelectContent>
                              </Select>
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
                    </div>
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