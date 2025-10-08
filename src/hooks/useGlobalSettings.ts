import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { PriceRangeSettings } from '@/lib/priceUtils';

export interface GlobalSettings extends PriceRangeSettings {
  default_unit_type: 'sq_ft' | 'linear_ft' | 'each' | 'hour' | 'cubic_yard' | 'pound' | 'ton' | 'pallet';
  default_product_color: string;
  auto_activate_products: boolean;
  require_product_photos: boolean;
  global_tax_rate: number;
  global_markup_percentage: number;
  require_email: boolean;
  require_phone: boolean;
  require_address: boolean;
  service_area_enabled: boolean;
  widget_theme_color: string;
  contact_capture_timing: 'before_quote' | 'after_quote' | 'on_submit';
  pricing_visibility: 'before_submit' | 'after_submit';
}

export function useGlobalSettings() {
  const [settings, setSettings] = useState<GlobalSettings | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    loadSettings();
  }, []);

  const loadSettings = async () => {
    try {
      setLoading(true);
      setError(null);

      // Get contractor ID first
      const { data: contractor } = await supabase
        .from('contractors')
        .select('id')
        .maybeSingle();

      if (!contractor) {
        // Use default settings if no contractor profile
        setSettings({
          use_price_ranges: false,
          price_range_lower_percentage: 10,
          price_range_upper_percentage: 20,
          price_range_display_format: 'percentage',
          currency_symbol: '$',
          decimal_precision: 2,
          default_unit_type: 'sq_ft',
          default_product_color: '#3B82F6',
          auto_activate_products: true,
          require_product_photos: false,
          global_tax_rate: 0,
          global_markup_percentage: 0,
          require_email: true,
          require_phone: true,
          require_address: true,
          service_area_enabled: false,
          widget_theme_color: '#3B82F6',
          contact_capture_timing: 'before_quote',
          pricing_visibility: 'before_submit',
        });
        return;
      }

      // Load settings for the contractor
      const { data: contractorSettings, error: settingsError } = await supabase
        .from('contractor_settings')
        .select('*')
        .eq('contractor_id', contractor.id)
        .maybeSingle();

      if (settingsError && settingsError.code !== 'PGRST116') {
        throw settingsError;
      }

      if (contractorSettings) {
        setSettings({
          use_price_ranges: contractorSettings.use_price_ranges || false,
          price_range_lower_percentage: contractorSettings.price_range_lower_percentage ?? 10,
          price_range_upper_percentage: contractorSettings.price_range_upper_percentage ?? 20,
          price_range_display_format: (contractorSettings.price_range_display_format as any) || 'percentage',
          currency_symbol: contractorSettings.currency_symbol || '$',
          decimal_precision: contractorSettings.decimal_precision ?? 2,
          default_unit_type: (contractorSettings.default_unit_type as any) || 'sq_ft',
          default_product_color: contractorSettings.default_product_color || '#3B82F6',
          auto_activate_products: contractorSettings.auto_activate_products ?? true,
          require_product_photos: contractorSettings.require_product_photos || false,
          global_tax_rate: contractorSettings.global_tax_rate || 0,
          global_markup_percentage: contractorSettings.global_markup_percentage || 0,
          require_email: contractorSettings.require_email ?? true,
          require_phone: contractorSettings.require_phone ?? true,
          require_address: contractorSettings.require_address ?? true,
          service_area_enabled: contractorSettings.service_area_enabled || false,
          widget_theme_color: contractorSettings.widget_theme_color || '#3B82F6',
          contact_capture_timing: (contractorSettings.contact_capture_timing as any) || 'before_quote',
          pricing_visibility: (contractorSettings.pricing_visibility as any) || 'before_submit',
        });
      } else {
        // Use default settings if no settings found
        setSettings({
          use_price_ranges: false,
          price_range_lower_percentage: 10,
          price_range_upper_percentage: 20,
          price_range_display_format: 'percentage',
          currency_symbol: '$',
          decimal_precision: 2,
          default_unit_type: 'sq_ft',  
          default_product_color: '#3B82F6',
          auto_activate_products: true,
          require_product_photos: false,
          global_tax_rate: 0,
          global_markup_percentage: 0,
          require_email: true,
          require_phone: true,
          require_address: true,
          service_area_enabled: false,
          widget_theme_color: '#3B82F6',
          contact_capture_timing: 'before_quote',
          pricing_visibility: 'before_submit',
        });
      }
    } catch (err: any) {
      setError(err.message);
      console.error('Error loading global settings:', err);
    } finally {
      setLoading(false);
    }
  };

  return { settings, loading, error, refetch: loadSettings };
}

export function useProductCategories(contractorId?: string) {
  const [categories, setCategories] = useState<Array<{ id: string; name: string; color_hex: string }>>([]);
  const [subcategories, setSubcategories] = useState<Array<{ id: string; category_id: string; name: string }>>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (contractorId) {
      loadCategories();
    }
  }, [contractorId]);

  const loadCategories = async () => {
    try {
      setLoading(true);
      setError(null);

      if (!contractorId) {
        console.error('No contractor ID provided to useProductCategories');
        setCategories([]);
        setSubcategories([]);
        setLoading(false);
        return;
      }

      console.log('Loading categories for contractor:', contractorId);

      // Load categories for this contractor
      const { data: categoriesData, error: categoriesError } = await supabase
        .from('product_categories')
        .select('id, name, color_hex')
        .eq('contractor_id', contractorId)
        .eq('is_active', true)
        .order('display_order');

      if (categoriesError) {
        console.error('Categories error:', categoriesError);
        throw categoriesError;
      }

      console.log('Loaded categories:', categoriesData);

      // Load subcategories - filtered by the category IDs we just loaded
      const categoryIds = (categoriesData || []).map(c => c.id);
      let subcategoriesData = [];
      
      if (categoryIds.length > 0) {
        const { data, error: subcategoriesError } = await supabase
          .from('product_subcategories')
          .select('id, category_id, name')
          .in('category_id', categoryIds)
          .eq('is_active', true)
          .order('display_order');

        if (subcategoriesError) {
          console.error('Subcategories error:', subcategoriesError);
          throw subcategoriesError;
        }
        
        subcategoriesData = data || [];
      }

      console.log('Loaded subcategories:', subcategoriesData);

      setCategories(categoriesData || []);
      setSubcategories(subcategoriesData || []);
    } catch (err: any) {
      setError(err.message);
      console.error('Error loading categories:', err);
      
      // Fallback to default categories if database loading fails
      setCategories([
        { id: 'fencing', name: 'Fencing', color_hex: '#10B981' },
        { id: 'flooring', name: 'Flooring', color_hex: '#3B82F6' },
        { id: 'roofing', name: 'Roofing', color_hex: '#EF4444' },
        { id: 'siding', name: 'Siding', color_hex: '#F59E0B' },
        { id: 'landscaping', name: 'Landscaping', color_hex: '#22C55E' },
        { id: 'painting', name: 'Painting', color_hex: '#8B5CF6' },
        { id: 'electrical', name: 'Electrical', color_hex: '#F97316' },
        { id: 'plumbing', name: 'Plumbing', color_hex: '#06B6D4' },
        { id: 'hvac', name: 'HVAC', color_hex: '#84CC16' },
        { id: 'general', name: 'General Contracting', color_hex: '#6B7280' },
      ]);
      setSubcategories([]);
    } finally {
      setLoading(false);
    }
  };

  const getSubcategoriesForCategory = (categoryId: string) => {
    return subcategories.filter(sub => sub.category_id === categoryId);
  };

  return { 
    categories, 
    subcategories, 
    loading, 
    error, 
    refetch: loadCategories,
    getSubcategoriesForCategory 
  };
}
