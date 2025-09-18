import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import { Plus, Edit2, Trash2, Tag, Palette } from "lucide-react";
import { Switch } from "@/components/ui/switch";

interface Category {
  id: string;
  name: string;
  color_hex: string;
  display_order: number;
  is_active: boolean;
}

interface Subcategory {
  id: string;
  category_id: string;
  name: string;
  display_order: number;
  is_active: boolean;
}

export function CategoryManagement() {
  const [categories, setCategories] = useState<Category[]>([]);
  const [subcategories, setSubcategories] = useState<Subcategory[]>([]);
  const [loading, setLoading] = useState(true);
  const [editingCategory, setEditingCategory] = useState<Category | null>(null);
  const [editingSubcategory, setEditingSubcategory] = useState<Subcategory | null>(null);
  const [selectedCategoryId, setSelectedCategoryId] = useState<string>("");
  const { toast } = useToast();

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      setLoading(true);
      
      const [categoriesRes, subcategoriesRes] = await Promise.all([
        supabase.from("product_categories").select("*").order("display_order"),
        supabase.from("product_subcategories").select("*").order("display_order")
      ]);

      if (categoriesRes.error) throw categoriesRes.error;
      if (subcategoriesRes.error) throw subcategoriesRes.error;

      setCategories(categoriesRes.data || []);
      setSubcategories(subcategoriesRes.data || []);
    } catch (error: any) {
      toast({
        title: "Error",
        description: "Failed to load categories",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const saveCategory = async (categoryData: Omit<Category, 'id'> & { id?: string }) => {
    try {
      // Get current contractor ID
      const { data: contractorData, error: contractorError } = await supabase
        .from("contractors")
        .select("id")
        .maybeSingle();

      if (contractorError) throw contractorError;

      if (!contractorData) {
        throw new Error("Please set up your contractor profile first by going to Settings");
      }

      const dataToSave = {
        ...categoryData,
        contractor_id: contractorData.id,
      };

      if (categoryData.id) {
        const { error } = await supabase
          .from("product_categories")
          .update(dataToSave)
          .eq("id", categoryData.id);
        if (error) throw error;
      } else {
        const { error } = await supabase
          .from("product_categories")
          .insert(dataToSave);
        if (error) throw error;
      }

      toast({
        title: "Success",
        description: `Category ${categoryData.id ? 'updated' : 'created'} successfully`,
      });
      
      setEditingCategory(null);
      fetchData();
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    }
  };

  const saveSubcategory = async (subcategoryData: Omit<Subcategory, 'id'> & { id?: string }) => {
    try {
      if (subcategoryData.id) {
        const { error } = await supabase
          .from("product_subcategories")
          .update(subcategoryData)
          .eq("id", subcategoryData.id);
        if (error) throw error;
      } else {
        const { error } = await supabase
          .from("product_subcategories")
          .insert(subcategoryData);
        if (error) throw error;
      }

      toast({
        title: "Success",
        description: `Subcategory ${subcategoryData.id ? 'updated' : 'created'} successfully`,
      });
      
      setEditingSubcategory(null);
      fetchData();
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    }
  };

  const deleteCategory = async (categoryId: string) => {
    try {
      // Check if any products use this category
      const { data: products, error: productError } = await supabase
        .from("products")
        .select("id")
        .eq("category", categoryId)
        .limit(1);

      if (productError) throw productError;

      if (products && products.length > 0) {
        toast({
          title: "Cannot Delete",
          description: "This category is being used by products. Please reassign or delete those products first.",
          variant: "destructive",
        });
        return;
      }

      const { error } = await supabase
        .from("product_categories")
        .delete()
        .eq("id", categoryId);

      if (error) throw error;

      toast({
        title: "Success",
        description: "Category deleted successfully",
      });
      
      fetchData();
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    }
  };

  const deleteSubcategory = async (subcategoryId: string) => {
    try {
      // Check if any products use this subcategory
      const { data: products, error: productError } = await supabase
        .from("products")
        .select("id")
        .eq("subcategory", subcategoryId)
        .limit(1);

      if (productError) throw productError;

      if (products && products.length > 0) {
        toast({
          title: "Cannot Delete",
          description: "This subcategory is being used by products. Please reassign or delete those products first.",
          variant: "destructive",
        });
        return;
      }

      const { error } = await supabase
        .from("product_subcategories")
        .delete()
        .eq("id", subcategoryId);

      if (error) throw error;

      toast({
        title: "Success",
        description: "Subcategory deleted successfully",
      });
      
      fetchData();
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    }
  };

  if (loading) {
    return <div className="text-center py-8">Loading categories...</div>;
  }

  return (
    <div className="space-y-6">
      {/* Categories Section */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="flex items-center gap-2">
              <Tag className="h-5 w-5" />
              Categories
            </CardTitle>
            <Dialog>
              <DialogTrigger asChild>
                <Button onClick={() => setEditingCategory({ id: '', name: '', color_hex: '#3B82F6', display_order: categories.length, is_active: true })}>
                  <Plus className="h-4 w-4 mr-2" />
                  Add Category
                </Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>Add New Category</DialogTitle>
                </DialogHeader>
                <CategoryForm 
                  category={editingCategory} 
                  onSave={saveCategory}
                  onCancel={() => setEditingCategory(null)}
                />
              </DialogContent>
            </Dialog>
          </div>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {categories.map((category) => (
              <div key={category.id} className="border rounded-lg p-4 space-y-2">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <div 
                      className="w-4 h-4 rounded-full" 
                      style={{ backgroundColor: category.color_hex }}
                    />
                    <span className="font-medium">{category.name}</span>
                  </div>
                  <Badge variant={category.is_active ? "default" : "secondary"}>
                    {category.is_active ? "Active" : "Inactive"}
                  </Badge>
                </div>
                <div className="text-sm text-muted-foreground">
                  Order: {category.display_order}
                </div>
                <div className="flex gap-2">
                  <Dialog>
                    <DialogTrigger asChild>
                      <Button 
                        variant="outline" 
                        size="sm"
                        onClick={() => setEditingCategory(category)}
                      >
                        <Edit2 className="h-3 w-3" />
                      </Button>
                    </DialogTrigger>
                    <DialogContent>
                      <DialogHeader>
                        <DialogTitle>Edit Category</DialogTitle>
                      </DialogHeader>
                      <CategoryForm 
                        category={editingCategory} 
                        onSave={saveCategory}
                        onCancel={() => setEditingCategory(null)}
                      />
                    </DialogContent>
                  </Dialog>
                  <Button 
                    variant="outline" 
                    size="sm"
                    onClick={() => deleteCategory(category.id)}
                  >
                    <Trash2 className="h-3 w-3" />
                  </Button>
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Subcategories Section */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle>Subcategories</CardTitle>
            <Dialog>
              <DialogTrigger asChild>
                <Button 
                  onClick={() => setEditingSubcategory({ 
                    id: '', 
                    category_id: '', 
                    name: '', 
                    display_order: subcategories.length, 
                    is_active: true 
                  })}
                  disabled={categories.length === 0}
                >
                  <Plus className="h-4 w-4 mr-2" />
                  Add Subcategory
                </Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>Add New Subcategory</DialogTitle>
                </DialogHeader>
                <SubcategoryForm 
                  subcategory={editingSubcategory} 
                  categories={categories}
                  onSave={saveSubcategory}
                  onCancel={() => setEditingSubcategory(null)}
                />
              </DialogContent>
            </Dialog>
          </div>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {categories.map((category) => {
              const categorySubcategories = subcategories.filter(sub => sub.category_id === category.id);
              
              if (categorySubcategories.length === 0) return null;

              return (
                <div key={category.id} className="border rounded-lg p-4">
                  <h4 className="font-medium mb-3 flex items-center gap-2">
                    <div 
                      className="w-3 h-3 rounded-full" 
                      style={{ backgroundColor: category.color_hex }}
                    />
                    {category.name}
                  </h4>
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-2">
                    {categorySubcategories.map((subcategory) => (
                      <div key={subcategory.id} className="flex items-center justify-between bg-muted p-2 rounded">
                        <span className="text-sm">{subcategory.name}</span>
                        <div className="flex gap-1">
                          <Badge variant={subcategory.is_active ? "default" : "secondary"} className="text-xs">
                            {subcategory.is_active ? "Active" : "Inactive"}
                          </Badge>
                          <Dialog>
                            <DialogTrigger asChild>
                              <Button 
                                variant="ghost" 
                                size="sm"
                                onClick={() => setEditingSubcategory(subcategory)}
                              >
                                <Edit2 className="h-3 w-3" />
                              </Button>
                            </DialogTrigger>
                            <DialogContent>
                              <DialogHeader>
                                <DialogTitle>Edit Subcategory</DialogTitle>
                              </DialogHeader>
                              <SubcategoryForm 
                                subcategory={editingSubcategory} 
                                categories={categories}
                                onSave={saveSubcategory}
                                onCancel={() => setEditingSubcategory(null)}
                              />
                            </DialogContent>
                          </Dialog>
                          <Button 
                            variant="ghost" 
                            size="sm"
                            onClick={() => deleteSubcategory(subcategory.id)}
                          >
                            <Trash2 className="h-3 w-3" />
                          </Button>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

function CategoryForm({ 
  category, 
  onSave, 
  onCancel 
}: { 
  category: Category | null; 
  onSave: (data: any) => void; 
  onCancel: () => void; 
}) {
  const [formData, setFormData] = useState({
    name: category?.name || '',
    color_hex: category?.color_hex || '#3B82F6',
    display_order: category?.display_order || 0,
    is_active: category?.is_active ?? true,
  });

  return (
    <div className="space-y-4">
      <div>
        <Label htmlFor="name">Name</Label>
        <Input
          id="name"
          value={formData.name}
          onChange={(e) => setFormData({ ...formData, name: e.target.value })}
          placeholder="Category name"
        />
      </div>
      
      <div>
        <Label htmlFor="color">Color</Label>
        <div className="flex gap-2">
          <Input
            id="color"
            type="color"
            value={formData.color_hex}
            onChange={(e) => setFormData({ ...formData, color_hex: e.target.value })}
            className="w-20"
          />
          <Input
            value={formData.color_hex}
            onChange={(e) => setFormData({ ...formData, color_hex: e.target.value })}
            placeholder="#3B82F6"
          />
        </div>
      </div>

      <div>
        <Label htmlFor="order">Display Order</Label>
        <Input
          id="order"
          type="number"
          value={formData.display_order}
          onChange={(e) => setFormData({ ...formData, display_order: parseInt(e.target.value) || 0 })}
        />
      </div>

      <div className="flex items-center space-x-2">
        <Switch
          id="active"
          checked={formData.is_active}
          onCheckedChange={(checked) => setFormData({ ...formData, is_active: checked })}
        />
        <Label htmlFor="active">Active</Label>
      </div>

      <div className="flex gap-2">
        <Button onClick={onCancel} variant="outline">Cancel</Button>
        <Button 
          onClick={() => onSave({ ...category, ...formData })}
          disabled={!formData.name.trim()}
        >
          Save
        </Button>
      </div>
    </div>
  );
}

function SubcategoryForm({ 
  subcategory, 
  categories,
  onSave, 
  onCancel 
}: { 
  subcategory: Subcategory | null; 
  categories: Category[];
  onSave: (data: any) => void; 
  onCancel: () => void; 
}) {
  const [formData, setFormData] = useState({
    name: subcategory?.name || '',
    category_id: subcategory?.category_id || '',
    display_order: subcategory?.display_order || 0,
    is_active: subcategory?.is_active ?? true,
  });

  return (
    <div className="space-y-4">
      <div>
        <Label htmlFor="name">Name</Label>
        <Input
          id="name"
          value={formData.name}
          onChange={(e) => setFormData({ ...formData, name: e.target.value })}
          placeholder="Subcategory name"
        />
      </div>
      
      <div>
        <Label htmlFor="category">Category</Label>
        <select
          id="category"
          value={formData.category_id}
          onChange={(e) => setFormData({ ...formData, category_id: e.target.value })}
          className="w-full p-2 border rounded"
        >
          <option value="">Select a category</option>
          {categories.filter(cat => cat.is_active).map((category) => (
            <option key={category.id} value={category.id}>
              {category.name}
            </option>
          ))}
        </select>
      </div>

      <div>
        <Label htmlFor="order">Display Order</Label>
        <Input
          id="order"
          type="number"
          value={formData.display_order}
          onChange={(e) => setFormData({ ...formData, display_order: parseInt(e.target.value) || 0 })}
        />
      </div>

      <div className="flex items-center space-x-2">
        <Switch
          id="active"
          checked={formData.is_active}
          onCheckedChange={(checked) => setFormData({ ...formData, is_active: checked })}
        />
        <Label htmlFor="active">Active</Label>
      </div>

      <div className="flex gap-2">
        <Button onClick={onCancel} variant="outline">Cancel</Button>
        <Button 
          onClick={() => onSave({ ...subcategory, ...formData })}
          disabled={!formData.name.trim() || !formData.category_id}
        >
          Save
        </Button>
      </div>
    </div>
  );
}