export interface Point {
  x: number;
  y: number;
}

export interface Dimensions {
  width: number;
  height: number;
}

export interface Room {
  id: string;
  type: 'bedroom' | 'bathroom' | 'living' | 'kitchen' | 'closet' | 'garage' | 'garden' | 'laundry' | 'stairs' | 'balcony' | 'office' | 'dining' | 'storage' | 'hallway';
  name: string;
  position: Point;
  dimensions: Dimensions;
  color: string;
}

export interface FloorPlan {
  id: string;
  name: string;
  terrainDimensions: Dimensions;
  rooms: Room[];
  walls: Wall[];
  doors: Door[];
  windows: Window[];
}

export interface Wall {
  id: string;
  start: Point;
  end: Point;
  thickness: number;
  height: number;
}

export interface Door {
  id: string;
  position: Point;
  width: number;
  height: number;
  wallId?: string;
}

export interface Window {
  id: string;
  position: Point;
  width: number;
  height: number;
  wallId?: string;
}

export type ToolType = 'select' | 'bedroom' | 'bathroom' | 'living' | 'kitchen' | 'closet' | 'garage' | 'garden' | 'laundry' | 'stairs' | 'balcony' | 'office' | 'dining' | 'storage' | 'hallway' | 'wall' | 'door' | 'window';