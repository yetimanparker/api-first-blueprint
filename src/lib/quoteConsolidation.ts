import { QuoteItem } from '@/types/widget';

export interface ConsolidatedAddon {
  id: string;
  name: string;
  priceValue: number;
  priceType?: 'fixed' | 'percentage'; // Whether price is fixed or percentage of product total
  calculationType: string;
  quantity: number;
  selectedOption?: string;
  selectedOptionPriceAdjustment?: number; // Price adjustment from selected option
  instances: Array<{
    parentItemId: string;
    addonData: any;
  }>;
}

export interface ConsolidatedMapAddon {
  productId: string;
  productName: string;
  unitPrice: number;
  unitType: string;
  totalQuantity: number;
  totalLineTotal: number;
  mapColor: string;
  items: QuoteItem[];
}

export interface ConsolidatedMainProduct {
  productId: string;
  productName: string;
  unitType: string;
  unitPrice: number;
  instances: QuoteItem[];
  totalQuantity: number;
  totalLineTotal: number;
  variations: any[];
  traditionalAddons: ConsolidatedAddon[];
  mapPlacedAddons: ConsolidatedMapAddon[];
  color: string;
}

export interface ConsolidatedQuoteData {
  consolidatedMainProducts: ConsolidatedMainProduct[];
}

/**
 * Consolidates quote items for display by grouping:
 * - Main products by product_id + variations
 * - Map-placed add-ons (child items) by parent + product_id
 * - Traditional add-ons by addon_id + selected_option
 */
export function consolidateQuoteItems(items: QuoteItem[]): ConsolidatedQuoteData {
  // Separate parent and child items
  const parentItems = items.filter(item => !item.parentQuoteItemId);
  const childItems = items.filter(item => item.parentQuoteItemId);
  
  // Group main products by product_id and variation signature
  const productGroups = new Map<string, ConsolidatedMainProduct>();
  
  parentItems.forEach(item => {
    // Create variation signature for grouping
    const variationSig = JSON.stringify(
      (item.measurement?.variations || [])
        .map(v => ({ id: v.id, name: v.name }))
        .sort((a, b) => a.id.localeCompare(b.id))
    );
    const groupKey = `${item.productId}-${variationSig}`;
    
    let group = productGroups.get(groupKey);
    
    if (!group) {
      // Create new group
      group = {
        productId: item.productId,
        productName: item.productName,
        unitType: item.unitType,
        unitPrice: item.unitPrice,
        instances: [item],
        totalQuantity: item.quantity,
        totalLineTotal: item.lineTotal,
        variations: item.measurement?.variations || [],
        traditionalAddons: [],
        mapPlacedAddons: [],
        color: item.measurement?.mapColor || '#3B82F6'
      };
      productGroups.set(groupKey, group);
    } else {
      // Add to existing group
      group.instances.push(item);
      group.totalQuantity += item.quantity;
      group.totalLineTotal += item.lineTotal;
    }
  });
  
  // Process traditional add-ons and map-placed add-ons for each consolidated product
  productGroups.forEach(product => {
    // Consolidate traditional add-ons across all instances
    const addonMap = new Map<string, ConsolidatedAddon>();
    
    product.instances.forEach(instance => {
      const addons = instance.measurement?.addons || [];
      
      addons.forEach((addon: any) => {
        const addonId = addon.id || addon.addon_id || '';
        const selectedOption = addon.selectedOption?.name || addon.selected_option?.name || '';
        const addonKey = `${addonId}-${selectedOption}`;
        
        let consolidatedAddon = addonMap.get(addonKey);
        
        if (!consolidatedAddon) {
          consolidatedAddon = {
            id: addonId,
            name: addon.name || addon.addon_name || '',
            priceValue: addon.priceValue || addon.addon_price || 0,
            priceType: addon.priceType || addon.price_type || 'fixed',
            calculationType: addon.calculationType || addon.calculation_type || 'total',
            quantity: addon.quantity || 0,
            selectedOption: addon.selectedOptionName || selectedOption,
            selectedOptionPriceAdjustment: addon.selectedOptionPriceAdjustment || 0,
            instances: []
          };
          addonMap.set(addonKey, consolidatedAddon);
        }
        
        consolidatedAddon.instances.push({
          parentItemId: instance.id,
          addonData: addon
        });
      });
    });
    
    product.traditionalAddons = Array.from(addonMap.values())
      .filter(addon => addon.quantity > 0);
    
    // Consolidate map-placed add-ons (child items)
    const mapAddonMap = new Map<string, ConsolidatedMapAddon>();
    
    product.instances.forEach(instance => {
      const children = childItems.filter(child => child.parentQuoteItemId === instance.id);
      
      children.forEach(child => {
        let mapAddon = mapAddonMap.get(child.productId);
        
        if (!mapAddon) {
          mapAddon = {
            productId: child.productId,
            productName: child.productName,
            unitPrice: child.unitPrice,
            unitType: child.unitType,
            totalQuantity: child.quantity,
            totalLineTotal: child.lineTotal,
            mapColor: child.measurement?.mapColor || '#F59E0B',
            items: [child]
          };
          mapAddonMap.set(child.productId, mapAddon);
        } else {
          mapAddon.totalQuantity += child.quantity;
          mapAddon.totalLineTotal += child.lineTotal;
          mapAddon.items.push(child);
        }
      });
    });
    
    product.mapPlacedAddons = Array.from(mapAddonMap.values());
  });
  
  return {
    consolidatedMainProducts: Array.from(productGroups.values())
  };
}
