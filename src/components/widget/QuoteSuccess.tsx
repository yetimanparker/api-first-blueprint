import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Separator } from '@/components/ui/separator';
import { Switch } from '@/components/ui/switch';
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
import { formatExactPrice, calculatePriceRange, formatPriceRange } from '@/lib/priceUtils';
import { useEffect, useRef, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Loader } from '@googlemaps/js-api-loader';

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
  const [apiKey, setApiKey] = useState<string | null>(null);
  const [items, setItems] = useState<QuoteItem[]>(quoteItems);
  const mapRef = useRef<google.maps.Map | null>(null);
  const mapContainerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    fetchContractorInfo();
    fetchApiKey();
  }, []);

  useEffect(() => {
    if (apiKey && !mapRef.current) {
      initializeMap();
    }
  }, [apiKey]);

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

  const fetchApiKey = async () => {
    try {
      const { data, error } = await supabase.functions.invoke('get-google-maps-key');
      if (data?.apiKey) {
        setApiKey(data.apiKey);
      }
    } catch (error) {
      console.error('Error fetching API key:', error);
    }
  };

  const initializeMap = async () => {
    if (!mapContainerRef.current || !apiKey) return;

    try {
      const loader = new Loader({
        apiKey: apiKey,
        version: 'weekly',
        libraries: ['drawing', 'geometry'],
      });

      await loader.load();

      // Use first item's coordinates to center map
      const firstCoord = quoteItems[0]?.measurement?.coordinates?.[0];
      const center = firstCoord 
        ? { lat: firstCoord[0], lng: firstCoord[1] }
        : { lat: 39.8283, lng: -98.5795 };

      const map = new google.maps.Map(mapContainerRef.current, {
        center: center,
        zoom: 19,
        mapTypeId: google.maps.MapTypeId.HYBRID,
        disableDefaultUI: true,
        zoomControl: true,
      });

      mapRef.current = map;

      // Render all measurements
      const bounds = new google.maps.LatLngBounds();
      const colors = ['#10B981', '#3B82F6', '#F59E0B', '#8B5CF6', '#EC4899'];

      quoteItems.forEach((item, index) => {
        if (!item.measurement.coordinates || item.measurement.coordinates.length === 0) return;

        const color = colors[index % colors.length];
        const latLngs = item.measurement.coordinates.map(coord => ({
          lat: coord[0],
          lng: coord[1]
        }));

        // Extend bounds for each coordinate
        latLngs.forEach(coord => bounds.extend(coord));

        if (item.measurement.type === 'area') {
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
              text: `${item.productName}\n${item.measurement.value.toLocaleString()} sq ft`,
              color: color,
              fontSize: '12px',
              fontWeight: 'bold',
            },
          });
        } else if (item.measurement.type === 'linear') {
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
              text: `${item.productName}\n${item.measurement.value.toLocaleString()} ft`,
              color: color,
              fontSize: '12px',
              fontWeight: 'bold',
            },
          });
        }
      });

      // Fit bounds with padding and max zoom to ensure all measurements are visible
      if (!bounds.isEmpty()) {
        map.fitBounds(bounds, {
          top: 50,
          bottom: 50,
          left: 50,
          right: 50
        });
        
        // Set a max zoom level to prevent being too close
        const listener = google.maps.event.addListener(map, 'idle', () => {
          if (map.getZoom()! > 20) {
            map.setZoom(20);
          }
          google.maps.event.removeListener(listener);
        });
      }
    } catch (error) {
      console.error('Map initialization failed:', error);
    }
  };

  // Sync local items state with quoteItems prop
  useEffect(() => {
    setItems(quoteItems);
  }, [quoteItems]);

  const toggleAddon = (itemId: string, addonId: string) => {
    setItems(prevItems => prevItems.map(item => {
      if (item.id !== itemId) return item;
      
      const updatedAddons = item.measurement.addons?.map(addon => {
        if (addon.id === addonId) {
          const newQuantity = addon.quantity > 0 ? 0 : 1;
          return { ...addon, quantity: newQuantity };
        }
        return addon;
      }) || [];

      // Calculate quantity (use cubic yards if depth is provided)
      const quantity = item.measurement.depth 
        ? (item.measurement.value * item.measurement.depth) / 324 
        : item.measurement.value;

      // Recalculate line total
      let basePrice = quantity * item.unitPrice;
      
      // Apply variations
      if (item.measurement.variations && item.measurement.variations.length > 0) {
        item.measurement.variations.forEach(variation => {
          if (variation.adjustmentType === 'percentage') {
            basePrice += basePrice * (variation.priceAdjustment / 100);
          } else {
            basePrice += variation.priceAdjustment * quantity;
          }
        });
      }
      
      // Apply active addons
      let addonsTotal = 0;
      updatedAddons.forEach(addon => {
        if (addon.quantity > 0) {
          if (addon.calculationType === 'per_unit') {
            addonsTotal += addon.priceValue * quantity * addon.quantity;
          } else {
            addonsTotal += addon.priceValue * addon.quantity;
          }
        }
      });

      const newLineTotal = basePrice + addonsTotal;

      return {
        ...item,
        measurement: {
          ...item.measurement,
          addons: updatedAddons
        },
        lineTotal: newLineTotal
      };
    }));
  };

  const subtotal = items.reduce((sum, item) => sum + item.lineTotal, 0);
  const taxAmount = settings.global_tax_rate > 0 
    ? subtotal * (settings.global_tax_rate / 100)
    : 0;
  const total = subtotal + taxAmount;

  return (
    <div className="max-w-6xl mx-auto px-4 py-8 space-y-6">
      {/* Success Header */}
      <Card className="border-green-500 bg-green-50 dark:bg-green-950">
        <CardContent className="pt-6">
          <div className="flex items-center gap-4 mb-4">
            <CheckCircle2 className="h-12 w-12 text-green-600" />
            <div>
              <h1 className="text-2xl font-bold text-green-900 dark:text-green-100">
                Quote Submitted Successfully!
              </h1>
              <p className="text-green-700 dark:text-green-300">
                Quote #{quoteNumber} has been created
              </p>
            </div>
          </div>
          <p className="text-sm text-muted-foreground">
            We've received your quote request and will be in touch soon. Below is a detailed overview of your quote.
          </p>
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Main Quote Details */}
        <div className="lg:col-span-2 space-y-6">
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
                const quantity = item.measurement.depth 
                  ? (item.measurement.value * item.measurement.depth) / 324 
                  : item.measurement.value;
                const basePrice = quantity * item.unitPrice;
                const showPricing = settings.pricing_visibility === 'before_submit';
                
                return (
                  <div key={item.id} className="border-l-4 border-primary pl-4 py-2">
                    <div className="flex justify-between items-start mb-2">
                      <div>
                        <p className="font-semibold">{item.productName}</p>
                        <p className="text-sm text-muted-foreground">
                          {item.measurement.depth 
                            ? `${((item.measurement.value * item.measurement.depth) / 324).toFixed(2)} cubic yards (${item.measurement.value.toLocaleString()} sq ft × ${item.measurement.depth}" depth)`
                            : `${item.measurement.value.toLocaleString()} ${item.measurement.unit.replace('_', ' ')}`
                          }
                        </p>
                      </div>
                      {showPricing && (
                        <p className="font-bold text-lg">
                          {settings.use_price_ranges ? (
                            formatPriceRange(
                              calculatePriceRange(item.lineTotal, settings.price_range_lower_percentage, settings.price_range_upper_percentage),
                              settings
                            )
                          ) : (
                            formatExactPrice(item.lineTotal, {
                              currency_symbol: settings.currency_symbol,
                              decimal_precision: settings.decimal_precision
                            })
                          )}
                        </p>
                      )}
                    </div>

                    {/* Itemized breakdown - Always show variations/addons, pricing conditional */}
                    <div className="space-y-1 text-sm">
                      {showPricing && (
                        <div className="text-muted-foreground">
                          Base Price ({item.measurement.depth 
                            ? `${((item.measurement.value * item.measurement.depth) / 324).toFixed(2)} cu yd (${item.measurement.value.toLocaleString()} sq ft × ${item.measurement.depth}" depth)`
                            : `${item.measurement.value.toLocaleString()} ${item.measurement.unit.replace('_', ' ')}`
                          }
                          {' × '}{formatExactPrice(item.unitPrice, {
                            currency_symbol: settings.currency_symbol,
                            decimal_precision: settings.decimal_precision
                          })}): {settings.use_price_ranges ? (
                            formatPriceRange(
                              calculatePriceRange(basePrice, settings.price_range_lower_percentage, settings.price_range_upper_percentage),
                              settings
                            )
                          ) : (
                            formatExactPrice(basePrice, {
                              currency_symbol: settings.currency_symbol,
                              decimal_precision: settings.decimal_precision
                            })
                          )}
                        </div>
                      )}
                      
                      {/* Variations - Always show name, pricing conditional */}
                      {item.measurement.variations && item.measurement.variations.length > 0 && item.measurement.variations.map(v => {
                        const variationPrice = v.adjustmentType === 'percentage' 
                          ? basePrice * (v.priceAdjustment / 100)
                          : v.priceAdjustment * quantity;
                        
                        return (
                          <div key={v.id} className="text-muted-foreground">
                            {showPricing ? (
                              <>
                                {v.name}: +{formatExactPrice(variationPrice, {
                                  currency_symbol: settings.currency_symbol,
                                  decimal_precision: settings.decimal_precision
                                })}
                              </>
                            ) : (
                              <>{v.name}</>
                            )}
                          </div>
                        );
                      })}
                      
                      {/* Add-ons with Toggles - Always show, pricing conditional */}
                      {item.measurement.addons && item.measurement.addons.length > 0 && item.measurement.addons.map(addon => {
                        const addonPrice = addon.calculationType === 'per_unit'
                          ? addon.priceValue * quantity
                          : addon.priceValue;
                        const isEnabled = addon.quantity > 0;
                        
                        return (
                          <div key={addon.id} className="flex items-center gap-2">
                            <Switch
                              checked={isEnabled}
                              onCheckedChange={() => toggleAddon(item.id, addon.id)}
                              className="scale-90 data-[state=checked]:bg-blue-600"
                            />
                            <span className={isEnabled ? 'text-foreground' : 'text-muted-foreground line-through'}>
                              {showPricing ? (
                                <>
                                  {addon.name}: {addon.calculationType === 'per_unit' 
                                    ? `${quantity.toLocaleString()} ${item.measurement.depth ? 'cu yd' : item.measurement.unit.replace('_', ' ')} × ` 
                                    : `${addon.quantity.toFixed(1)} each × `
                                  }+{formatExactPrice(addonPrice * addon.quantity, {
                                    currency_symbol: settings.currency_symbol,
                                    decimal_precision: settings.decimal_precision
                                  })}
                                </>
                              ) : (
                                <>{addon.name}</>
                              )}
                            </span>
                          </div>
                        );
                      })}
                    </div>
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
