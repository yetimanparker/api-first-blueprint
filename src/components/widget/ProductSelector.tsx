import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Label } from '@/components/ui/label';
import { Loader2, Package, Palette } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { GlobalSettings } from '@/hooks/useGlobalSettings';
import { formatExactPrice } from '@/lib/priceUtils';

interface Product {
  id: string;
  name: string;
  description?: string;
  unit_type: string;
  unit_price: number;
  color_hex: string;
  photo_url?: string;
  category?: string;
  subcategory?: string;
  is_active: boolean;
  show_pricing_before_submit: boolean;
}

interface ProductCategory {
  id: string;
  name: string;
  color_hex: string;
}

interface ProductSelectorProps {
  categories: ProductCategory[];
  onProductSelect: (productId: string) => void;
  settings: GlobalSettings;
  contractorId: string;
}

const ProductSelector = ({ categories, onProductSelect, settings, contractorId }: ProductSelectorProps) => {
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedCategory, setSelectedCategory] = useState<string>('');
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (contractorId) {
      console.log('Fetching products for contractor:', contractorId);
      fetchProducts();
    }
  }, [contractorId]);

  const fetchProducts = async () => {
    try {
      setLoading(true);
      setError(null);
      
      if (!contractorId) {
        throw new Error('Contractor ID not provided');
      }
      
      console.log('Fetching products for contractor:', contractorId);
      
      const { data, error } = await supabase
        .from('products')
        .select('*')
        .eq('contractor_id', contractorId)
        .eq('is_active', true)
        .order('display_order', { ascending: true });

      if (error) {
        console.error('Supabase error:', error);
        throw error;
      }
      
      console.log(`Successfully fetched ${data?.length || 0} products for contractor ${contractorId}`);
      console.log('Products data:', data);
      setProducts(data || []);
      
      if (!data || data.length === 0) {
        console.warn('No active products found for contractor:', contractorId);
      }
    } catch (err) {
      console.error('Error fetching products:', err);
      setError(`Failed to load products: ${err instanceof Error ? err.message : 'Unknown error'}`);
    } finally {
      setLoading(false);
    }
  };

  const filteredProducts = selectedCategory 
    ? products.filter(p => p.category === selectedCategory)
    : products;

  const shouldShowPricing = (product: Product) => {
    return product.show_pricing_before_submit;
  };

  if (loading) {
    return (
      <Card className="max-w-4xl mx-auto">
        <CardContent className="flex items-center justify-center py-12">
          <div className="text-center">
            <Loader2 className="h-8 w-8 animate-spin mx-auto mb-4 text-primary" />
            <p className="text-muted-foreground">Loading products...</p>
          </div>
        </CardContent>
      </Card>
    );
  }

  if (error) {
    return (
      <Card className="max-w-4xl mx-auto">
        <CardContent className="text-center py-12">
          <Package className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
          <h3 className="text-lg font-semibold mb-2">Unable to Load Products</h3>
          <p className="text-muted-foreground mb-4">{error}</p>
          <Button onClick={fetchProducts}>Try Again</Button>
        </CardContent>
      </Card>
    );
  }

  // Get product counts per category
  const categoryProductCounts = categories.reduce((acc, category) => {
    acc[category.name] = products.filter(p => p.category === category.name).length;
    return acc;
  }, {} as Record<string, number>);
  
  const allProductsCount = products.length;

  return (
    <div className="w-full px-4 py-4">
      {/* Category filters - Compact Pills */}
      {categories.length > 0 && (
        <div className="mb-4">
          <div className="flex flex-wrap gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setSelectedCategory('')}
              className={`rounded-full h-8 px-3 sm:px-4 text-xs sm:text-sm font-medium transition-all ${
                selectedCategory === '' 
                  ? 'bg-accent text-accent-foreground border-accent hover:bg-accent/90' 
                  : 'bg-background text-foreground border-input hover:bg-accent/10 hover:text-accent-foreground'
              }`}
            >
              <span className="hidden sm:inline">All Categories</span>
              <span className="sm:hidden">All</span>
              <span className="ml-1">({allProductsCount})</span>
            </Button>
            {categories.map((category) => (
              <Button
                key={category.id}
                variant="outline"
                size="sm"
                onClick={() => setSelectedCategory(category.name)}
                className={`rounded-full h-8 px-3 sm:px-4 text-xs sm:text-sm font-medium transition-all ${
                  selectedCategory === category.name 
                    ? 'bg-accent text-accent-foreground border-accent hover:bg-accent/90' 
                    : 'bg-background text-foreground border-input hover:bg-accent/10 hover:text-accent-foreground'
                }`}
              >
                <span className="truncate max-w-[120px]">{category.name}</span>
                <span className="ml-1">({categoryProductCounts[category.name] || 0})</span>
              </Button>
            ))}
          </div>
        </div>
      )}

      {/* Products grid - Scrollable */}
      <div className="max-h-[calc(100vh-16rem)] overflow-y-auto pr-2 -mr-2">
        {filteredProducts.length === 0 ? (
          <div className="text-center py-12">
            <Package className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
            <h3 className="text-lg font-semibold mb-2">No Products Available</h3>
            <p className="text-muted-foreground">
              {selectedCategory 
                ? `No products found in the "${selectedCategory}" category.`
                : 'No products are currently available for quoting.'
              }
            </p>
            {selectedCategory && (
              <Button
                variant="outline"
                onClick={() => setSelectedCategory('')}
                className="mt-4"
              >
                View All Products
              </Button>
            )}
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-6 gap-4 pb-4">
          {filteredProducts.map((product) => (
            <Card 
              key={product.id}
              className="group cursor-pointer hover:shadow-xl transition-all duration-300 border-2 hover:border-primary/20 hover:scale-[1.02] rounded-xl overflow-hidden"
              onClick={() => onProductSelect(product.id)}
            >
              {product.photo_url && (
                <div className="relative overflow-hidden bg-muted h-48">
                  <img
                    src={product.photo_url}
                    alt={product.name}
                    className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-300"
                    onError={(e) => {
                      e.currentTarget.style.display = 'none';
                    }}
                  />
                </div>
              )}
              
              <CardContent className="p-5">
                <div className="flex items-start gap-2 mb-3">
                  <div 
                    className="w-2.5 h-2.5 rounded-full flex-shrink-0 mt-1.5"
                    style={{ backgroundColor: product.color_hex }}
                  />
                  <div className="flex-1 min-w-0">
                    <h3 className="font-semibold text-base leading-tight mb-1">
                      {product.name}
                    </h3>
                  </div>
                </div>

                {product.description && (
                  <p className="text-sm text-muted-foreground mb-4 line-clamp-2">
                    {product.description}
                  </p>
                )}

                <div className="flex items-center justify-between mb-3">
                  {shouldShowPricing(product) && (
                    <span className="text-lg font-bold text-primary">
                      {formatExactPrice(product.unit_price, {
                        currency_symbol: settings.currency_symbol,
                        decimal_precision: settings.decimal_precision
                      })}
                      <span className="text-sm font-normal text-muted-foreground ml-1">
                        / {product.unit_type}
                      </span>
                    </span>
                  )}
                </div>

                {/* Badges at bottom */}
                <div className="flex flex-wrap gap-1.5">
                  {product.category && (
                    <Badge variant="outline" className="text-xs bg-muted/50">
                      {product.category}
                    </Badge>
                  )}
                  {product.subcategory && (
                    <Badge variant="outline" className="text-xs bg-muted/50">
                      {product.subcategory}
                    </Badge>
                  )}
                </div>
              </CardContent>
            </Card>
          ))}
          </div>
        )}
      </div>
    </div>
  );
};

export default ProductSelector;