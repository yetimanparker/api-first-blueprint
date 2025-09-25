import React, { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Search, Package, ArrowRight, CheckCircle } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useToast } from '@/hooks/use-toast';

interface Product {
  id: string;
  name: string;
  description?: string;
  unit_type: string;
  unit_price: number;
  color_hex: string;
  category?: string;
  subcategory?: string;
  photo_url?: string;
  is_active: boolean;
  show_pricing_before_submit: boolean;
}

interface ProductSelectorProps {
  contractorId: string;
  onProductSelect: (product: Product) => void;
  onFinishQuote?: () => void;
}

export const ProductSelector: React.FC<ProductSelectorProps> = ({
  contractorId,
  onProductSelect,
  onFinishQuote
}) => {
  const [products, setProducts] = useState<Product[]>([]);
  const [categories, setCategories] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedCategory, setSelectedCategory] = useState<string>('');
  const [searchTerm, setSearchTerm] = useState('');
  const { toast } = useToast();

  useEffect(() => {
    loadProducts();
  }, [contractorId]);

  const loadProducts = async () => {
    try {
      setLoading(true);
      
      // Get contractor's products
      const { data: productsData, error: productsError } = await supabase
        .from('products')
        .select('*')
        .eq('contractor_id', contractorId)
        .eq('is_active', true)
        .order('display_order', { ascending: true })
        .order('name', { ascending: true });

      if (productsError) throw productsError;

      setProducts(productsData || []);

      // Extract unique categories
      const uniqueCategories = [...new Set(
        (productsData || [])
          .map(p => p.category)
          .filter(Boolean)
      )] as string[];
      
      setCategories(uniqueCategories);
    } catch (error) {
      console.error('Error loading products:', error);
      toast({
        title: "Error Loading Products",
        description: "Unable to load product catalog. Please try again.",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const filteredProducts = products.filter(product => {
    const matchesCategory = !selectedCategory || product.category === selectedCategory;
    const matchesSearch = !searchTerm || 
      product.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      product.description?.toLowerCase().includes(searchTerm.toLowerCase());
    
    return matchesCategory && matchesSearch;
  });

  if (loading) {
    return (
      <div className="space-y-4">
        {[...Array(3)].map((_, i) => (
          <div key={i} className="h-24 bg-muted animate-pulse rounded-lg" />
        ))}
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Search and Filter */}
      <div className="space-y-3">
        <div>
          <Label htmlFor="search">Search Products</Label>
          <div className="relative mt-1">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              id="search"
              type="text"
              placeholder="Search products..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-10"
            />
          </div>
        </div>

        {categories.length > 0 && (
          <div>
            <Label>Categories</Label>
            <div className="flex flex-wrap gap-2 mt-1">
              <Button
                variant={selectedCategory === '' ? 'default' : 'outline'}
                size="sm"
                onClick={() => setSelectedCategory('')}
              >
                All
              </Button>
              {categories.map(category => (
                <Button
                  key={category}
                  variant={selectedCategory === category ? 'default' : 'outline'}
                  size="sm"
                  onClick={() => setSelectedCategory(category)}
                >
                  {category}
                </Button>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Products Grid */}
      {filteredProducts.length === 0 ? (
        <div className="text-center py-8">
          <Package className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
          <h3 className="text-lg font-semibold text-muted-foreground mb-2">
            No Products Found
          </h3>
          <p className="text-muted-foreground">
            {searchTerm || selectedCategory 
              ? 'Try adjusting your search or filter criteria.'
              : 'No products are currently available.'
            }
          </p>
        </div>
      ) : (
        <div className="grid gap-3">
          {filteredProducts.map(product => (
            <Card
              key={product.id}
              className={cn(
                "p-4 cursor-pointer transition-all hover:shadow-md border-2",
                "hover:border-primary/50"
              )}
              onClick={() => onProductSelect(product)}
            >
              <div className="flex items-center justify-between">
                <div className="flex-1">
                  <div className="flex items-center gap-3">
                    {/* Product Color Indicator */}
                    <div 
                      className="w-4 h-4 rounded-full border-2 border-border"
                      style={{ backgroundColor: product.color_hex }}
                    />
                    
                    <div className="flex-1">
                      <h3 className="font-semibold text-foreground">
                        {product.name}
                      </h3>
                      
                      {product.description && (
                        <p className="text-sm text-muted-foreground mt-1">
                          {product.description}
                        </p>
                      )}
                      
                      <div className="flex items-center gap-2 mt-2">
                        <Badge variant="secondary" className="text-xs">
                          {product.unit_type.replace('_', ' ')}
                        </Badge>
                        
                        {product.category && (
                          <Badge variant="outline" className="text-xs">
                            {product.category}
                          </Badge>
                        )}
                      </div>
                    </div>
                  </div>
                </div>

                <div className="text-right ml-4">
                  {product.show_pricing_before_submit && (
                    <div className="text-lg font-semibold text-primary">
                      ${product.unit_price.toFixed(2)}
                      <span className="text-sm text-muted-foreground font-normal">
                        /{product.unit_type.replace('_', ' ')}
                      </span>
                    </div>
                  )}
                  
                  <ArrowRight className="h-4 w-4 text-muted-foreground mt-1 ml-auto" />
                </div>
              </div>
            </Card>
          ))}
        </div>
      )}

      {/* Finish Quote Button */}
      {onFinishQuote && (
        <div className="border-t pt-4 mt-6">
          <div className="text-center">
            <p className="text-sm text-muted-foreground mb-3">
              Done adding products to your quote?
            </p>
            <Button 
              onClick={onFinishQuote}
              variant="outline"
              className="w-full"
            >
              <CheckCircle className="h-4 w-4 mr-2" />
              Finish Quote
            </Button>
          </div>
        </div>
      )}
    </div>
  );
};