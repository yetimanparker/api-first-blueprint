import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Separator } from '@/components/ui/separator';
import { 
  CheckCircle2, 
  Download, 
  Mail, 
  Calendar, 
  MapPin, 
  Phone, 
  Globe,
  Calculator,
  Maximize2,
  Minimize2
} from 'lucide-react';
import { QuoteItem, CustomerInfo } from '@/types/widget';
import { GlobalSettings } from '@/hooks/useGlobalSettings';
import { formatExactPrice, calculatePriceRange, formatPriceRange, calculateAddonWithAreaData } from '@/lib/priceUtils';
import { useEffect, useRef, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { loadGoogleMapsAPI } from '@/lib/googleMapsLoader';
import { getZoomBasedFontSize, renderDimensionalProductLabels, renderEdgeMeasurements } from '@/lib/mapLabelUtils';
import { cn } from '@/lib/utils';

interface QuoteSuccessProps {
  quoteNumber: string;
  quoteItems: QuoteItem[];
  customerInfo: Partial<CustomerInfo>;
  contractorId: string;
  settings: GlobalSettings;
  projectComments?: string;
}

interface ContractorInfo {
  business_name: string;
  email: string;
  phone?: string;
  address?: string;
  city?: string;
  state?: string;
  zip_code?: string;
  website?: string;
  brand_color?: string;
}

const QuoteSuccess = ({
  quoteNumber,
  quoteItems,
  customerInfo,
  contractorId,
  settings,
  projectComments
}: QuoteSuccessProps) => {
  const [contractorInfo, setContractorInfo] = useState<ContractorInfo | null>(null);
  const [items, setItems] = useState<QuoteItem[]>(quoteItems);
  const mapRef = useRef<google.maps.Map | null>(null);
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const [currentZoom, setCurrentZoom] = useState(19);
  const edgeLabelsRef = useRef<google.maps.Marker[]>([]);
  const [mapExpanded, setMapExpanded] = useState(false);

  useEffect(() => {
    fetchContractorInfo();
    initializeMap();
  }, []);

  // Re-render edge labels when zoom changes
  useEffect(() => {
    if (!mapRef.current || !quoteItems.length) return;

    // Clear old edge labels
    edgeLabelsRef.current.forEach(marker => marker.setMap(null));
    edgeLabelsRef.current = [];

    // Re-render edge labels with new zoom level
    quoteItems.forEach((item) => {
      const color = item.measurement.mapColor || '#3B82F6';

      if (item.measurement.type === 'area' && item.measurement.coordinates) {
        const latLngs = item.measurement.coordinates.map(coord => ({
          lat: coord[0],
          lng: coord[1]
        }));

        const edgeMarkers = renderEdgeMeasurements(
          mapRef.current!,
          latLngs,
          color,
          currentZoom,
          true
        );
        edgeLabelsRef.current.push(...edgeMarkers);

        if (item.measurement.isDimensional && item.measurement.dimensions) {
          const dimensionMarkers = renderDimensionalProductLabels(
            mapRef.current!,
            latLngs,
            item.measurement.dimensions.width,
            item.measurement.dimensions.length,
            color,
            currentZoom
          );
          edgeLabelsRef.current.push(...dimensionMarkers);
        }
      } else if (item.measurement.type === 'linear' && item.measurement.coordinates) {
        const latLngs = item.measurement.coordinates.map(coord => ({
          lat: coord[0],
          lng: coord[1]
        }));

        const edgeMarkers = renderEdgeMeasurements(
          mapRef.current!,
          latLngs,
          color,
          currentZoom,
          false
        );
        edgeLabelsRef.current.push(...edgeMarkers);
      }
    });
  }, [currentZoom, quoteItems]);

  const fetchContractorInfo = async () => {
    const { data } = await supabase
      .from('contractors')
      .select('*')
      .eq('id', contractorId)
      .single();
    
    if (data) {
      setContractorInfo(data);
    }
  };

  const initializeMap = async () => {
    if (!mapContainerRef.current) return;

    try {
      console.log('🗺️ QuoteSuccess - Initializing map with items:', quoteItems.length);
      
      // Use shared loader to prevent conflicts
      await loadGoogleMapsAPI();

      // Calculate bounds from all measurements
      const bounds = new google.maps.LatLngBounds();
      let hasAnyCoordinates = false;

      quoteItems.forEach((item, index) => {
        console.log(`📍 Item ${index} (${item.productName}):`, {
          type: item.measurement.type,
          hasCoordinates: !!item.measurement.coordinates,
          coordinatesLength: item.measurement.coordinates?.length || 0,
          hasPointLocations: !!item.measurement.pointLocations,
          pointLocationsLength: item.measurement.pointLocations?.length || 0
        });

        // For point measurements
        if (item.measurement.type === 'point' && item.measurement.pointLocations) {
          item.measurement.pointLocations.forEach(point => {
            bounds.extend(point);
            hasAnyCoordinates = true;
          });
        }
        // For area/linear measurements
        else if (item.measurement.coordinates) {
          item.measurement.coordinates.forEach(([lat, lng]) => {
            bounds.extend({ lat, lng });
            hasAnyCoordinates = true;
          });
        }
      });

      let center;
      let zoom = 19;

      if (hasAnyCoordinates) {
        center = bounds.getCenter();
        console.log('✅ Calculated center from bounds:', center.toJSON());
      } else {
        // Fallback to first coordinate if available
        const firstItem = quoteItems[0];
        if (firstItem?.measurement.pointLocations?.[0]) {
          center = firstItem.measurement.pointLocations[0];
        } else if (firstItem?.measurement.coordinates?.[0]) {
          center = { lat: firstItem.measurement.coordinates[0][0], lng: firstItem.measurement.coordinates[0][1] };
        } else {
          center = { lat: 39.8283, lng: -98.5795 }; // Center of US as fallback
          zoom = 4;
        }
        console.log('⚠️ Using fallback center:', center);
      }

      const map = new google.maps.Map(mapContainerRef.current, {
        center: center,
        zoom: zoom,
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

      // Fit bounds if we have coordinates
      if (hasAnyCoordinates) {
        map.fitBounds(bounds);
        // Set a reasonable zoom level after fitting
        google.maps.event.addListenerOnce(map, 'bounds_changed', () => {
          const currentZoom = map.getZoom();
          if (currentZoom && currentZoom > 20) {
            map.setZoom(20);
          }
        });
      }

      console.log('🎨 Starting to render measurements...');

      // Render all measurements
      quoteItems.forEach((item, index) => {
        // Use the mapColor that was assigned when the measurement was created
        const color = item.measurement.mapColor || '#3B82F6';
        
        console.log(`🎨 Rendering item ${index} (${item.productName}, type: ${item.measurement.type})`);

        if (item.measurement.type === 'point' && item.measurement.pointLocations) {
          // Handle point measurements (e.g., individual trees)
          console.log(`  ➡️ Rendering ${item.measurement.pointLocations.length} point markers`);
          item.measurement.pointLocations.forEach((position, idx) => {
            new google.maps.Marker({
              position: position, // Already in {lat, lng} format
              map: map,
              icon: {
                path: google.maps.SymbolPath.CIRCLE,
                scale: 10,
                fillColor: color,
                fillOpacity: 0.9,
                strokeColor: '#ffffff',
                strokeWeight: 2,
              },
              label: {
                text: `${idx + 1}`,
                color: '#ffffff',
                fontSize: `${Math.max(10, getZoomBasedFontSize(currentZoom) - 2)}px`,
                fontWeight: 'bold',
              },
              title: `${item.productName} - Location ${idx + 1}`,
            });
          });
        }

        else if (item.measurement.type === 'area' && item.measurement.coordinates) {
          const latLngs = item.measurement.coordinates.map(coord => ({
            lat: coord[0],
            lng: coord[1]
          }));
          
          console.log(`  ➡️ Rendering area polygon with ${latLngs.length} points`);

          const polygon = new google.maps.Polygon({
            paths: latLngs,
            fillColor: color,
            fillOpacity: 0.3,
            strokeColor: color,
            strokeWeight: 2,
          });
          polygon.setMap(map);

          const areaBounds = new google.maps.LatLngBounds();
          latLngs.forEach(coord => areaBounds.extend(coord));
          const areaCenter = areaBounds.getCenter();
          
          new google.maps.Marker({
            position: areaCenter,
            map: map,
            icon: { path: google.maps.SymbolPath.CIRCLE, scale: 0 },
            label: {
              text: `${item.measurement.value.toLocaleString()} sq ft`,
              color: color,
              fontSize: `${getZoomBasedFontSize(currentZoom)}px`,
              fontWeight: 'bold',
            },
          });

          // Edge measurements are rendered in separate useEffect
        } else if (item.measurement.type === 'linear' && item.measurement.coordinates) {
          const latLngs = item.measurement.coordinates.map(coord => ({
            lat: coord[0],
            lng: coord[1]
          }));
          
          console.log(`  ➡️ Rendering linear path with ${latLngs.length} points`);

          const polyline = new google.maps.Polyline({
            path: latLngs,
            strokeColor: color,
            strokeWeight: 3,
          });
          polyline.setMap(map);

          // Edge measurements are rendered in separate useEffect

          const midIndex = Math.floor(latLngs.length / 2);
          new google.maps.Marker({
            position: latLngs[midIndex],
            map: map,
            icon: { path: google.maps.SymbolPath.CIRCLE, scale: 0 },
            label: {
              text: `Total: ${item.measurement.value.toLocaleString()} ft`,
              color: color,
              fontSize: `${getZoomBasedFontSize(currentZoom)}px`,
              fontWeight: 'bold',
            },
          });
        }
      });

      console.log('✅ QuoteSuccess map rendering complete');
    } catch (error) {
      console.error('Map initialization failed:', error);
    }
  };

  // Sync local items state with quoteItems prop
  useEffect(() => {
    setItems(quoteItems);
  }, [quoteItems]);

  const subtotal = items.reduce((sum, item) => sum + item.lineTotal, 0);
  const taxAmount = settings.global_tax_rate > 0 
    ? subtotal * (settings.global_tax_rate / 100)
    : 0;
  const total = subtotal + taxAmount;

  return (
    <div className="max-w-6xl mx-auto px-4 py-8 space-y-6 animate-fade-in">
      <style>{`
        @media print {
          .no-print { display: none !important; }
          .print-break-inside-avoid { break-inside: avoid; }
          body { print-color-adjust: exact; -webkit-print-color-adjust: exact; }
        }
      `}</style>

      {/* Success Header */}
      <Card className="border-green-500 bg-gradient-to-br from-green-50 to-green-100 dark:from-green-950 dark:to-green-900 shadow-lg">
        <CardContent className="pt-6">
          <div className="flex flex-col sm:flex-row items-center gap-4 mb-4">
            <CheckCircle2 className="h-16 w-16 text-green-600 flex-shrink-0" />
            <div className="text-center sm:text-left">
              <h1 className="text-3xl md:text-4xl font-bold text-green-900 dark:text-green-100 mb-2">
                Quote Submitted Successfully!
              </h1>
              <div className="inline-flex items-center gap-2 bg-white/50 dark:bg-black/30 px-4 py-2 rounded-full">
                <span className="text-sm text-green-700 dark:text-green-300">Quote Number</span>
                <span className="text-xl font-bold text-green-900 dark:text-green-100">#{quoteNumber}</span>
              </div>
            </div>
          </div>
          <p className="text-base text-green-800 dark:text-green-200">
            We've received your quote request and will be in touch soon. Below is a detailed overview of your quote.
          </p>
        </CardContent>
      </Card>

      {/* Quick Summary Card */}
      <Card className="bg-gradient-to-r from-primary/5 to-primary/10 shadow-md">
        <CardContent className="pt-6">
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-6">
            {/* Total Amount */}
            <div className="text-center">
              <div className="text-sm text-muted-foreground mb-1">Total Amount</div>
              <div className="text-2xl font-bold text-green-600">
                {formatExactPrice(total, {
                  currency_symbol: settings.currency_symbol,
                  decimal_precision: settings.decimal_precision
                })}
              </div>
            </div>
            
            {/* Number of Items */}
            <div className="text-center">
              <div className="text-sm text-muted-foreground mb-1">Items</div>
              <div className="text-2xl font-bold">{items.length}</div>
            </div>
            
            {/* Project Location */}
            <div className="text-center col-span-2">
              <div className="text-sm text-muted-foreground mb-1">Project Location</div>
              <div className="text-base font-semibold truncate">
                {customerInfo.city}, {customerInfo.state}
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 md:gap-6">
        {/* Mobile: Show contractor info first */}
        <div className="lg:hidden space-y-6">
          {contractorInfo && (
            <Card className="shadow-md">
              <CardHeader>
                <CardTitle>Contractor Information</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <div>
                  <p className="font-semibold text-lg">{contractorInfo.business_name}</p>
                </div>
                
                <Separator />
                
                {contractorInfo.phone && (
                  <Button className="w-full" variant="default" asChild>
                    <a href={`tel:${contractorInfo.phone}`}>
                      <Phone className="h-4 w-4 mr-2" />
                      Call {contractorInfo.business_name}
                    </a>
                  </Button>
                )}
                {contractorInfo.email && (
                  <Button className="w-full" variant="outline" asChild>
                    <a href={`mailto:${contractorInfo.email}`}>
                      <Mail className="h-4 w-4 mr-2" />
                      Email Us
                    </a>
                  </Button>
                )}
              </CardContent>
            </Card>
          )}
        </div>

        {/* Main Quote Details - Always visible */}
        <div className="lg:col-span-2 space-y-4 md:space-y-6">
          {/* Quote Items - MOVED UP */}
          <Card className="shadow-md hover:shadow-lg transition-shadow">
            <CardHeader>
              <CardTitle className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Calculator className="h-5 w-5" />
                  Quote Details
                </div>
                <span className="text-sm font-normal text-muted-foreground">
                  {items.length} {items.length === 1 ? 'item' : 'items'}
                </span>
              </CardTitle>
              {/* Map Color Legend */}
              <div className="flex flex-wrap gap-3 mt-2 text-xs">
                {items.map((item, idx) => (
                  <div key={idx} className="flex items-center gap-1.5">
                    <div 
                      className="w-3 h-3 rounded-full border border-white shadow-sm" 
                      style={{ backgroundColor: item.measurement.mapColor || '#3B82F6' }}
                    />
                    <span className="text-muted-foreground">{item.productName}</span>
                  </div>
                ))}
              </div>
            </CardHeader>
            <CardContent className="space-y-4 print-break-inside-avoid">
            {items.map((item) => {
                const variations = item.measurement.variations || [];
                const addons = item.measurement.addons || [];
                const showPricing = settings.pricing_visibility === 'before_submit';
                
                // Calculate unit abbreviation
                const getUnitAbbreviation = (unit: string) => {
                  switch (unit) {
                    case 'sq_ft': return 'SF';
                    case 'linear_ft': return 'LF';
                    case 'cubic_yard': return 'cu yd';
                    case 'each': return 'ea';
                    default: return unit?.replace('_', ' ') || 'unit';
                  }
                };

                const quantity = item.measurement.depth 
                  ? (item.measurement.value * item.measurement.depth) / 324 
                  : item.measurement.value;

                // Calculate base price with variation adjustment
                const getVariationAdjustedPrice = () => {
                  let adjustedPrice = item.unitPrice;
                  variations.forEach((v: any) => {
                    if (v.adjustmentType === 'percentage') {
                      adjustedPrice += item.unitPrice * (v.priceAdjustment / 100);
                    } else {
                      adjustedPrice += v.priceAdjustment;
                    }
                  });
                  return adjustedPrice;
                };

                const baseUnitPrice = getVariationAdjustedPrice();
                const baseTotal = baseUnitPrice * quantity;

                const unitAbbr = getUnitAbbreviation(item.measurement.depth ? 'cubic_yard' : item.measurement.unit);
                
                return (
                  <div 
                    key={item.id} 
                    className="border-l-4 pl-4 py-3 space-y-3 hover:bg-muted/30 transition-all duration-200 rounded-r-lg print-break-inside-avoid"
                    style={{ borderLeftColor: item.measurement.mapColor || '#3B82F6' }}
                  >
                    {/* Header: Product name with color indicator and quantity */}
                    <div className="flex items-center gap-2">
                      <div 
                        className="w-4 h-4 rounded-full shadow-sm border border-white" 
                        style={{ backgroundColor: item.measurement.mapColor || '#3B82F6' }}
                      />
                      <span className="font-semibold text-base">
                        {item.productName}
                        <span className="text-sm text-muted-foreground font-normal ml-2">
                          ({quantity.toLocaleString()} {unitAbbr})
                        </span>
                      </span>
                    </div>
                    
                    {/* Variations Section - Always show */}
                    {variations.length > 0 && (
                      <div className="space-y-1 bg-muted/30 p-3 rounded-md">
                        <div className="text-sm font-semibold text-foreground">Selection:</div>
                        <div className="text-base">
                          {variations.map((v: any) => v.name).join(' ')} {item.productName}
                        </div>
                      </div>
                    )}
                    
                    {/* Add-ons Section - Always show */}
                    {addons.filter((a: any) => a.quantity > 0).length > 0 && (
                      <div className="space-y-2 bg-muted/30 p-3 rounded-md">
                        <div className="text-sm font-semibold text-foreground">Add-ons:</div>
                        {addons.filter((a: any) => a.quantity > 0).map((addon: any) => {
                          return (
                            <div key={addon.id} className="space-y-1">
                              <div className="text-base font-medium">
                                {addon.name}
                                {addon.selectedOptionName && (
                                  <span className="text-sm text-foreground/70 ml-1">
                                    - {addon.selectedOptionName}
                                  </span>
                                )}
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    )}
                    
                    {/* Pricing Breakdown - only show if pricing should be visible */}
                    {showPricing && (
                      <div className="space-y-1">
                        {/* Base Product Line with Variation */}
                        <div className="space-y-1">
                          <div className="text-base">
                            {variations.map((v: any) => (
                              <span key={v.id}>{v.name} </span>
                            ))}
                            {item.productName}:
                          </div>
                          <div className="text-sm text-muted-foreground">
                            {quantity.toLocaleString()} {unitAbbr} × {formatExactPrice(baseUnitPrice, {
                              currency_symbol: settings.currency_symbol,
                              decimal_precision: settings.decimal_precision
                            })}/{unitAbbr} = <span className="font-bold">{formatExactPrice(baseTotal, {
                              currency_symbol: settings.currency_symbol,
                              decimal_precision: settings.decimal_precision
                            })}</span>
                          </div>
                        </div>
                        
                        {/* Add-ons Pricing Details */}
                        {addons.filter((a: any) => a.quantity > 0).length > 0 && (
                          <div className="space-y-1">
                            <div className="text-sm font-bold text-muted-foreground">Add-on Pricing:</div>
                            {addons.filter((a: any) => a.quantity > 0).map((addon: any) => {
                              let addonCalc = '';
                              let addonPrice = 0;
                              
                              if (addon.calculationType === 'area_calculation') {
                                // Calculate addon with area data considering variation height
                                const variationData = variations.length > 0
                                  ? {
                                      height: variations[0].height_value || null,
                                      unit: variations[0].unit_of_measurement || 'ft',
                                      affects_area_calculation: variations[0].affects_area_calculation || false
                                    }
                                  : undefined;
                                
                                const baseQuantity = item.measurement.depth
                                  ? (item.measurement.value * item.measurement.depth) / 324
                                  : item.measurement.value;
                                
                                addonPrice = calculateAddonWithAreaData(
                                  addon.priceValue,
                                  baseQuantity,
                                  addon.calculationType,
                                  variationData
                                );
                                
                                // Display calculation
                                if (variationData?.height && variationData.affects_area_calculation) {
                                  const linearFeet = item.measurement.value;
                                  const heightFeet = variationData.height;
                                  const squareFeet = linearFeet * heightFeet;
                                  addonCalc = `${squareFeet.toLocaleString()} SF × ${formatExactPrice(addon.priceValue, {
                                    currency_symbol: settings.currency_symbol,
                                    decimal_precision: settings.decimal_precision
                                  })}/SF`;
                                } else {
                                  addonCalc = `${baseQuantity.toLocaleString()} ${unitAbbr} × ${formatExactPrice(addon.priceValue, {
                                    currency_symbol: settings.currency_symbol,
                                    decimal_precision: settings.decimal_precision
                                  })}/${unitAbbr}`;
                                }
                              } else if (addon.calculationType === 'per_unit') {
                                addonPrice = addon.priceValue * quantity * addon.quantity;
                                addonCalc = `${quantity.toLocaleString()} ${unitAbbr} × ${formatExactPrice(addon.priceValue, {
                                  currency_symbol: settings.currency_symbol,
                                  decimal_precision: settings.decimal_precision
                                })}/${unitAbbr}`;
                              } else {
                                // Total calculation
                                addonPrice = addon.priceValue * addon.quantity;
                                addonCalc = `${addon.quantity} × ${formatExactPrice(addon.priceValue, {
                                  currency_symbol: settings.currency_symbol,
                                  decimal_precision: settings.decimal_precision
                                })}`;
                              }
                              
                              return (
                                <div key={addon.id} className="space-y-1">
                                  <div className="text-base">{addon.name}</div>
                                  <div className="text-sm text-muted-foreground">
                                    {addonCalc} = <span className="font-bold">{formatExactPrice(addonPrice * addon.quantity, {
                                      currency_symbol: settings.currency_symbol,
                                      decimal_precision: settings.decimal_precision
                                    })}</span>
                                  </div>
                                </div>
                              );
                            })}
                          </div>
                        )}
                        
                        {/* Item Total */}
                        <div className="border-t-2 border-border pt-3">
                          <div className="flex justify-end">
                            <span className="text-lg font-bold text-green-600">
                              Total: {formatExactPrice(item.lineTotal, {
                                currency_symbol: settings.currency_symbol,
                                decimal_precision: settings.decimal_precision
                              })}
                            </span>
                          </div>
                        </div>
                      </div>
                    )}
                    
                    {/* Notes */}
                    {item.notes && (
                      <p className="text-sm text-muted-foreground mt-2 italic">{item.notes}</p>
                    )}
                  </div>
                );
              })}

              <Separator />

              <div className="space-y-2">
                <div className="flex justify-between">
                  <span>Subtotal:</span>
                  <span className="font-semibold">
                    {settings.use_price_ranges ? (
                      formatPriceRange(
                        calculatePriceRange(subtotal, settings.price_range_lower_percentage, settings.price_range_upper_percentage),
                        settings
                      )
                    ) : (
                      formatExactPrice(subtotal, {
                        currency_symbol: settings.currency_symbol,
                        decimal_precision: settings.decimal_precision
                      })
                    )}
                  </span>
                </div>
                
                {taxAmount > 0 && (
                  <div className="flex justify-between text-sm text-muted-foreground">
                    <span>Tax ({settings.global_tax_rate}%):</span>
                    <span>
                      {settings.use_price_ranges ? (
                        formatPriceRange(
                          calculatePriceRange(taxAmount, settings.price_range_lower_percentage, settings.price_range_upper_percentage),
                          settings
                        )
                      ) : (
                        formatExactPrice(taxAmount, {
                          currency_symbol: settings.currency_symbol,
                          decimal_precision: settings.decimal_precision
                        })
                      )}
                    </span>
                  </div>
                )}
                
                <Separator />
                
                <div className="flex justify-between text-2xl font-bold">
                  <span>Total:</span>
                  <span className="text-green-600">
                    {settings.use_price_ranges ? (
                      formatPriceRange(
                        calculatePriceRange(total, settings.price_range_lower_percentage, settings.price_range_upper_percentage),
                        settings
                      )
                    ) : (
                      formatExactPrice(total, {
                        currency_symbol: settings.currency_symbol,
                        decimal_precision: settings.decimal_precision
                      })
                    )}
                  </span>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Map - MOVED DOWN */}
          <Card className="shadow-md hover:shadow-lg transition-shadow">
            <CardHeader>
              <CardTitle className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <MapPin className="h-5 w-5" />
                  Project Location & Measurements
                </div>
                <Button 
                  variant="ghost" 
                  size="sm"
                  onClick={() => setMapExpanded(!mapExpanded)}
                  className="no-print"
                >
                  {mapExpanded ? (
                    <>
                      <Minimize2 className="h-4 w-4 mr-1" />
                      Collapse
                    </>
                  ) : (
                    <>
                      <Maximize2 className="h-4 w-4 mr-1" />
                      Expand
                    </>
                  )}
                </Button>
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div 
                ref={mapContainerRef} 
                className={cn(
                  "w-full rounded-lg transition-all duration-300 border border-border",
                  mapExpanded ? "h-[600px]" : "h-[400px]"
                )}
              />
              <div className="mt-3 flex items-center justify-between text-sm text-muted-foreground flex-wrap gap-2">
                <div>
                  {customerInfo.address && (
                    <div className="flex items-center gap-1">
                      <MapPin className="h-3 w-3" />
                      <span>
                        {customerInfo.address}, {customerInfo.city}, {customerInfo.state} {customerInfo.zipCode}
                      </span>
                    </div>
                  )}
                </div>
                <span className="text-xs no-print">Use mouse/touch to zoom and pan</span>
              </div>
            </CardContent>
          </Card>

          {/* Project Comments */}
          {projectComments && (
            <Card className="shadow-md">
              <CardHeader>
                <CardTitle>Project Comments</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-sm whitespace-pre-wrap">{projectComments}</p>
              </CardContent>
            </Card>
          )}
        </div>

        {/* Desktop Sidebar - Sticky on Desktop */}
        <div className="hidden lg:block space-y-6 lg:sticky lg:top-6 lg:self-start">
          {/* Contractor Info */}
          {contractorInfo && (
            <Card className="shadow-md hover:shadow-lg transition-shadow">
              <CardHeader>
                <CardTitle>Contractor Information</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <div>
                  <p className="font-semibold text-lg">{contractorInfo.business_name}</p>
                </div>
                
                <Separator />
                
                {contractorInfo.email && (
                  <div className="flex items-start gap-2">
                    <Mail className="h-4 w-4 mt-0.5 text-muted-foreground" />
                    <a href={`mailto:${contractorInfo.email}`} className="text-sm hover:underline">
                      {contractorInfo.email}
                    </a>
                  </div>
                )}
                
                {contractorInfo.phone && (
                  <div className="flex items-start gap-2">
                    <Phone className="h-4 w-4 mt-0.5 text-muted-foreground" />
                    <a href={`tel:${contractorInfo.phone}`} className="text-sm hover:underline">
                      {contractorInfo.phone}
                    </a>
                  </div>
                )}
                
                {contractorInfo.website && (
                  <div className="flex items-start gap-2">
                    <Globe className="h-4 w-4 mt-0.5 text-muted-foreground" />
                    <a href={contractorInfo.website} target="_blank" rel="noopener noreferrer" className="text-sm hover:underline">
                      {contractorInfo.website}
                    </a>
                  </div>
                )}
                
                {contractorInfo.address && (
                  <div className="flex items-start gap-2">
                    <MapPin className="h-4 w-4 mt-0.5 text-muted-foreground" />
                    <div className="text-sm">
                      <div>{contractorInfo.address}</div>
                      <div>{contractorInfo.city}, {contractorInfo.state} {contractorInfo.zip_code}</div>
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
          )}

          {/* Next Steps */}
          <Card className="shadow-md">
            <CardHeader>
              <CardTitle>Next Steps</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="bg-muted/50 border-2 border-dashed border-muted-foreground/20 rounded-lg p-4 text-center no-print">
                <div className="space-y-2">
                  <div className="flex items-center justify-center gap-2 text-muted-foreground">
                    <Download className="h-4 w-4" />
                    <Mail className="h-4 w-4" />
                    <Calendar className="h-4 w-4" />
                  </div>
                  <p className="text-sm font-medium">Coming Soon</p>
                  <p className="text-xs text-muted-foreground">
                    PDF download, email sharing, and appointment scheduling will be available shortly
                  </p>
                </div>
              </div>
              
              {/* Contact Contractor CTA */}
              {contractorInfo && (
                <div className="pt-3 border-t">
                  <p className="text-sm font-medium mb-3">Questions about your quote?</p>
                  {contractorInfo.phone && (
                    <Button className="w-full" variant="default" asChild>
                      <a href={`tel:${contractorInfo.phone}`}>
                        <Phone className="h-4 w-4 mr-2" />
                        Call {contractorInfo.business_name}
                      </a>
                    </Button>
                  )}
                  {contractorInfo.email && (
                    <Button className="w-full mt-2" variant="outline" asChild>
                      <a href={`mailto:${contractorInfo.email}`}>
                        <Mail className="h-4 w-4 mr-2" />
                        Email {contractorInfo.business_name}
                      </a>
                    </Button>
                  )}
                </div>
              )}
            </CardContent>
          </Card>

          {/* Customer Info */}
          <Card className="shadow-md">
            <CardHeader>
              <CardTitle>Your Information</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2 text-sm">
              <div>
                <span className="font-medium">Name:</span> {customerInfo.firstName} {customerInfo.lastName}
              </div>
              {customerInfo.email && (
                <div>
                  <span className="font-medium">Email:</span> {customerInfo.email}
                </div>
              )}
              {customerInfo.phone && (
                <div>
                  <span className="font-medium">Phone:</span> {customerInfo.phone}
                </div>
              )}
              {customerInfo.address && (
                <div>
                  <span className="font-medium">Address:</span> {customerInfo.address}
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Mobile: Show remaining sidebar items at bottom */}
        <div className="lg:hidden space-y-6">
          {/* Customer Info on Mobile */}
          <Card className="shadow-md">
            <CardHeader>
              <CardTitle>Your Information</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2 text-sm">
              <div>
                <span className="font-medium">Name:</span> {customerInfo.firstName} {customerInfo.lastName}
              </div>
              {customerInfo.email && (
                <div>
                  <span className="font-medium">Email:</span> {customerInfo.email}
                </div>
              )}
              {customerInfo.phone && (
                <div>
                  <span className="font-medium">Phone:</span> {customerInfo.phone}
                </div>
              )}
              {customerInfo.address && (
                <div>
                  <span className="font-medium">Address:</span> {customerInfo.address}
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
};

export default QuoteSuccess;
