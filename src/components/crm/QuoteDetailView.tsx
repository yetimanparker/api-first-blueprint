import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Separator } from '@/components/ui/separator';
import { MapPin, Calculator } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Loader } from '@googlemaps/js-api-loader';
import { formatExactPrice, calculatePriceRange, formatPriceRange, displayQuoteTotal, displayLineItemPrice } from '@/lib/priceUtils';
import { GlobalSettings } from '@/hooks/useGlobalSettings';
import { getZoomBasedFontSize, renderDimensionalProductLabels } from '@/lib/mapLabelUtils';
import { consolidateQuoteItems, ConsolidatedMainProduct } from '@/lib/quoteConsolidation';

interface QuoteItem {
  id: string;
  product_id: string;
  quantity: number;
  unit_price: number;
  line_total: number;
  measurement_data: any;
  notes?: string;
}

interface Product {
  id: string;
  name: string;
}

interface Quote {
  id: string;
  quote_number: string;
  total_amount: number;
  status: string;
  project_address?: string;
  project_city?: string;
  project_state?: string;
  project_zip_code?: string;
  notes?: string;
  clarifying_answers?: Array<{ question: string; answer: string }> | null;
}

interface QuoteDetailViewProps {
  quote: Quote;
  settings: GlobalSettings;
}

export default function QuoteDetailView({ quote, settings }: QuoteDetailViewProps) {
  const [quoteItems, setQuoteItems] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [apiKey, setApiKey] = useState<string | null>(null);
  const mapRef = useRef<google.maps.Map | null>(null);
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const [currentZoom, setCurrentZoom] = useState(19);

  useEffect(() => {
    fetchQuoteItems();
    fetchApiKey();
  }, [quote.id]);

  useEffect(() => {
    if (apiKey && !mapRef.current && quoteItems.length > 0) {
      initializeMap();
    }
  }, [apiKey, quoteItems]);

  const fetchApiKey = async () => {
    try {
      const { data } = await supabase.functions.invoke('get-google-maps-key');
      if (data?.apiKey) {
        setApiKey(data.apiKey);
      }
    } catch (error) {
      console.error('Error fetching API key:', error);
    }
  };

  const fetchQuoteItems = async () => {
    try {
      const { data: items, error } = await supabase
        .from('quote_items')
        .select(`
          *,
          products (
            id,
            name,
            unit_type
          )
        `)
        .eq('quote_id', quote.id);

      if (error) throw error;

      setQuoteItems(items || []);
    } catch (error) {
      console.error('Error fetching quote items:', error);
    } finally {
      setLoading(false);
    }
  };

  const initializeMap = async () => {
    if (!mapContainerRef.current || !apiKey || quoteItems.length === 0) return;

    console.log('=== MAP INITIALIZATION DEBUG ===');
    console.log('Quote Items:', quoteItems.length);
    quoteItems.forEach((item, idx) => {
      console.log(`Item ${idx}:`, {
        name: item.products?.name,
        type: item.measurement_data?.type,
        hasCoordinates: item.measurement_data?.coordinates?.length > 0,
        hasPointLocations: item.measurement_data?.pointLocations?.length > 0,
        manualEntry: item.measurement_data?.manualEntry,
        pointLocations: item.measurement_data?.pointLocations
      });
    });

    try {
      const loader = new Loader({
        apiKey: apiKey,
        version: 'weekly',
        libraries: ['drawing', 'geometry'],
      });

      await loader.load();

      // Use first item's coordinates or point locations to center map
      let center = { lat: 39.8283, lng: -98.5795 }; // Default US center
      
      const firstItem = quoteItems[0];
      if (firstItem?.measurement_data) {
        if (firstItem.measurement_data.coordinates?.[0]) {
          const firstCoord = firstItem.measurement_data.coordinates[0];
          center = { lat: firstCoord[0], lng: firstCoord[1] };
          console.log('Centering map on coordinates:', center);
        } else if (firstItem.measurement_data.pointLocations?.[0]) {
          center = firstItem.measurement_data.pointLocations[0];
          console.log('Centering map on point location:', center);
        }
      }

      const map = new google.maps.Map(mapContainerRef.current, {
        center: center,
        zoom: 19,
        mapTypeId: google.maps.MapTypeId.HYBRID,
        disableDefaultUI: true,
        zoomControl: true,
      });

      mapRef.current = map;

      // Track zoom changes for dynamic font sizing
      map.addListener('zoom_changed', () => {
        const newZoom = map.getZoom();
        if (newZoom) {
          setCurrentZoom(newZoom);
        }
      });

      // Render all measurements
      const bounds = new google.maps.LatLngBounds();
      const colors = ['#10B981', '#3B82F6', '#F59E0B', '#8B5CF6', '#EC4899'];

      quoteItems.forEach((item, index) => {
        const hasCoordinates = item.measurement_data?.coordinates?.length > 0;
        const hasPointLocations = item.measurement_data?.pointLocations?.length > 0;
        
        console.log(`Processing item ${index}:`, item.products?.name, {
          hasCoordinates,
          hasPointLocations,
          type: item.measurement_data?.type
        });
        
        if (!hasCoordinates && !hasPointLocations) {
          console.log(`Skipping item ${index}: no location data`);
          return;
        }

        const color = item.measurement_data?.mapColor || colors[index % colors.length];

        if (item.measurement_data.type === 'point' && hasPointLocations) {
          console.log(`Rendering ${hasPointLocations} point markers for:`, item.products.name);
          // Handle point measurements (each)
          item.measurement_data.pointLocations.forEach((point: { lat: number; lng: number }, pointIndex: number) => {
            bounds.extend(point);
            
            const marker = new google.maps.Marker({
              position: point,
              map: map,
              label: {
                text: (pointIndex + 1).toString(),
                color: '#FFFFFF',
                fontSize: `${Math.max(10, getZoomBasedFontSize(currentZoom) - 2)}px`,
                fontWeight: 'bold',
              },
              icon: {
                path: google.maps.SymbolPath.CIRCLE,
                fillColor: color,
                fillOpacity: 1,
                strokeColor: '#FFFFFF',
                strokeWeight: 2,
                scale: 12,
              },
            });

            const infoWindow = new google.maps.InfoWindow({
              content: `<div style="color: ${color}; font-weight: bold;">${item.products.name} #${pointIndex + 1}</div>`,
            });

            marker.addListener('click', () => {
              infoWindow.open(map, marker);
            });
          });
        } else if (hasCoordinates) {
          const latLngs = item.measurement_data.coordinates.map((coord: number[]) => ({
            lat: coord[0],
            lng: coord[1]
          }));

          latLngs.forEach((coord: google.maps.LatLngLiteral) => bounds.extend(coord));

          if (item.measurement_data.type === 'area') {
            const polygon = new google.maps.Polygon({
              paths: latLngs,
              fillColor: color,
              fillOpacity: 0.3,
              strokeColor: color,
              strokeWeight: 2,
            });
            polygon.setMap(map);

            const center = bounds.getCenter();
            new google.maps.Marker({
              position: center,
              map: map,
              icon: { path: google.maps.SymbolPath.CIRCLE, scale: 0 },
              label: {
                text: `${item.measurement_data.value.toLocaleString()} sq ft`,
                color: color,
                fontSize: `${getZoomBasedFontSize(currentZoom)}px`,
                fontWeight: 'bold',
              },
            });

            // Add side dimension labels for dimensional products
            if (item.measurement_data.isDimensional && item.measurement_data.dimensions) {
              renderDimensionalProductLabels(
                map,
                latLngs,
                item.measurement_data.dimensions.width,
                item.measurement_data.dimensions.length,
                color,
                currentZoom
              );
            }
          } else if (item.measurement_data.type === 'linear') {
            const polyline = new google.maps.Polyline({
              path: latLngs,
              strokeColor: color,
              strokeWeight: 3,
            });
            polyline.setMap(map);

            const midIndex = Math.floor(latLngs.length / 2);
            new google.maps.Marker({
              position: latLngs[midIndex],
              map: map,
              icon: { path: google.maps.SymbolPath.CIRCLE, scale: 0 },
              label: {
                text: `${item.measurement_data.value.toLocaleString()} ft`,
                color: color,
                fontSize: `${getZoomBasedFontSize(currentZoom)}px`,
                fontWeight: 'bold',
              },
            });
          }
        }
      });

      if (bounds.isEmpty() === false) {
        map.fitBounds(bounds);
        console.log('Map bounds set successfully');
      } else {
        console.log('No bounds to set - all items may be missing location data');
      }
      console.log('=== MAP INITIALIZATION COMPLETE ===');
    } catch (error) {
      console.error('Map initialization failed:', error);
    }
  };

  const subtotal = quoteItems.reduce((sum, item) => sum + item.line_total, 0);
  const taxAmount = settings.global_tax_rate > 0 
    ? subtotal * (settings.global_tax_rate / 100)
    : 0;
  const total = subtotal + taxAmount;

  // Show price ranges when enabled, regardless of quote status (so contractor knows customer's view)
  const shouldShowPriceRanges = settings.use_price_ranges;

  if (loading) {
    return <div className="text-center py-8">Loading quote details...</div>;
  }

  return (
    <div className="space-y-6">
      {/* Map */}
      {quoteItems.some(item => item.measurement_data?.coordinates?.length > 0 || item.measurement_data?.pointLocations?.length > 0) && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <MapPin className="h-5 w-5" />
              Project Location & Measurements
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div ref={mapContainerRef} className="w-full h-[400px] rounded-lg" />
            {quote.project_address && (
              <p className="text-sm text-muted-foreground mt-2">
                {quote.project_address}, {quote.project_city}, {quote.project_state} {quote.project_zip_code}
              </p>
            )}
          </CardContent>
        </Card>
      )}

      {/* Quote Items */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Calculator className="h-5 w-5" />
            Quote Details
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {(() => {
            // Transform quoteItems to QuoteItem format for consolidation
            const itemsForConsolidation = quoteItems.map((item: any) => ({
              id: item.id,
              productId: item.product_id,
              productName: item.products?.name || 'Unknown Product',
              unitPrice: item.unit_price,
              unitType: item.products?.unit_type || 'each',
              quantity: item.quantity,
              lineTotal: item.line_total,
              parentQuoteItemId: item.parent_quote_item_id,
              measurement: item.measurement_data || {}
            }));
            
            const { consolidatedMainProducts } = consolidateQuoteItems(itemsForConsolidation);
            
            return consolidatedMainProducts.map((product: ConsolidatedMainProduct) => {
              const getUnitAbbreviation = (unitType: string) => {
                switch (unitType) {
                  case 'sq_ft': return 'SF';
                  case 'linear_ft': return 'LF';
                  case 'cubic_yard': return 'cu yd';
                  case 'each': return 'ea';
                  default: return unitType?.replace('_', ' ') || 'unit';
                }
              };
              
              const unitAbbr = getUnitAbbreviation(product.unitType);
              const showQuantity = product.totalQuantity > 1;
              
              return (
              <div 
                key={product.productId} 
                className="border-l-4 pl-4 py-2 space-y-3"
                style={{ borderLeftColor: product.color }}
              >
                {/* Header: Product name with color indicator and quantity */}
                <div className="flex items-center gap-2 flex-wrap">
                  <div 
                    className="w-3 h-3 rounded-full" 
                    style={{ backgroundColor: product.color }}
                  />
                  <span className="font-semibold">
                    {product.productName}
                    {showQuantity && <span className="text-sm text-muted-foreground font-normal ml-2">- Qty: {product.instances.length}</span>}
                  </span>
                </div>
                
                {/* Variation selection */}
                {product.variations.length > 0 && (
                  <div className="text-sm text-muted-foreground pl-3">
                    ({product.variations.map((v: any) => v.name).join(', ')})
                  </div>
                )}
                
                {/* Pricing Breakdown - only show if pricing should be visible */}
                {settings.pricing_visibility === 'before_submit' && (
                  <div className="space-y-2">
                    {/* Base Product Calculation */}
                    <div className="text-sm text-muted-foreground pl-3">
                      {showQuantity && `${product.instances.length} × (`}
                      {product.totalQuantity.toLocaleString()} {unitAbbr} × {formatExactPrice(product.unitPrice, {
                        currency_symbol: settings.currency_symbol,
                        decimal_precision: settings.decimal_precision
                      })}/{unitAbbr}
                      {showQuantity && ')'}
                      {' = '}
                      <span className="font-semibold text-foreground">{formatExactPrice(product.totalLineTotal, {
                        currency_symbol: settings.currency_symbol,
                        decimal_precision: settings.decimal_precision
                      })}</span>
                    </div>
                    
                    {/* Traditional Add-ons */}
                    {product.traditionalAddons.length > 0 && (
                      <div className="space-y-1">
                        <div className="text-sm text-muted-foreground mt-2">Add-ons:</div>
                        {product.traditionalAddons.map((addon) => {
                          const totalQty = addon.instances.reduce((sum, inst) => sum + inst.addonData.quantity, 0);
                          const displayName = addon.selectedOption 
                            ? `${addon.name}(${addon.selectedOption})`
                            : addon.name;
                          
                          return (
                            <div key={addon.id} className="text-sm text-muted-foreground pl-3">
                              <span className="font-medium text-foreground">{displayName}</span>: {totalQty} × {formatExactPrice(addon.priceValue, {
                                currency_symbol: settings.currency_symbol,
                                decimal_precision: settings.decimal_precision
                              })} = <span className="font-semibold text-foreground">{formatExactPrice(addon.priceValue * totalQty, {
                                currency_symbol: settings.currency_symbol,
                                decimal_precision: settings.decimal_precision
                              })}</span>
                            </div>
                          );
                        })}
                      </div>
                    )}
                    
                    {/* Map-Placed Add-ons */}
                    {product.mapPlacedAddons.length > 0 && (
                      <div className="space-y-1">
                        {product.mapPlacedAddons.map((mapAddon) => {
                          const mapUnitAbbr = getUnitAbbreviation(mapAddon.unitType);
                          return (
                            <div key={mapAddon.productId} className="text-sm text-muted-foreground pl-3">
                              <span className="font-medium text-foreground">{mapAddon.productName}</span>: {mapAddon.totalQuantity} × {formatExactPrice(mapAddon.unitPrice, {
                                currency_symbol: settings.currency_symbol,
                                decimal_precision: settings.decimal_precision
                              })}/{mapUnitAbbr} = <span className="font-semibold text-foreground">{formatExactPrice(mapAddon.totalLineTotal, {
                                currency_symbol: settings.currency_symbol,
                                decimal_precision: settings.decimal_precision
                              })}</span>
                            </div>
                          );
                        })}
                      </div>
                    )}
                    
                    {/* Product Total */}
                    <div className="border-t border-border pt-2.5 mt-3">
                      <div className="flex justify-end">
                        <span className="text-base font-semibold text-primary">
                          Total: {formatExactPrice(product.totalLineTotal, {
                            currency_symbol: settings.currency_symbol,
                            decimal_precision: settings.decimal_precision
                          })}
                        </span>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            );
          });
          })()}

          <Separator />

          <div className="space-y-2">
            <div className="flex justify-between">
              <span>Subtotal:</span>
              <div className="text-right">
                {shouldShowPriceRanges ? (
                  <div className="space-y-1">
                    <div className="font-semibold">
                      {formatPriceRange(
                        calculatePriceRange(subtotal, settings.price_range_lower_percentage, settings.price_range_upper_percentage),
                        settings
                      )}
                    </div>
                    <div className="text-xs text-muted-foreground">
                      Exact: {formatExactPrice(subtotal, {
                        currency_symbol: settings.currency_symbol,
                        decimal_precision: settings.decimal_precision
                      })}
                    </div>
                  </div>
                ) : (
                  <span className="font-semibold">
                    {formatExactPrice(subtotal, {
                      currency_symbol: settings.currency_symbol,
                      decimal_precision: settings.decimal_precision
                    })}
                  </span>
                )}
              </div>
            </div>
            
            {taxAmount > 0 && (
              <div className="flex justify-between text-sm text-muted-foreground">
                <span>Tax ({settings.global_tax_rate}%):</span>
                <div className="text-right">
                  {shouldShowPriceRanges ? (
                    <div className="space-y-1">
                      <div>
                        {formatPriceRange(
                          calculatePriceRange(taxAmount, settings.price_range_lower_percentage, settings.price_range_upper_percentage),
                          settings
                        )}
                      </div>
                      <div className="text-xs">
                        Exact: {formatExactPrice(taxAmount, {
                          currency_symbol: settings.currency_symbol,
                          decimal_precision: settings.decimal_precision
                        })}
                      </div>
                    </div>
                  ) : (
                    <span>
                      {formatExactPrice(taxAmount, {
                        currency_symbol: settings.currency_symbol,
                        decimal_precision: settings.decimal_precision
                      })}
                    </span>
                  )}
                </div>
              </div>
            )}
            
            <Separator />
            
            <div className="flex justify-between text-2xl font-bold">
              <span>Total:</span>
              <div className="text-right text-primary">
                {shouldShowPriceRanges ? (
                  <div className="space-y-1">
                    <div>
                      {formatPriceRange(
                        calculatePriceRange(total, settings.price_range_lower_percentage, settings.price_range_upper_percentage),
                        settings
                      )}
                    </div>
                    <div className="text-sm font-normal text-muted-foreground">
                      Exact: {formatExactPrice(total, {
                        currency_symbol: settings.currency_symbol,
                        decimal_precision: settings.decimal_precision
                      })}
                    </div>
                  </div>
                ) : (
                  formatExactPrice(total, {
                    currency_symbol: settings.currency_symbol,
                    decimal_precision: settings.decimal_precision
                  })
                )}
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Project Comments */}
      {quote.notes && (
        <Card>
          <CardHeader>
            <CardTitle>Project Comments</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm whitespace-pre-wrap">{quote.notes}</p>
          </CardContent>
        </Card>
      )}

      {/* Clarifying Questions & Answers */}
      {quote.clarifying_answers && Array.isArray(quote.clarifying_answers) && quote.clarifying_answers.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Project Questions & Answers</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {quote.clarifying_answers.map((qa, index) => (
              <div key={index} className="space-y-2">
                <p className="font-medium text-sm">Q{index + 1}: {qa.question}</p>
                <p className="whitespace-pre-wrap bg-muted p-3 rounded-lg text-sm">{qa.answer}</p>
              </div>
            ))}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
