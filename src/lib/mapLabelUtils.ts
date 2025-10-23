interface LabelBounds {
  north: number;
  south: number;
  east: number;
  west: number;
}

export class SmartLabelPositioner {
  private occupiedSpaces: LabelBounds[] = [];
  private mapBounds: google.maps.LatLngBounds;
  private labelWidth = 0.0001; // degrees
  private labelHeight = 0.00005; // degrees
  private minDistance = 0.00008; // minimum distance between labels

  constructor(mapBounds: google.maps.LatLngBounds) {
    this.mapBounds = mapBounds;
  }

  // Find optimal position for label that doesn't overlap
  findOptimalPosition(
    anchor: google.maps.LatLng,
    preferredDirection: 'N' | 'S' | 'E' | 'W' | 'NE' | 'NW' | 'SE' | 'SW'
  ): google.maps.LatLng {
    const directions = this.getDirectionPriority(preferredDirection);
    
    for (const dir of directions) {
      const candidate = this.calculatePositionInDirection(anchor, dir);
      if (this.isPositionValid(candidate)) {
        this.occupySpace(candidate);
        return candidate;
      }
    }
    
    // Fallback: place above anchor
    const fallback = new google.maps.LatLng(
      anchor.lat() + 0.0001,
      anchor.lng()
    );
    this.occupySpace(fallback);
    return fallback;
  }

  private getDirectionPriority(preferred: string): string[] {
    const all = ['N', 'NE', 'E', 'SE', 'S', 'SW', 'W', 'NW'];
    return [preferred, ...all.filter(d => d !== preferred)];
  }

  private calculatePositionInDirection(
    anchor: google.maps.LatLng,
    direction: string
  ): google.maps.LatLng {
    const offsetLat = 0.0001;
    const offsetLng = 0.0001;
    
    const offsets: Record<string, { lat: number; lng: number }> = {
      N: { lat: offsetLat * 1.5, lng: 0 },
      S: { lat: -offsetLat * 1.5, lng: 0 },
      E: { lat: 0, lng: offsetLng * 1.5 },
      W: { lat: 0, lng: -offsetLng * 1.5 },
      NE: { lat: offsetLat, lng: offsetLng },
      NW: { lat: offsetLat, lng: -offsetLng },
      SE: { lat: -offsetLat, lng: offsetLng },
      SW: { lat: -offsetLat, lng: -offsetLng },
    };
    
    const offset = offsets[direction] || offsets.N;
    return new google.maps.LatLng(
      anchor.lat() + offset.lat,
      anchor.lng() + offset.lng
    );
  }

  private isPositionValid(position: google.maps.LatLng): boolean {
    const bounds = this.getBoundsForPosition(position);
    
    // Check if within map bounds
    if (!this.mapBounds.contains(position)) return false;
    
    // Check for overlaps with existing labels
    for (const occupied of this.occupiedSpaces) {
      if (this.boundsOverlap(bounds, occupied)) return false;
    }
    
    return true;
  }

  private boundsOverlap(a: LabelBounds, b: LabelBounds): boolean {
    return !(
      a.east < b.west ||
      a.west > b.east ||
      a.north < b.south ||
      a.south > b.north
    );
  }

  private getBoundsForPosition(position: google.maps.LatLng): LabelBounds {
    return {
      north: position.lat() + this.labelHeight / 2,
      south: position.lat() - this.labelHeight / 2,
      east: position.lng() + this.labelWidth / 2,
      west: position.lng() - this.labelWidth / 2,
    };
  }

  private occupySpace(position: google.maps.LatLng) {
    this.occupiedSpaces.push(this.getBoundsForPosition(position));
  }
}

// Calculate scale factor based on zoom level
export function getZoomScaleFactor(zoomLevel: number): number {
  // Zoom levels typically range from 1 (world) to 20 (buildings)
  // We want labels to be larger at higher zoom levels
  if (zoomLevel >= 18) return 1.5;
  if (zoomLevel >= 16) return 1.3;
  if (zoomLevel >= 14) return 1.1;
  if (zoomLevel >= 12) return 1.0;
  if (zoomLevel >= 10) return 0.9;
  return 0.8;
}
