import { useEffect, useRef, useState } from 'react';

interface TouchLoupeProps {
  mapContainer: HTMLDivElement | null;
  isActive: boolean;
  touchPosition: { x: number; y: number } | null;
  mapInstance: google.maps.Map | null;
  magnification?: number;
}

export const TouchLoupe = ({ 
  mapContainer, 
  isActive, 
  touchPosition, 
  mapInstance,
  magnification = 2.5 
}: TouchLoupeProps) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [loupePosition, setLoupePosition] = useState<{ x: number; y: number } | null>(null);
  const [showBelow, setShowBelow] = useState(false);
  
  const LOUPE_SIZE = 120; // Diameter of the loupe
  const OFFSET_Y = 80; // Distance above/below the finger
  
  useEffect(() => {
    if (!isActive || !touchPosition || !mapContainer || !mapInstance || !canvasRef.current) {
      setLoupePosition(null);
      return;
    }
    
    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    
    // Determine if loupe should be below (if touch is near top of screen)
    const shouldShowBelow = touchPosition.y < LOUPE_SIZE + OFFSET_Y + 20;
    setShowBelow(shouldShowBelow);
    
    // Calculate loupe position
    const loupeX = touchPosition.x;
    const loupeY = shouldShowBelow 
      ? touchPosition.y + OFFSET_Y 
      : touchPosition.y - OFFSET_Y;
    
    setLoupePosition({ x: loupeX, y: loupeY });
    
    // Render magnified map section
    try {
      // Get the map's canvas element
      const mapCanvas = mapContainer.querySelector('canvas') as HTMLCanvasElement;
      if (!mapCanvas) return;
      
      // Calculate the source area to magnify (area under the finger)
      const sourceSize = LOUPE_SIZE / magnification;
      const sourceX = touchPosition.x - sourceSize / 2;
      const sourceY = touchPosition.y - sourceSize / 2;
      
      // Clear canvas
      ctx.clearRect(0, 0, LOUPE_SIZE, LOUPE_SIZE);
      
      // Create circular clipping path
      ctx.save();
      ctx.beginPath();
      ctx.arc(LOUPE_SIZE / 2, LOUPE_SIZE / 2, LOUPE_SIZE / 2, 0, Math.PI * 2);
      ctx.clip();
      
      // Draw magnified portion
      ctx.drawImage(
        mapCanvas,
        sourceX, sourceY, sourceSize, sourceSize, // Source rectangle
        0, 0, LOUPE_SIZE, LOUPE_SIZE // Destination rectangle
      );
      
      ctx.restore();
      
      // Draw border
      ctx.beginPath();
      ctx.arc(LOUPE_SIZE / 2, LOUPE_SIZE / 2, LOUPE_SIZE / 2 - 2, 0, Math.PI * 2);
      ctx.strokeStyle = 'rgba(255, 255, 255, 0.9)';
      ctx.lineWidth = 3;
      ctx.stroke();
      
      // Draw outer shadow border
      ctx.beginPath();
      ctx.arc(LOUPE_SIZE / 2, LOUPE_SIZE / 2, LOUPE_SIZE / 2, 0, Math.PI * 2);
      ctx.strokeStyle = 'rgba(0, 0, 0, 0.3)';
      ctx.lineWidth = 1;
      ctx.stroke();
      
      // Draw crosshair
      const centerX = LOUPE_SIZE / 2;
      const centerY = LOUPE_SIZE / 2;
      const crosshairSize = 15;
      
      ctx.strokeStyle = 'rgba(255, 59, 48, 0.9)'; // Red crosshair
      ctx.lineWidth = 2;
      
      // Horizontal line
      ctx.beginPath();
      ctx.moveTo(centerX - crosshairSize, centerY);
      ctx.lineTo(centerX + crosshairSize, centerY);
      ctx.stroke();
      
      // Vertical line
      ctx.beginPath();
      ctx.moveTo(centerX, centerY - crosshairSize);
      ctx.lineTo(centerX, centerY + crosshairSize);
      ctx.stroke();
      
      // Draw center dot
      ctx.beginPath();
      ctx.arc(centerX, centerY, 3, 0, Math.PI * 2);
      ctx.fillStyle = 'rgba(255, 59, 48, 0.9)';
      ctx.fill();
      
    } catch (error) {
      console.error('Error rendering touch loupe:', error);
    }
  }, [isActive, touchPosition, mapContainer, mapInstance, magnification]);
  
  if (!isActive || !loupePosition) {
    return null;
  }
  
  return (
    <div
      className="pointer-events-none fixed z-[10000]"
      style={{
        left: `${loupePosition.x}px`,
        top: `${loupePosition.y}px`,
        transform: 'translate(-50%, -50%)',
      }}
    >
      <canvas
        ref={canvasRef}
        width={LOUPE_SIZE}
        height={LOUPE_SIZE}
        className="animate-in fade-in zoom-in-95 duration-150"
        style={{
          width: `${LOUPE_SIZE}px`,
          height: `${LOUPE_SIZE}px`,
          filter: 'drop-shadow(0 4px 12px rgba(0, 0, 0, 0.4))',
        }}
      />
      {/* Helper text */}
      <div 
        className="absolute left-1/2 -translate-x-1/2 bg-background/95 text-foreground px-3 py-1.5 rounded-full text-xs font-medium whitespace-nowrap shadow-lg border border-border"
        style={{
          top: showBelow ? `${LOUPE_SIZE + 12}px` : `-${36}px`,
        }}
      >
        Magnified {magnification}x
      </div>
    </div>
  );
};
