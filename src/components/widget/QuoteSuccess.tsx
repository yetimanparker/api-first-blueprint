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
  Calculator 
} from 'lucide-react';
import { QuoteItem, CustomerInfo } from '@/types/widget';
import { GlobalSettings } from '@/hooks/useGlobalSettings';
import { formatExactPrice, calculatePriceRange, formatPriceRange, calculateAddonWithAreaData } from '@/lib/priceUtils';
import { useEffect, useRef, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { loadGoogleMapsAPI } from '@/lib/googleMapsLoader';
import { getZoomBasedFontSize, renderDimensionalProductLabels, renderEdgeMeasurements } from '@/lib/mapLabelUtils';

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
  logo_url?: string;
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
    <div className="max-w-6xl mx-auto px-4 py-4 space-y-4">
      {/* Success Header */}
      <Card className="border-green-500 bg-green-50 dark:bg-green-950">
        <CardContent className="py-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              {contractorInfo?.logo_url && (
                <img 
                  src={contractorInfo.logo_url} 
                  alt={`${contractorInfo.business_name} logo`}
                  className="h-12 w-auto object-contain"
                />
              )}
              <p className="text-sm text-green-900 dark:text-green-100">
                Thank you! We will contact you shortly. Quote <span className="font-semibold">#{quoteNumber}</span> details are below.
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* Main Quote Details */}
        <div className="lg:col-span-2 space-y-4">
          {/* Quote Items */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Calculator className="h-5 w-5" />
                Quote Details
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
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
                    className="border-l-4 pl-4 py-2 space-y-2"
                    style={{ borderLeftColor: item.measurement.mapColor || '#3B82F6' }}
                  >
                    {/* Header: Product name with color indicator and quantity */}
                    <div className="flex items-center gap-2">
                      <div 
                        className="w-3 h-3 rounded-full" 
                        style={{ backgroundColor: item.measurement.mapColor || '#3B82F6' }}
                      />
                      <span className="font-semibold">
                        {item.productName}
                        <span className="text-sm text-muted-foreground font-normal ml-2">
                          ({quantity.toLocaleString()} {unitAbbr})
                        </span>
                      </span>
                    </div>
                    
                    {/* Variation selection */}
                    {variations.length > 0 && (
                      <div className="text-sm text-muted-foreground">
                        ({variations.map((v: any) => v.name).join(', ')})
                      </div>
                    )}
                    
                    {/* Add-ons inline */}
                    {addons.filter((a: any) => a.quantity > 0).length > 0 && (
                      <div className="text-sm text-foreground">
                        <span className="font-medium">Add-ons:</span>
                        {' '}
                        {addons.filter((a: any) => a.quantity > 0).map((addon: any, idx: number) => (
                          <span key={addon.id}>
                            {addon.name}
                            {addon.selectedOptionName && ` (${addon.selectedOptionName})`}
                            {idx < addons.filter((a: any) => a.quantity > 0).length - 1 && ', '}
                          </span>
                        ))}
                      </div>
                    )}
                    
                    {/* Pricing Breakdown - only show if pricing should be visible */}
                    {showPricing && (
                      <div className="space-y-2">
                        {/* Base Product Calculation */}
                        <div className="text-sm text-muted-foreground pl-3">
                          {quantity.toLocaleString()} {unitAbbr} × {formatExactPrice(baseUnitPrice, {
                            currency_symbol: settings.currency_symbol,
                            decimal_precision: settings.decimal_precision
                          })}/{unitAbbr} = <span className="font-semibold text-foreground">{formatExactPrice(baseTotal, {
                            currency_symbol: settings.currency_symbol,
                            decimal_precision: settings.decimal_precision
                          })}</span>
                        </div>
                        
                        {/* Add-ons Pricing Details */}
                        {addons.filter((a: any) => a.quantity > 0).length > 0 && (
                          <div className="space-y-1">
                            <div className="text-sm text-muted-foreground mt-2">Add-ons:</div>
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
                                <div key={addon.id} className="text-sm text-muted-foreground pl-3">
                                  <span className="font-medium text-foreground">{addon.name}</span>
                                  {addon.selectedOptionName && `(${addon.selectedOptionName})`}: {addonCalc} = <span className="font-semibold text-foreground">{formatExactPrice(addonPrice * addon.quantity, {
                                    currency_symbol: settings.currency_symbol,
                                    decimal_precision: settings.decimal_precision
                                  })}</span>
                                </div>
                              );
                            })}
                          </div>
                        )}
                        
                        {/* Item Total */}
                        <div className="border-t border-border pt-2.5 mt-3">
                          <div className="flex justify-end">
                            <span className="text-base font-semibold text-green-600">
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

          {/* Map */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <MapPin className="h-5 w-5" />
                Project Location & Measurements
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div ref={mapContainerRef} className="w-full h-[400px] rounded-lg" />
              {customerInfo.address && (
                <p className="text-sm text-muted-foreground mt-2">
                  {customerInfo.address}, {customerInfo.city}, {customerInfo.state} {customerInfo.zipCode}
                </p>
              )}
            </CardContent>
          </Card>

          {/* Project Comments */}
          {projectComments && (
            <Card>
              <CardHeader>
                <CardTitle>Project Comments</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-sm whitespace-pre-wrap">{projectComments}</p>
              </CardContent>
            </Card>
          )}
        </div>

        {/* Sidebar */}
        <div className="space-y-6">
          {/* Contractor Info */}
          {contractorInfo && (
            <Card>
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

          {/* Actions */}
          <Card>
            <CardHeader>
              <CardTitle>Actions</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <Button className="w-full" variant="outline" disabled>
                <Download className="h-4 w-4 mr-2" />
                Download PDF
              </Button>
              <Button className="w-full" variant="outline" disabled>
                <Mail className="h-4 w-4 mr-2" />
                Email Quote
              </Button>
              <Button className="w-full" variant="outline" disabled>
                <Calendar className="h-4 w-4 mr-2" />
                Schedule Appointment
              </Button>
              <p className="text-xs text-muted-foreground text-center">
                Additional features coming soon
              </p>
            </CardContent>
          </Card>

          {/* Customer Info */}
          <Card>
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
