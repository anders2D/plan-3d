import { useRef, useEffect, useState } from 'react';
import { Room, Point, Dimensions, ToolType } from '@/types/floorplan';

interface FloorPlanCanvasProps {
  activeTool: ToolType;
  rooms: Room[];
  onRoomAdd: (room: Room) => void;
  onRoomSelect: (room: Room | null) => void;
  onRoomUpdate: (room: Room) => void;
  selectedRoom: Room | null;
  terrainDimensions: Dimensions;
}

const CANVAS_WIDTH = 800;
const CANVAS_HEIGHT = 600;
const GRID_SIZE = 20;
const WALL_THICKNESS = 0.15; // 15cm en metros

export const FloorPlanCanvas = ({
  activeTool,
  rooms,
  onRoomAdd,
  onRoomSelect,
  onRoomUpdate,
  selectedRoom,
  terrainDimensions
}: FloorPlanCanvasProps) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [isDrawing, setIsDrawing] = useState(false);
  const [startPoint, setStartPoint] = useState<Point | null>(null);
  const [currentPoint, setCurrentPoint] = useState<Point | null>(null);
  const [showOnlyMeasures, setShowOnlyMeasures] = useState(false);
  const [showOnlyNames, setShowOnlyNames] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  const [dragOffset, setDragOffset] = useState<Point>({ x: 0, y: 0 });
  const [isPanning, setIsPanning] = useState(false);
  const [lastPanPoint, setLastPanPoint] = useState<Point | null>(null);
  const [isResizing, setIsResizing] = useState(false);
  const [resizeHandle, setResizeHandle] = useState<string>('');
  const [zoom, setZoom] = useState(1);
  const [panOffset, setPanOffset] = useState<Point>({ x: 0, y: 0 });
  const [isFullscreen, setIsFullscreen] = useState(false);

  useEffect(() => {
    drawCanvas();
  }, [rooms, selectedRoom, terrainDimensions, isDrawing, startPoint, currentPoint, showOnlyMeasures, showOnlyNames, zoom, panOffset, isFullscreen]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.ctrlKey && e.key === 'f') {
        e.preventDefault();
        setIsFullscreen(!isFullscreen);
      }
      if (e.key === 'Escape' && isFullscreen) {
        setIsFullscreen(false);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isFullscreen]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const handleWheel = (e: WheelEvent) => {
      e.preventDefault();
      const rect = canvas.getBoundingClientRect();
      const mouseX = e.clientX - rect.left;
      const mouseY = e.clientY - rect.top;
      
      const zoomFactor = e.deltaY > 0 ? 0.9 : 1.1;
      const newZoom = Math.max(0.5, Math.min(3, zoom * zoomFactor));
      
      // Zoom hacia el punto del mouse
      const zoomPoint = {
        x: (mouseX - panOffset.x) / zoom,
        y: (mouseY - panOffset.y) / zoom
      };
      
      setPanOffset({
        x: mouseX - zoomPoint.x * newZoom,
        y: mouseY - zoomPoint.y * newZoom
      });
      
      setZoom(newZoom);
    };

    canvas.addEventListener('wheel', handleWheel, { passive: false });
    return () => canvas.removeEventListener('wheel', handleWheel);
  }, [zoom, panOffset]);

  const drawCanvas = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const canvasWidth = isFullscreen ? window.innerWidth : CANVAS_WIDTH;
    const canvasHeight = isFullscreen ? window.innerHeight : CANVAS_HEIGHT;
    
    if (isFullscreen) {
      canvas.width = canvasWidth;
      canvas.height = canvasHeight;
    } else {
      canvas.width = CANVAS_WIDTH;
      canvas.height = CANVAS_HEIGHT;
    }

    // Clear and set background
    ctx.fillStyle = '#0d1117';
    ctx.fillRect(0, 0, canvasWidth, canvasHeight);
    
    // Apply zoom and pan transformations
    ctx.save();
    ctx.translate(panOffset.x, panOffset.y);
    ctx.scale(zoom, zoom);

    // Draw grid
    drawGrid(ctx);

    // Draw terrain boundary
    drawTerrain(ctx);

    // Draw rooms (sort by creation order to handle overlapping walls)
    const sortedRooms = [...rooms].sort((a, b) => parseInt(a.id) - parseInt(b.id));
    sortedRooms.forEach(room => {
      drawRoom(ctx, room, room.id === selectedRoom?.id);
    });

    // Draw preview rectangle while drawing
    if (isDrawing && startPoint && currentPoint) {
      drawPreviewRoom(ctx);
    }
    
    ctx.restore();
    
    // Draw zoom indicator and fullscreen info
    ctx.fillStyle = '#ffffff';
    ctx.font = '12px monospace';
    ctx.fillText(`Zoom: ${(zoom * 100).toFixed(0)}%`, 10, 20);
    if (isFullscreen) {
      ctx.fillText('Ctrl+F: Salir | ESC: Salir', 10, 40);
    } else {
      ctx.fillText('Ctrl+F: Pantalla completa', 10, 40);
    }
  };

  const drawGrid = (ctx: CanvasRenderingContext2D) => {
    const majorGridSize = GRID_SIZE * 5;
    const gridSize = GRID_SIZE;
    
    // Calculate visible area
    const startX = Math.floor(-panOffset.x / zoom / gridSize) * gridSize;
    const endX = Math.ceil((CANVAS_WIDTH - panOffset.x) / zoom / gridSize) * gridSize;
    const startY = Math.floor(-panOffset.y / zoom / gridSize) * gridSize;
    const endY = Math.ceil((CANVAS_HEIGHT - panOffset.y) / zoom / gridSize) * gridSize;
    
    // Draw grid lines
    for (let x = startX; x <= endX; x += gridSize) {
      ctx.lineWidth = (x % majorGridSize === 0) ? 1 / zoom : 0.3 / zoom;
      ctx.strokeStyle = (x % majorGridSize === 0) ? '#374151' : '#1f2937';
      ctx.beginPath();
      ctx.moveTo(x, startY);
      ctx.lineTo(x, endY);
      ctx.stroke();
    }

    for (let y = startY; y <= endY; y += gridSize) {
      ctx.lineWidth = (y % majorGridSize === 0) ? 1 / zoom : 0.3 / zoom;
      ctx.strokeStyle = (y % majorGridSize === 0) ? '#374151' : '#1f2937';
      ctx.beginPath();
      ctx.moveTo(startX, y);
      ctx.lineTo(endX, y);
      ctx.stroke();
    }
  };

  const getTerrainBounds = () => {
    const scale = 20; // Escala 1:5 (1m = 20px)
    const scaledWidth = terrainDimensions.width * scale;
    const scaledHeight = terrainDimensions.height * scale;
    const offsetX = (CANVAS_WIDTH - scaledWidth) / 2;
    const offsetY = (CANVAS_HEIGHT - scaledHeight) / 2;
    return { offsetX, offsetY, scaledWidth, scaledHeight, scale };
  };

  const drawTerrain = (ctx: CanvasRenderingContext2D) => {
    const { offsetX, offsetY, scaledWidth, scaledHeight } = getTerrainBounds();

    // Draw terrain boundary with construction lines
    ctx.strokeStyle = '#00ff00';
    ctx.lineWidth = 3;
    ctx.strokeRect(offsetX, offsetY, scaledWidth, scaledHeight);
    
    // Draw corner markers
    const cornerSize = 10;
    ctx.strokeStyle = '#ffff00';
    ctx.lineWidth = 2;
    
    // Corner markers
    const corners = [
      [offsetX, offsetY],
      [offsetX + scaledWidth, offsetY],
      [offsetX, offsetY + scaledHeight],
      [offsetX + scaledWidth, offsetY + scaledHeight]
    ];
    
    corners.forEach(([x, y]) => {
      ctx.beginPath();
      ctx.moveTo(x - cornerSize, y);
      ctx.lineTo(x + cornerSize, y);
      ctx.moveTo(x, y - cornerSize);
      ctx.lineTo(x, y + cornerSize);
      ctx.stroke();
    });

    // Draw terrain label with technical info
    ctx.fillStyle = '#00ff00';
    ctx.font = '12px monospace';
    ctx.fillText(`TERRENO: ${terrainDimensions.width}m × ${terrainDimensions.height}m`, offsetX, offsetY - 20);
    
    ctx.font = '10px monospace';
    ctx.fillStyle = '#ffff00';
    ctx.fillText(`AREA TOTAL: ${(terrainDimensions.width * terrainDimensions.height).toFixed(1)}M²`, offsetX, offsetY - 5);
    
    // Draw scale reference
    ctx.fillStyle = '#ffffff';
    ctx.font = '8px monospace';
    const scale = getTerrainBounds().scale;
    ctx.fillText(`ESCALA: 1:5`, offsetX + scaledWidth - 60, offsetY + scaledHeight + 15);
  };

  const drawRoom = (ctx: CanvasRenderingContext2D, room: Room, isSelected: boolean) => {
    const roomColors = {
      bedroom: '#ddd6fe',
      bathroom: '#bfdbfe',
      living: '#fed7aa',
      kitchen: '#bbf7d0',
      closet: '#f3e8ff',
      garage: '#e5e7eb',
      garden: '#dcfce7',
      laundry: '#dbeafe',
      stairs: '#fef3c7',
      hallway: '#f8fafc',
      balcony: '#e0f2fe',
      office: '#fef7cd',
      dining: '#fce7f3',
      storage: '#f1f5f9'
    };

    const roomBorders = {
      bedroom: '#8b5cf6',
      bathroom: '#3b82f6',
      living: '#f97316',
      kitchen: '#10b981',
      closet: '#a855f7',
      garage: '#6b7280',
      garden: '#16a34a',
      laundry: '#2563eb',
      stairs: '#eab308',
      hallway: '#64748b',
      balcony: '#0284c7',
      office: '#ca8a04',
      dining: '#db2777',
      storage: '#64748b'
    };

    const { scale } = getTerrainBounds();
    const wallThicknessPixels = WALL_THICKNESS * scale;
    
    // Check for adjacent rooms
    const adjacentRooms = {
      top: rooms.find(r => r.id !== room.id && 
        Math.abs(r.position.y + r.dimensions.height - room.position.y) < 5 &&
        !(r.position.x + r.dimensions.width <= room.position.x || r.position.x >= room.position.x + room.dimensions.width)),
      bottom: rooms.find(r => r.id !== room.id && 
        Math.abs(r.position.y - (room.position.y + room.dimensions.height)) < 5 &&
        !(r.position.x + r.dimensions.width <= room.position.x || r.position.x >= room.position.x + room.dimensions.width)),
      left: rooms.find(r => r.id !== room.id && 
        Math.abs(r.position.x + r.dimensions.width - room.position.x) < 5 &&
        !(r.position.y + r.dimensions.height <= room.position.y || r.position.y >= room.position.y + room.dimensions.height)),
      right: rooms.find(r => r.id !== room.id && 
        Math.abs(r.position.x - (room.position.x + room.dimensions.width)) < 5 &&
        !(r.position.y + r.dimensions.height <= room.position.y || r.position.y >= room.position.y + room.dimensions.height))
    };
    
    // AutoCAD style - No wall fills, only lines
    
    // No fill - AutoCAD style (only outlines)
    
    // Draw detailed walls with AutoCAD style
    const wallThickness = wallThicknessPixels;
    
    // Draw outer wall boundaries (thick cyan lines)
    ctx.strokeStyle = '#00ffff';
    ctx.lineWidth = 4;
    
    // Top wall
    if (!adjacentRooms.top) {
      ctx.beginPath();
      ctx.moveTo(room.position.x, room.position.y);
      ctx.lineTo(room.position.x + room.dimensions.width, room.position.y);
      ctx.stroke();
      // Inner wall line
      ctx.strokeStyle = '#ffffff';
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(room.position.x, room.position.y + wallThickness/2);
      ctx.lineTo(room.position.x + room.dimensions.width, room.position.y + wallThickness/2);
      ctx.stroke();
    }
    
    // Bottom wall
    if (!adjacentRooms.bottom) {
      ctx.strokeStyle = '#00ffff';
      ctx.lineWidth = 4;
      ctx.beginPath();
      ctx.moveTo(room.position.x, room.position.y + room.dimensions.height);
      ctx.lineTo(room.position.x + room.dimensions.width, room.position.y + room.dimensions.height);
      ctx.stroke();
      // Inner wall line
      ctx.strokeStyle = '#ffffff';
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(room.position.x, room.position.y + room.dimensions.height - wallThickness/2);
      ctx.lineTo(room.position.x + room.dimensions.width, room.position.y + room.dimensions.height - wallThickness/2);
      ctx.stroke();
    }
    
    // Left wall
    if (!adjacentRooms.left) {
      ctx.strokeStyle = '#00ffff';
      ctx.lineWidth = 4;
      ctx.beginPath();
      ctx.moveTo(room.position.x, room.position.y);
      ctx.lineTo(room.position.x, room.position.y + room.dimensions.height);
      ctx.stroke();
      // Inner wall line
      ctx.strokeStyle = '#ffffff';
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(room.position.x + wallThickness/2, room.position.y);
      ctx.lineTo(room.position.x + wallThickness/2, room.position.y + room.dimensions.height);
      ctx.stroke();
    }
    
    // Right wall
    if (!adjacentRooms.right) {
      ctx.strokeStyle = '#00ffff';
      ctx.lineWidth = 4;
      ctx.beginPath();
      ctx.moveTo(room.position.x + room.dimensions.width, room.position.y);
      ctx.lineTo(room.position.x + room.dimensions.width, room.position.y + room.dimensions.height);
      ctx.stroke();
      // Inner wall line
      ctx.strokeStyle = '#ffffff';
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(room.position.x + room.dimensions.width - wallThickness/2, room.position.y);
      ctx.lineTo(room.position.x + room.dimensions.width - wallThickness/2, room.position.y + room.dimensions.height);
      ctx.stroke();
    }
    
    // Draw division walls (thin red lines)
    ctx.strokeStyle = '#ff6b6b';
    ctx.lineWidth = 2;
    
    if (adjacentRooms.top) {
      ctx.beginPath();
      ctx.moveTo(room.position.x, room.position.y);
      ctx.lineTo(room.position.x + room.dimensions.width, room.position.y);
      ctx.stroke();
    }
    if (adjacentRooms.bottom) {
      ctx.beginPath();
      ctx.moveTo(room.position.x, room.position.y + room.dimensions.height);
      ctx.lineTo(room.position.x + room.dimensions.width, room.position.y + room.dimensions.height);
      ctx.stroke();
    }
    if (adjacentRooms.left) {
      ctx.beginPath();
      ctx.moveTo(room.position.x, room.position.y);
      ctx.lineTo(room.position.x, room.position.y + room.dimensions.height);
      ctx.stroke();
    }
    if (adjacentRooms.right) {
      ctx.beginPath();
      ctx.moveTo(room.position.x + room.dimensions.width, room.position.y);
      ctx.lineTo(room.position.x + room.dimensions.width, room.position.y + room.dimensions.height);
      ctx.stroke();
    }
    
    // Room outline (selection)
    ctx.strokeStyle = isSelected ? '#ffff00' : '#888888';
    ctx.lineWidth = isSelected ? 2 : 0.5;
    ctx.setLineDash(isSelected ? [] : [2, 2]);
    ctx.strokeRect(room.position.x, room.position.y, room.dimensions.width, room.dimensions.height);
    ctx.setLineDash([]);
    
    // Draw resize handles for selected room
    if (isSelected) {
      const handleSize = 6;
      ctx.fillStyle = '#ffff00';
      
      // Corner handles
      ctx.fillRect(room.position.x + room.dimensions.width - handleSize/2, room.position.y + room.dimensions.height - handleSize/2, handleSize, handleSize);
      
      // Edge handles
      ctx.fillRect(room.position.x + room.dimensions.width - handleSize/2, room.position.y + room.dimensions.height/2 - handleSize/2, handleSize, handleSize);
      ctx.fillRect(room.position.x + room.dimensions.width/2 - handleSize/2, room.position.y + room.dimensions.height - handleSize/2, handleSize, handleSize);
      ctx.fillRect(room.position.x - handleSize/2, room.position.y + room.dimensions.height/2 - handleSize/2, handleSize, handleSize);
      ctx.fillRect(room.position.x + room.dimensions.width/2 - handleSize/2, room.position.y - handleSize/2, handleSize, handleSize);
    }

    // AutoCAD style text and dimensions
    ctx.fillStyle = '#ffffff';
    ctx.font = '9px monospace';
    ctx.textAlign = 'center';
    const centerX = room.position.x + room.dimensions.width / 2;
    const centerY = room.position.y + room.dimensions.height / 2;
    
    const widthMeters = (room.dimensions.width / scale).toFixed(2);
    const heightMeters = (room.dimensions.height / scale).toFixed(2);
    const areaMeters = (parseFloat(widthMeters) * parseFloat(heightMeters)).toFixed(1);
    
    // Check for text overlap and adjust positioning
    const roomArea = room.dimensions.width * room.dimensions.height;
    const isSmallRoom = roomArea < 2000; // Less than 2000 pixels²
    const textOffset = isSmallRoom ? 0 : 15;
    
    // Show content based on mode with better spacing
    if (showOnlyNames) {
      // Only show room name
      ctx.fillText(room.name.toUpperCase(), centerX, centerY);
    } else if (showOnlyMeasures) {
      // Only show dimensions
      ctx.fillStyle = '#00ff00';
      ctx.font = '8px monospace';
      ctx.fillText(`${widthMeters} x ${heightMeters}M`, centerX, centerY - 5);
      ctx.fillText(`AREA: ${areaMeters}M²`, centerX, centerY + 8);
    } else {
      // Show both with smart positioning
      if (isSmallRoom) {
        // For small rooms, show only name
        ctx.fillText(room.name.toUpperCase(), centerX, centerY);
      } else {
        // For larger rooms, show all info with proper spacing
        ctx.fillText(room.name.toUpperCase(), centerX, centerY - textOffset);
        ctx.fillStyle = '#00ff00';
        ctx.font = '8px monospace';
        ctx.fillText(`${widthMeters} x ${heightMeters}M`, centerX, centerY);
        ctx.fillText(`AREA: ${areaMeters}M²`, centerX, centerY + textOffset);
      }
    }
    
    // Draw organized dimension lines only if not in special modes
    if (!showOnlyNames && !showOnlyMeasures) {
      ctx.strokeStyle = '#00ff00';
      ctx.lineWidth = 1;
      
      // Top dimension line
      const topY = room.position.y - 25;
      ctx.beginPath();
      ctx.moveTo(room.position.x, topY);
      ctx.lineTo(room.position.x + room.dimensions.width, topY);
      ctx.stroke();
      
      // Extension lines
      ctx.beginPath();
      ctx.moveTo(room.position.x, room.position.y);
      ctx.lineTo(room.position.x, topY - 5);
      ctx.moveTo(room.position.x + room.dimensions.width, room.position.y);
      ctx.lineTo(room.position.x + room.dimensions.width, topY - 5);
      ctx.stroke();
      
      // Dimension arrows
      const arrowSize = 3;
      ctx.beginPath();
      ctx.moveTo(room.position.x, topY);
      ctx.lineTo(room.position.x + arrowSize, topY - arrowSize/2);
      ctx.lineTo(room.position.x + arrowSize, topY + arrowSize/2);
      ctx.closePath();
      ctx.fill();
      
      ctx.beginPath();
      ctx.moveTo(room.position.x + room.dimensions.width, topY);
      ctx.lineTo(room.position.x + room.dimensions.width - arrowSize, topY - arrowSize/2);
      ctx.lineTo(room.position.x + room.dimensions.width - arrowSize, topY + arrowSize/2);
      ctx.closePath();
      ctx.fill();
      
      // Dimension text
      ctx.fillStyle = '#00ff00';
      ctx.font = '9px monospace';
      ctx.textAlign = 'center';
      ctx.fillText(`${widthMeters}m`, centerX, topY - 8);
      
      // Left dimension line
      const leftX = room.position.x - 25;
      ctx.strokeStyle = '#00ff00';
      ctx.beginPath();
      ctx.moveTo(leftX, room.position.y);
      ctx.lineTo(leftX, room.position.y + room.dimensions.height);
      ctx.stroke();
      
      // Extension lines
      ctx.beginPath();
      ctx.moveTo(room.position.x, room.position.y);
      ctx.lineTo(leftX + 5, room.position.y);
      ctx.moveTo(room.position.x, room.position.y + room.dimensions.height);
      ctx.lineTo(leftX + 5, room.position.y + room.dimensions.height);
      ctx.stroke();
      
      // Dimension arrows
      ctx.fillStyle = '#00ff00';
      ctx.beginPath();
      ctx.moveTo(leftX, room.position.y);
      ctx.lineTo(leftX - arrowSize/2, room.position.y + arrowSize);
      ctx.lineTo(leftX + arrowSize/2, room.position.y + arrowSize);
      ctx.closePath();
      ctx.fill();
      
      ctx.beginPath();
      ctx.moveTo(leftX, room.position.y + room.dimensions.height);
      ctx.lineTo(leftX - arrowSize/2, room.position.y + room.dimensions.height - arrowSize);
      ctx.lineTo(leftX + arrowSize/2, room.position.y + room.dimensions.height - arrowSize);
      ctx.closePath();
      ctx.fill();
      
      // Dimension text (rotated)
      ctx.save();
      ctx.translate(leftX - 12, centerY);
      ctx.rotate(-Math.PI / 2);
      ctx.textAlign = 'center';
      ctx.fillText(`${heightMeters}m`, 0, 0);
      ctx.restore();
    }
    

  };

  const drawPreviewRoom = (ctx: CanvasRenderingContext2D) => {
    if (!startPoint || !currentPoint) return;

    const width = Math.abs(currentPoint.x - startPoint.x);
    const height = Math.abs(currentPoint.y - startPoint.y);
    const x = Math.min(startPoint.x, currentPoint.x);
    const y = Math.min(startPoint.y, currentPoint.y);

    // Convert pixels to meters using terrain scale, accounting for wall thickness
    const { scale } = getTerrainBounds();
    const wallThicknessPixels = WALL_THICKNESS * scale;
    const interiorWidth = Math.max(0, (width - wallThicknessPixels) / scale);
    const interiorHeight = Math.max(0, (height - wallThicknessPixels) / scale);
    const widthMeters = interiorWidth.toFixed(1);
    const heightMeters = interiorHeight.toFixed(1);
    const areaMeters = (parseFloat(widthMeters) * parseFloat(heightMeters)).toFixed(1);

    // AutoCAD style preview
    ctx.strokeStyle = '#ffff00';
    ctx.lineWidth = 1;
    ctx.setLineDash([5, 5]);
    
    ctx.strokeRect(x, y, width, height);
    
    ctx.setLineDash([]);

    // AutoCAD style dimensions
    ctx.fillStyle = '#00ff00';
    ctx.font = '10px monospace';
    ctx.textAlign = 'center';
    
    const centerX = x + width / 2;
    const centerY = y + height / 2;
    
    ctx.fillText(`${widthMeters}x${heightMeters}M`, centerX, centerY);
    ctx.fillText(`AREA: ${areaMeters}M2`, centerX, centerY + 15);
  };

  const snapToGrid = (point: Point): Point => {
    return {
      x: Math.round(point.x / GRID_SIZE) * GRID_SIZE,
      y: Math.round(point.y / GRID_SIZE) * GRID_SIZE
    };
  };

  const handleMouseDown = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const rect = canvas.getBoundingClientRect();
    const point = {
      x: e.clientX - rect.left,
      y: e.clientY - rect.top
    };

    // Transform point to canvas coordinates considering zoom and pan
    const transformedPoint = {
      x: (point.x - panOffset.x) / zoom,
      y: (point.y - panOffset.y) / zoom
    };

    // Check if middle mouse button for panning
    if (e.button === 1 || (e.button === 0 && e.ctrlKey)) {
      setIsPanning(true);
      setLastPanPoint(point);
      return;
    }

    const { offsetX, offsetY, scaledWidth, scaledHeight } = getTerrainBounds();
    
    // Allow starting from terrain bounds (including edges)
    if (transformedPoint.x < offsetX - 5 || transformedPoint.x > offsetX + scaledWidth + 5 || 
        transformedPoint.y < offsetY - 5 || transformedPoint.y > offsetY + scaledHeight + 5) {
      // Start panning if outside terrain
      setIsPanning(true);
      setLastPanPoint(point);
      return;
    }

    if (activeTool === 'select') {
      const clickedRoom = rooms.find(room => 
        transformedPoint.x >= room.position.x &&
        transformedPoint.x <= room.position.x + room.dimensions.width &&
        transformedPoint.y >= room.position.y &&
        transformedPoint.y <= room.position.y + room.dimensions.height
      );
      
      if (clickedRoom) {
        onRoomSelect(clickedRoom);
        
        // Check if clicking on resize handles (edges)
        const handleSize = 8;
        const isOnRightEdge = transformedPoint.x >= clickedRoom.position.x + clickedRoom.dimensions.width - handleSize;
        const isOnBottomEdge = transformedPoint.y >= clickedRoom.position.y + clickedRoom.dimensions.height - handleSize;
        const isOnLeftEdge = transformedPoint.x <= clickedRoom.position.x + handleSize;
        const isOnTopEdge = transformedPoint.y <= clickedRoom.position.y + handleSize;
        
        if (isOnRightEdge && isOnBottomEdge) {
          setIsResizing(true);
          setResizeHandle('se');
        } else if (isOnRightEdge) {
          setIsResizing(true);
          setResizeHandle('e');
        } else if (isOnBottomEdge) {
          setIsResizing(true);
          setResizeHandle('s');
        } else if (isOnLeftEdge) {
          setIsResizing(true);
          setResizeHandle('w');
        } else if (isOnTopEdge) {
          setIsResizing(true);
          setResizeHandle('n');
        } else {
          setIsDragging(true);
          setDragOffset({
            x: transformedPoint.x - clickedRoom.position.x,
            y: transformedPoint.y - clickedRoom.position.y
          });
        }
      } else {
        onRoomSelect(null);
      }
    } else if (['bedroom', 'bathroom', 'living', 'kitchen', 'closet', 'garage', 'garden', 'laundry', 'stairs', 'balcony', 'office', 'dining', 'storage', 'hallway'].includes(activeTool)) {
      setIsDrawing(true);
      setStartPoint(transformedPoint);
    }
  };

  const handleMouseMove = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const rect = canvas.getBoundingClientRect();
    const point = {
      x: e.clientX - rect.left,
      y: e.clientY - rect.top
    };

    const transformedPoint = {
      x: (point.x - panOffset.x) / zoom,
      y: (point.y - panOffset.y) / zoom
    };

    if (isPanning && lastPanPoint) {
      const deltaX = point.x - lastPanPoint.x;
      const deltaY = point.y - lastPanPoint.y;
      
      setPanOffset(prev => ({
        x: prev.x + deltaX,
        y: prev.y + deltaY
      }));
      
      setLastPanPoint(point);
      return;
    }

    if (isDragging && selectedRoom) {
      const { offsetX, offsetY, scaledWidth, scaledHeight } = getTerrainBounds();
      const newX = Math.max(offsetX, Math.min(offsetX + scaledWidth - selectedRoom.dimensions.width, transformedPoint.x - dragOffset.x));
      const newY = Math.max(offsetY, Math.min(offsetY + scaledHeight - selectedRoom.dimensions.height, transformedPoint.y - dragOffset.y));
      
      const updatedRoom = {
        ...selectedRoom,
        position: { x: newX, y: newY }
      };
      onRoomUpdate(updatedRoom);
      onRoomSelect(updatedRoom);
      return;
    }
    
    if (isResizing && selectedRoom) {
      const { offsetX, offsetY, scaledWidth, scaledHeight } = getTerrainBounds();
      let newRoom = { ...selectedRoom };
      
      if (resizeHandle.includes('e')) {
        const newWidth = Math.max(20, Math.min(offsetX + scaledWidth - selectedRoom.position.x, transformedPoint.x - selectedRoom.position.x));
        newRoom.dimensions.width = newWidth;
      }
      if (resizeHandle.includes('s')) {
        const newHeight = Math.max(20, Math.min(offsetY + scaledHeight - selectedRoom.position.y, transformedPoint.y - selectedRoom.position.y));
        newRoom.dimensions.height = newHeight;
      }
      if (resizeHandle.includes('w')) {
        const newX = Math.max(offsetX, Math.min(selectedRoom.position.x + selectedRoom.dimensions.width - 20, transformedPoint.x));
        const newWidth = selectedRoom.position.x + selectedRoom.dimensions.width - newX;
        newRoom.position.x = newX;
        newRoom.dimensions.width = newWidth;
      }
      if (resizeHandle.includes('n')) {
        const newY = Math.max(offsetY, Math.min(selectedRoom.position.y + selectedRoom.dimensions.height - 20, transformedPoint.y));
        const newHeight = selectedRoom.position.y + selectedRoom.dimensions.height - newY;
        newRoom.position.y = newY;
        newRoom.dimensions.height = newHeight;
      }
      
      onRoomUpdate(newRoom);
      onRoomSelect(newRoom);
      return;
    }

    if (isDrawing && startPoint) {
      setCurrentPoint(transformedPoint);
    }
  };

  const handleMouseUp = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (isPanning) {
      setIsPanning(false);
      setLastPanPoint(null);
      return;
    }
    
    if (isDragging) {
      setIsDragging(false);
      setDragOffset({ x: 0, y: 0 });
      return;
    }
    
    if (isResizing) {
      setIsResizing(false);
      setResizeHandle('');
      return;
    }

    if (!isDrawing || !startPoint || !currentPoint) return;

    const { offsetX, offsetY, scaledWidth, scaledHeight } = getTerrainBounds();
    
    // Constrain room to terrain bounds
    const x1 = Math.max(offsetX, Math.min(offsetX + scaledWidth, Math.min(startPoint.x, currentPoint.x)));
    const y1 = Math.max(offsetY, Math.min(offsetY + scaledHeight, Math.min(startPoint.y, currentPoint.y)));
    const x2 = Math.max(offsetX, Math.min(offsetX + scaledWidth, Math.max(startPoint.x, currentPoint.x)));
    const y2 = Math.max(offsetY, Math.min(offsetY + scaledHeight, Math.max(startPoint.y, currentPoint.y)));
    
    const width = x2 - x1;
    const height = y2 - y1;

    if (width > 10 && height > 10) {
      const roomTypeNames = {
        bedroom: 'Alcoba',
        bathroom: 'Baño',
        living: 'Sala',
        kitchen: 'Cocina',
        closet: 'Closet',
        garage: 'Garaje',
        garden: 'Jardín',
        laundry: 'Lavandería',
        stairs: 'Escaleras',
        balcony: 'Balcón',
        office: 'Oficina',
        dining: 'Comedor',
        storage: 'Depósito',
        hallway: 'Pasillo'
      };

      const newRoom: Room = {
        id: Date.now().toString(),
        type: activeTool as 'bedroom' | 'bathroom' | 'living' | 'kitchen' | 'closet' | 'garage' | 'garden' | 'laundry' | 'stairs' | 'balcony' | 'office' | 'dining' | 'storage' | 'hallway',
        name: `${roomTypeNames[activeTool as keyof typeof roomTypeNames]} ${rooms.filter(r => r.type === activeTool).length + 1}`,
        position: { x: x1, y: y1 },
        dimensions: { width, height },
        color: activeTool
      };

      onRoomAdd(newRoom);
    }

    setIsDrawing(false);
    setStartPoint(null);
    setCurrentPoint(null);
  };

  return (
    <>
      {isFullscreen && (
        <div className="fixed inset-0 z-50 bg-black">
          <canvas
            ref={canvasRef}
            className="cursor-crosshair block w-full h-full"
            style={{ cursor: isPanning ? 'grabbing' : isDragging ? 'grabbing' : isResizing ? 'nw-resize' : 'default' }}
            onMouseDown={handleMouseDown}
            onMouseMove={handleMouseMove}
            onMouseUp={handleMouseUp}
          />
        </div>
      )}
      {!isFullscreen && (
        <div className="flex-1 p-6">
          <div className="bg-gray-900 rounded-lg shadow-lg p-6 border border-gray-700">
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-xl font-semibold text-green-400 font-mono">VISTA 2D DEL PLANO</h2>
              <div className="flex gap-2">
                <button
                  onClick={() => {
                    setShowOnlyMeasures(!showOnlyMeasures);
                    setShowOnlyNames(false);
                  }}
                  className={`px-3 py-1 text-xs rounded font-mono ${
                    showOnlyMeasures 
                      ? 'bg-green-600 text-white' 
                      : 'bg-gray-700 text-green-400 hover:bg-gray-600'
                  }`}
                >
                  MEDIDAS
                </button>
                <button
                  onClick={() => {
                    setShowOnlyNames(!showOnlyNames);
                    setShowOnlyMeasures(false);
                  }}
                  className={`px-3 py-1 text-xs rounded font-mono ${
                    showOnlyNames 
                      ? 'bg-green-600 text-white' 
                      : 'bg-gray-700 text-green-400 hover:bg-gray-600'
                  }`}
                >
                  NOMBRES
                </button>
              </div>
            </div>
            <div className="canvas-container rounded-lg border-2 border-canvas-border overflow-hidden">
              <canvas
                ref={canvasRef}
                width={CANVAS_WIDTH}
                height={CANVAS_HEIGHT}
                className="cursor-crosshair block"
                style={{ backgroundColor: '#0d1117', cursor: isPanning ? 'grabbing' : isDragging ? 'grabbing' : isResizing ? 'nw-resize' : 'default' }}
                onMouseDown={handleMouseDown}
                onMouseMove={handleMouseMove}
                onMouseUp={handleMouseUp}
              />
            </div>
            <div className="mt-4 text-sm text-green-400 font-mono">
              {activeTool === 'select' 
                ? 'Haz clic en una habitación para seleccionarla • Mantén clic para desplazarte • Ctrl+F: Pantalla completa' 
                : `Dibuja ${activeTool === 'bedroom' ? 'una alcoba' : 
                    activeTool === 'bathroom' ? 'un baño' :
                    activeTool === 'living' ? 'la sala' :
                    activeTool === 'kitchen' ? 'la cocina' :
                    activeTool === 'closet' ? 'un closet' :
                    activeTool === 'garage' ? 'el garaje' :
                    activeTool === 'garden' ? 'el jardín' :
                    activeTool === 'laundry' ? 'la lavandería' :
                    activeTool === 'stairs' ? 'las escaleras' :
                    activeTool === 'balcony' ? 'el balcón' :
                    activeTool === 'office' ? 'la oficina' :
                    activeTool === 'dining' ? 'el comedor' :
                    activeTool === 'storage' ? 'el depósito' :
                    activeTool === 'hallway' ? 'un pasillo' : 'una habitación'} arrastrando en el lienzo • Mantén clic para desplazarte • Ctrl+F: Pantalla completa`}
            </div>
          </div>
        </div>
      )}
    </>
  );
};