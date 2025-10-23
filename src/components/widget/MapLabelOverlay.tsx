import { getZoomScaleFactor } from '@/lib/mapLabelUtils';

interface MapLabelOverlayProps {
  position: google.maps.LatLng;
  anchor: google.maps.LatLng;
  text: string;
  productName: string;
  color: string;
  map: google.maps.Map;
  zoomLevel: number;
}

// Factory function to create LabelOverlay class after Google Maps is loaded
export function createLabelOverlay() {
  return class LabelOverlay extends google.maps.OverlayView {
    private position: google.maps.LatLng;
    private anchor: google.maps.LatLng;
    private text: string;
    private productName: string;
    private color: string;
    private div: HTMLDivElement | null = null;
    private leaderLine: google.maps.Polyline | null = null;
    private zoomLevel: number;

    constructor(props: MapLabelOverlayProps) {
      super();
      this.position = props.position;
      this.anchor = props.anchor;
      this.text = props.text;
      this.productName = props.productName;
      this.color = props.color;
      this.zoomLevel = props.zoomLevel;
      this.setMap(props.map);
    }

  onAdd() {
    const div = document.createElement('div');
    div.className = 'map-leader-label';
    
    const scaleFactor = getZoomScaleFactor(this.zoomLevel);
    const fontSize = 12 * scaleFactor;
    const padding = 6 * scaleFactor;
    
    div.style.cssText = `
      position: absolute;
      background: rgba(0, 0, 0, 0.85);
      color: white;
      padding: ${padding}px ${padding * 1.5}px;
      border-radius: 4px;
      font-size: ${fontSize}px;
      font-weight: 700;
      white-space: nowrap;
      box-shadow: 0 2px 6px rgba(0, 0, 0, 0.3);
      border: 2px solid ${this.color};
      pointer-events: none;
      z-index: 1000;
    `;
    
    div.innerHTML = `
      <div style="color: ${this.color}; margin-bottom: 2px; font-size: ${fontSize * 0.9}px;">${this.productName}</div>
      <div>${this.text}</div>
    `;
    
    this.div = div;
    const panes = this.getPanes();
    panes?.floatPane.appendChild(div);
    
    // Create leader line
    this.leaderLine = new google.maps.Polyline({
      path: [this.anchor, this.position],
      strokeColor: this.color,
      strokeWeight: 2 * scaleFactor,
      strokeOpacity: 0.8,
      map: this.getMap() as google.maps.Map,
      zIndex: 999,
    });
  }

  draw() {
    if (!this.div) return;
    
    const overlayProjection = this.getProjection();
    const pos = overlayProjection.fromLatLngToDivPixel(this.position);
    
    if (pos) {
      this.div.style.left = pos.x + 'px';
      this.div.style.top = pos.y + 'px';
      this.div.style.transform = 'translate(-50%, -100%)';
    }
  }

  onRemove() {
    if (this.div) {
      this.div.parentNode?.removeChild(this.div);
      this.div = null;
    }
    if (this.leaderLine) {
      this.leaderLine.setMap(null);
      this.leaderLine = null;
    }
  }

  updateZoom(zoomLevel: number) {
    this.zoomLevel = zoomLevel;
    this.onRemove();
    this.onAdd();
    this.draw();
  }

    updatePosition(position: google.maps.LatLng) {
      this.position = position;
      if (this.leaderLine) {
        this.leaderLine.setPath([this.anchor, this.position]);
      }
      this.draw();
    }
  };
}

// Export type for convenience
export type LabelOverlay = ReturnType<typeof createLabelOverlay>['prototype'];
