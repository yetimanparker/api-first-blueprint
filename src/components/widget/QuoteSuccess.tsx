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
import { getZoomBasedFontSize, getZoomBasedMarkerScale, renderDimensionalProductLabels, renderEdgeMeasurements } from '@/lib/mapLabelUtils';
import { consolidateQuoteItems } from '@/lib/quoteConsolidation';
import { calculateAddonDisplay, getUnitAbbreviation } from '@/lib/addonDisplayUtils';
import { calculateProductPrice } from '@/lib/productPricingUtils';

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
  const pointMarkersRef = useRef<google.maps.Marker[]>([]);

  useEffect(() => {
    fetchContractorInfo();
    initializeMap();
  }, []);

  // Update point marker scales when zoom changes
  useEffect(() => {
    if (!mapRef.current) return;
    
    const newScale = getZoomBasedMarkerScale(currentZoom);
    pointMarkersRef.current.forEach(marker => {
      const currentIcon = marker.getIcon() as google.maps.Symbol;
      if (currentIcon) {
        marker.setIcon({
          ...currentIcon,
          scale: newScale,
        });
      }
    });
  }, [currentZoom]);

  // Re-render edge labels when zoom changes
  useEffect(() => {
    if (!mapRef.current || !quoteItems.length) return;

    // Clear old edge labels
    edgeLabelsRef.current.forEach(marker => marker.setMap(null));
    edgeLabelsRef.current = [];

    // Re-render edge labels with new zoom level
    quoteItems.forEach((item) => {
      const color = item.measurement.mapColor || '#3B82F6';

      if (item.measurement.type === 'area') {
        // Handle multiple segments if present
        const segmentsToRender = item.measurement.segments || (item.measurement.coordinates ? [item.measurement.coordinates] : []);
        
        segmentsToRender.forEach((segmentCoords) => {
          const latLngs = segmentCoords.map(coord => ({
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
        });

        if (item.measurement.isDimensional && item.measurement.dimensions && item.measurement.coordinates) {
          const latLngs = item.measurement.coordinates.map(coord => ({
            lat: coord[0],
            lng: coord[1]
          }));
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
      } else if (item.measurement.type === 'linear') {
        // Handle multiple segments if present
        const segmentsToRender = item.measurement.segments || (item.measurement.coordinates ? [item.measurement.coordinates] : []);
        
        segmentsToRender.forEach((segmentCoords) => {
          const latLngs = segmentCoords.map(coord => ({
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
        });
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

      // Track marker numbers by product ID for consistent numbering
      const markerCounters: Record<string, number> = {};

      // Render all measurements
      quoteItems.forEach((item, index) => {
        // Use the mapColor that was assigned when the measurement was created
        const color = item.measurement.mapColor || '#3B82F6';
        
        console.log(`🎨 Rendering item ${index} (${item.productName}, type: ${item.measurement.type})`);

        if (item.measurement.type === 'point' && item.measurement.pointLocations) {
          // Handle point measurements (e.g., individual trees)
          console.log(`  ➡️ Rendering ${item.measurement.pointLocations.length} point markers`);
          
          // Initialize counter for this product if not exists
          if (!markerCounters[item.productId]) {
            markerCounters[item.productId] = 0;
          }
          
          item.measurement.pointLocations.forEach((position) => {
            markerCounters[item.productId]++;
            const markerNumber = markerCounters[item.productId];
            
            const pointMarker = new google.maps.Marker({
              position: position, // Already in {lat, lng} format
              map: map,
              icon: {
                path: google.maps.SymbolPath.CIRCLE,
                scale: getZoomBasedMarkerScale(currentZoom),
                fillColor: color,
                fillOpacity: 0.9,
                strokeColor: '#ffffff',
                strokeWeight: 2,
              },
              label: {
                text: `${markerNumber}`,
                color: '#ffffff',
                fontSize: '11px',
                fontWeight: 'normal',
              },
              title: `${item.productName} - Location ${markerNumber}`,
            });
            pointMarkersRef.current.push(pointMarker);
          });
        }

        else if (item.measurement.type === 'area') {
          // Handle multiple segments if present
          const segmentsToRender = item.measurement.segments || (item.measurement.coordinates ? [item.measurement.coordinates] : []);
          
          segmentsToRender.forEach((segmentCoords, segmentIndex) => {
            const latLngs = segmentCoords.map(coord => ({
              lat: coord[0],
              lng: coord[1]
            }));
            
            console.log(`  ➡️ Rendering area polygon segment ${segmentIndex + 1} with ${latLngs.length} points`);

            const polygon = new google.maps.Polygon({
              paths: latLngs,
              fillColor: color,
              fillOpacity: 0.3,
              strokeColor: color,
              strokeWeight: 2,
            });
            polygon.setMap(map);
          });

          // Single label for total value
          if (segmentsToRender.length > 0) {
            const firstSegment = segmentsToRender[0];
            const areaBounds = new google.maps.LatLngBounds();
            firstSegment.forEach(coord => areaBounds.extend({ lat: coord[0], lng: coord[1] }));
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
          }

          // Edge measurements are rendered in separate useEffect
        } else if (item.measurement.type === 'linear') {
          // Handle multiple segments if present
          const segmentsToRender = item.measurement.segments || (item.measurement.coordinates ? [item.measurement.coordinates] : []);
          
          segmentsToRender.forEach((segmentCoords, segmentIndex) => {
            const latLngs = segmentCoords.map(coord => ({
              lat: coord[0],
              lng: coord[1]
            }));
            
            console.log(`  ➡️ Rendering linear path segment ${segmentIndex + 1} with ${latLngs.length} points`);

            const polyline = new google.maps.Polyline({
              path: latLngs,
              strokeColor: color,
              strokeWeight: 3,
            });
            polyline.setMap(map);
          });

          // Edge measurements are rendered in separate useEffect

          // Single label for total value
          if (segmentsToRender.length > 0) {
            const firstSegment = segmentsToRender[0];
            const midIndex = Math.floor(firstSegment.length / 2);
            const midPoint = { lat: firstSegment[midIndex][0], lng: firstSegment[midIndex][1] };
            new google.maps.Marker({
              position: midPoint,
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
                  className="h-auto w-full max-w-[300px] max-h-16 object-contain"
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
            {(() => {
              const { consolidatedMainProducts } = consolidateQuoteItems(items);
              const showPricing = settings.pricing_visibility === 'before_submit';
              
              return consolidatedMainProducts.map((product) => {
                
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

                const unitAbbr = getUnitAbbreviation(product.unitType);
                const showQuantity = product.totalQuantity > 1;
                
                return (
                  <div 
                    key={product.productId} 
                    className="border-l-4 pl-4 py-2 space-y-2"
                    style={{ borderLeftColor: product.color }}
                  >
                    {/* Header: Product name with color indicator and quantity */}
                    <div className="flex items-center gap-2">
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
                    {showPricing && (
                      <div className="space-y-2">
                        {/* Base Product Calculation - use shared pricing utility */}
                        {(() => {
                          const priceResult = calculateProductPrice(
                            {
                              baseUnitPrice: product.unitPrice,
                              quantity: product.totalQuantity,
                              unitType: product.unitType,
                              variations: product.variations?.map((v: any) => ({
                                name: v.name,
                                priceAdjustment: v.priceAdjustment || 0,
                                adjustmentType: v.adjustmentType || 'fixed'
                              }))
                            },
                            {
                              currency_symbol: settings.currency_symbol,
                              decimal_precision: settings.decimal_precision
                            }
                          );
                          
                          return (
                            <div className="text-sm text-muted-foreground pl-3">
                              {priceResult.displayEquation}
                            </div>
                          );
                        })()}
                        
                        {/* Traditional Add-ons */}
                        {product.traditionalAddons.length > 0 && (
                          <div className="space-y-1">
                            <div className="text-sm text-muted-foreground mt-2">Add-ons:</div>
                            {product.traditionalAddons.map((addon) => {
                              const addonQty = addon.instances.reduce((sum, inst) => sum + inst.addonData.quantity, 0);
                              
                              // Use shared addon display utility for consistent rendering
                              const addonDisplay = calculateAddonDisplay(
                                {
                                  name: addon.name,
                                  priceValue: addon.priceValue,
                                  priceType: addon.priceType || 'fixed',
                                  calculationType: addon.calculationType,
                                  quantity: addonQty,
                                  selectedOption: addon.selectedOption,
                                  selectedOptionPriceAdjustment: addon.selectedOptionPriceAdjustment
                                },
                                {
                                  totalQuantity: product.totalQuantity,
                                  unitPrice: product.unitPrice,
                                  adjustedUnitPrice: product.adjustedUnitPrice, // Use adjusted price
                                  unitType: product.unitType,
                                  variations: product.variations?.map((v: any) => ({
                                    height_value: v.height_value,
                                    unit_of_measurement: v.unit_of_measurement,
                                    affects_area_calculation: v.affects_area_calculation
                                  }))
                                },
                                {
                                  currency_symbol: settings.currency_symbol,
                                  decimal_precision: settings.decimal_precision
                                }
                              );
                              
                              return (
                                <div key={addon.id} className="text-sm text-muted-foreground pl-3">
                                  <span className="font-medium text-foreground">{addonDisplay.displayName}</span>: {addonDisplay.displayEquation} = <span className="font-semibold text-foreground">{formatExactPrice(addonDisplay.total, {
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
                                <div key={mapAddon.productId} className="flex items-start gap-2 text-sm text-muted-foreground pl-3">
                                  <div 
                                    className="w-3 h-3 rounded-full flex-shrink-0 mt-0.5" 
                                    style={{ backgroundColor: mapAddon.mapColor }}
                                  />
                                  <div className="flex-1">
                                    <span className="font-medium text-foreground">{mapAddon.productName}</span>: {mapAddon.totalQuantity} × {formatExactPrice(mapAddon.unitPrice, {
                                      currency_symbol: settings.currency_symbol,
                                      decimal_precision: settings.decimal_precision
                                    })}/{mapUnitAbbr} = <span className="font-semibold text-foreground">{formatExactPrice(mapAddon.totalLineTotal, {
                                      currency_symbol: settings.currency_symbol,
                                      decimal_precision: settings.decimal_precision
                                    })}</span>
                                  </div>
                                </div>
                              );
                            })}
                          </div>
                        )}
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
