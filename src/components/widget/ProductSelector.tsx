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

  return (
    <Card className="max-w-4xl mx-auto">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Package className="h-5 w-5 text-primary" />
          Select a Product
        </CardTitle>
        <p className="text-sm text-muted-foreground">
          Choose the product or service you'd like to get a quote for
        </p>
      </CardHeader>
      
      <CardContent className="space-y-6">
        {/* Category filters */}
        {categories.length > 0 && (
          <div className="space-y-2">
            <Label className="text-sm font-medium">Categories</Label>
            <div className="flex flex-wrap gap-2">
              <Button
                variant={selectedCategory === '' ? 'default' : 'outline'}
                size="sm"
                onClick={() => setSelectedCategory('')}
                className="h-8"
              >
                All Products
              </Button>
              {categories.map((category) => (
                <Button
                  key={category.id}
                  variant={selectedCategory === category.name ? 'default' : 'outline'}
                  size="sm"
                  onClick={() => setSelectedCategory(category.name)}
                  className="h-8"
                  style={{
                    backgroundColor: selectedCategory === category.name 
                      ? category.color_hex 
                      : undefined,
                    borderColor: category.color_hex,
                    color: selectedCategory === category.name ? 'white' : category.color_hex
                  }}
                >
                  {category.name}
                </Button>
              ))}
            </div>
          </div>
        )}

        {/* Products grid */}
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
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {filteredProducts.map((product) => (
              <Card 
                key={product.id}
                className="cursor-pointer hover:shadow-md transition-shadow border-2 hover:border-primary/20"
                onClick={() => onProductSelect(product.id)}
              >
                <CardContent className="p-4">
                  {product.photo_url && (
                    <div className="mb-3 rounded-lg overflow-hidden bg-muted">
                      <img
                        src={product.photo_url}
                        alt={product.name}
                        className="w-full h-32 object-cover"
                        onError={(e) => {
                          e.currentTarget.style.display = 'none';
                        }}
                      />
                    </div>
                  )}
                  
                  <div className="flex items-start gap-2 mb-2">
                    <div 
                      className="w-3 h-3 rounded-full flex-shrink-0 mt-1"
                      style={{ backgroundColor: product.color_hex }}
                    />
                    <div className="flex-1 min-w-0">
                      <h3 className="font-semibold text-sm leading-tight truncate">
                        {product.name}
                      </h3>
                    </div>
                  </div>

                  {product.description && (
                    <p className="text-xs text-muted-foreground mb-3 line-clamp-2">
                      {product.description}
                    </p>
                  )}

                  <div className="flex items-center justify-between">
                    <Badge variant="secondary" className="text-xs">
                      Per {product.unit_type}
                    </Badge>
                    
                    {shouldShowPricing(product) && (
                      <span className="text-sm font-semibold text-primary">
                        {formatExactPrice(product.unit_price, {
                          currency_symbol: settings.currency_symbol,
                          decimal_precision: settings.decimal_precision
                        })}
                      </span>
                    )}
                  </div>

                  {product.category && (
                    <div className="mt-2">
                      <Badge variant="outline" className="text-xs">
                        {product.category}
                        {product.subcategory && ` • ${product.subcategory}`}
                      </Badge>
                    </div>
                  )}
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
};

export default ProductSelector;