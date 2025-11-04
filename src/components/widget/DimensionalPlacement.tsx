// Helper functions for dimensional product placement with rotation and repositioning
/// <reference types="@types/google.maps" />

export const calculateRotatedRectangle = (
  centerLat: number,
  centerLng: number,
  widthFeet: number,
  lengthFeet: number,
  rotationDegrees: number
): Array<{lat: number, lng: number}> => {
  // Convert feet to meters
  const metersPerFoot = 0.3048;
  const widthMeters = widthFeet * metersPerFoot;
  const lengthMeters = lengthFeet * metersPerFoot;
  
  const halfWidth = widthMeters / 2;
  const halfLength = lengthMeters / 2;
  
  // Define corners in uniform METER space (before scaling)
  const corners = [
    { x: -halfWidth, y: halfLength },   // Top-left
    { x: halfWidth, y: halfLength },    // Top-right
    { x: halfWidth, y: -halfLength },   // Bottom-right
    { x: -halfWidth, y: -halfLength },  // Bottom-left
  ];
  
  // Apply rotation in uniform meter space
  const angleRad = (rotationDegrees * Math.PI) / 180;
  const rotatedMeters = corners.map(corner => ({
    x: corner.x * Math.cos(angleRad) - corner.y * Math.sin(angleRad),
    y: corner.x * Math.sin(angleRad) + corner.y * Math.cos(angleRad)
  }));
  
  // NOW convert rotated meter offsets to lat/lng offsets
  const latPerMeter = 1 / 111320;
  const lngPerMeter = 1 / (111320 * Math.cos(centerLat * Math.PI / 180));
  
  return rotatedMeters.map(meters => ({
    lat: centerLat + (meters.y * latPerMeter),
    lng: centerLng + (meters.x * lngPerMeter)
  }));
};

export const createDimensionalPolygon = (
  map: google.maps.Map,
  center: {lat: number, lng: number},
  width: number,
  length: number,
  rotation: number,
  color: string
): google.maps.Polygon => {
  const corners = calculateRotatedRectangle(center.lat, center.lng, width, length, rotation);
  
  return new google.maps.Polygon({
    paths: corners,
    fillColor: color,
    fillOpacity: 0.3,
    strokeColor: color,
    strokeWeight: 2,
    clickable: false,
    editable: false,
    zIndex: 1,
    map: map
  });
};

export const createRotationHandle = (
  map: google.maps.Map,
  center: {lat: number, lng: number},
  width: number,
  length: number,
  rotation: number,
  color: string
): google.maps.Marker => {
  const corners = calculateRotatedRectangle(center.lat, center.lng, width, length, rotation);
  const handlePosition = corners[1]; // Top-right corner
  
  return new google.maps.Marker({
    position: handlePosition,
    map: map,
    draggable: true,
    icon: {
      path: google.maps.SymbolPath.CIRCLE,
      fillColor: color,
      fillOpacity: 1,
      strokeColor: '#ffffff',
      strokeWeight: 2,
      scale: 8
    },
    title: 'Drag to rotate'
  });
};

export const createDragHandle = (
  map: google.maps.Map,
  center: {lat: number, lng: number},
  color: string
): google.maps.Marker => {
  return new google.maps.Marker({
    position: center,
    map: map,
    draggable: true,
    icon: {
      path: google.maps.SymbolPath.CIRCLE,
      fillColor: '#ffffff',
      fillOpacity: 1,
      strokeColor: color,
      strokeWeight: 3,
      scale: 10
    },
    label: {
      text: '✥',
      color: color,
      fontSize: '16px',
      fontWeight: 'bold'
    },
    title: 'Drag to move'
  });
};

export const calculateArea = (width: number, length: number): number => {
  return Math.ceil(width * length);
};
