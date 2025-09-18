import { useRef, useEffect, useState } from 'react';
import { Room, Point, Dimensions, ToolType } from '@/types/floorplan';

interface FloorPlanCanvasProps {
  activeTool: ToolType;
  rooms: Room[];
  onRoomAdd: (room: Room) => void;
  onRoomSelect: (room: Room | null) => void;
  selectedRoom: Room | null;
  terrainDimensions: Dimensions;
}

const CANVAS_WIDTH = 800;
const CANVAS_HEIGHT = 600;
const GRID_SIZE = 20;

export const FloorPlanCanvas = ({
  activeTool,
  rooms,
  onRoomAdd,
  onRoomSelect,
  selectedRoom,
  terrainDimensions
}: FloorPlanCanvasProps) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [isDrawing, setIsDrawing] = useState(false);
  const [startPoint, setStartPoint] = useState<Point | null>(null);
  const [currentPoint, setCurrentPoint] = useState<Point | null>(null);

  useEffect(() => {
    drawCanvas();
  }, [rooms, selectedRoom, terrainDimensions, isDrawing, startPoint, currentPoint]);

  const drawCanvas = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // Clear canvas
    ctx.clearRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);

    // Draw grid
    drawGrid(ctx);

    // Draw terrain boundary
    drawTerrain(ctx);

    // Draw rooms
    rooms.forEach(room => {
      drawRoom(ctx, room, room.id === selectedRoom?.id);
    });

    // Draw preview rectangle while drawing
    if (isDrawing && startPoint && currentPoint) {
      drawPreviewRoom(ctx);
    }
  };

  const drawGrid = (ctx: CanvasRenderingContext2D) => {
    ctx.strokeStyle = '#e5e7eb';
    ctx.lineWidth = 0.5;

    for (let x = 0; x <= CANVAS_WIDTH; x += GRID_SIZE) {
      ctx.beginPath();
      ctx.moveTo(x, 0);
      ctx.lineTo(x, CANVAS_HEIGHT);
      ctx.stroke();
    }

    for (let y = 0; y <= CANVAS_HEIGHT; y += GRID_SIZE) {
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(CANVAS_WIDTH, y);
      ctx.stroke();
    }
  };

  const getTerrainBounds = () => {
    const scale = Math.min(CANVAS_WIDTH / terrainDimensions.width, CANVAS_HEIGHT / terrainDimensions.height) * 0.8;
    const scaledWidth = terrainDimensions.width * scale;
    const scaledHeight = terrainDimensions.height * scale;
    const offsetX = (CANVAS_WIDTH - scaledWidth) / 2;
    const offsetY = (CANVAS_HEIGHT - scaledHeight) / 2;
    return { offsetX, offsetY, scaledWidth, scaledHeight, scale };
  };

  const drawTerrain = (ctx: CanvasRenderingContext2D) => {
    const { offsetX, offsetY, scaledWidth, scaledHeight } = getTerrainBounds();

    ctx.strokeStyle = '#374151';
    ctx.lineWidth = 2;
    ctx.strokeRect(offsetX, offsetY, scaledWidth, scaledHeight);

    // Draw terrain label
    ctx.fillStyle = '#6b7280';
    ctx.font = '12px Inter';
    ctx.fillText(`Terreno: ${terrainDimensions.width}m × ${terrainDimensions.height}m`, offsetX, offsetY - 10);
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
      balcony: '#0284c7',
      office: '#ca8a04',
      dining: '#db2777',
      storage: '#64748b'
    };

    // Draw room rectangle
    ctx.fillStyle = roomColors[room.type];
    ctx.strokeStyle = isSelected ? '#ef4444' : roomBorders[room.type];
    ctx.lineWidth = isSelected ? 3 : 2;

    ctx.fillRect(room.position.x, room.position.y, room.dimensions.width, room.dimensions.height);
    ctx.strokeRect(room.position.x, room.position.y, room.dimensions.width, room.dimensions.height);

    // Draw room label
    ctx.fillStyle = '#374151';
    ctx.font = '12px Inter';
    ctx.textAlign = 'center';
    const centerX = room.position.x + room.dimensions.width / 2;
    const centerY = room.position.y + room.dimensions.height / 2;
    
    const widthMeters = (room.dimensions.width / getTerrainBounds().scale).toFixed(1);
    const heightMeters = (room.dimensions.height / getTerrainBounds().scale).toFixed(1);
    
    ctx.fillText(room.name, centerX, centerY - 5);
    ctx.fillText(`${widthMeters}×${heightMeters}m`, centerX, centerY + 10);
  };

  const drawPreviewRoom = (ctx: CanvasRenderingContext2D) => {
    if (!startPoint || !currentPoint) return;

    const width = Math.abs(currentPoint.x - startPoint.x);
    const height = Math.abs(currentPoint.y - startPoint.y);
    const x = Math.min(startPoint.x, currentPoint.x);
    const y = Math.min(startPoint.y, currentPoint.y);

    // Convert pixels to meters using terrain scale
    const { scale } = getTerrainBounds();
    const widthMeters = (width / scale).toFixed(1);
    const heightMeters = (height / scale).toFixed(1);
    const areaMeters = (parseFloat(widthMeters) * parseFloat(heightMeters)).toFixed(1);

    // Draw preview rectangle
    ctx.strokeStyle = '#ef4444';
    ctx.fillStyle = 'rgba(239, 68, 68, 0.1)';
    ctx.lineWidth = 2;
    ctx.setLineDash([5, 5]);
    
    ctx.fillRect(x, y, width, height);
    ctx.strokeRect(x, y, width, height);
    
    ctx.setLineDash([]);

    // Draw dimensions
    ctx.fillStyle = '#374151';
    ctx.font = 'bold 14px Inter';
    ctx.textAlign = 'center';
    
    const centerX = x + width / 2;
    const centerY = y + height / 2;
    
    // Show dimensions and area
    ctx.fillText(`${widthMeters} × ${heightMeters}m`, centerX, centerY - 10);
    ctx.fillText(`Área: ${areaMeters}m²`, centerX, centerY + 10);
    
    // Show width dimension on top
    ctx.fillText(`${widthMeters}m`, centerX, y - 10);
    
    // Show height dimension on side
    ctx.save();
    ctx.translate(x - 15, centerY);
    ctx.rotate(-Math.PI / 2);
    ctx.fillText(`${heightMeters}m`, 0, 0);
    ctx.restore();
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

    const { offsetX, offsetY, scaledWidth, scaledHeight } = getTerrainBounds();
    
    // Allow starting from terrain bounds (including edges)
    if (point.x < offsetX - 5 || point.x > offsetX + scaledWidth + 5 || 
        point.y < offsetY - 5 || point.y > offsetY + scaledHeight + 5) {
      return;
    }

    if (activeTool === 'select') {
      const clickedRoom = rooms.find(room => 
        point.x >= room.position.x &&
        point.x <= room.position.x + room.dimensions.width &&
        point.y >= room.position.y &&
        point.y <= room.position.y + room.dimensions.height
      );
      onRoomSelect(clickedRoom || null);
    } else if (['bedroom', 'bathroom', 'living', 'kitchen', 'closet', 'garage', 'garden', 'laundry', 'stairs', 'balcony', 'office', 'dining', 'storage'].includes(activeTool)) {
      setIsDrawing(true);
      setStartPoint(point);
    }
  };

  const handleMouseMove = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (!isDrawing || !startPoint) return;

    const canvas = canvasRef.current;
    if (!canvas) return;

    const rect = canvas.getBoundingClientRect();
    const point = {
      x: e.clientX - rect.left,
      y: e.clientY - rect.top
    };

    setCurrentPoint(point);
  };

  const handleMouseUp = (e: React.MouseEvent<HTMLCanvasElement>) => {
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
        storage: 'Depósito'
      };

      const newRoom: Room = {
        id: Date.now().toString(),
        type: activeTool as 'bedroom' | 'bathroom' | 'living' | 'kitchen' | 'closet' | 'garage' | 'garden' | 'laundry' | 'stairs' | 'balcony' | 'office' | 'dining' | 'storage',
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
    <div className="flex-1 p-6">
      <div className="bg-card rounded-lg shadow-lg p-6">
        <h2 className="text-xl font-semibold mb-4">Vista 2D del Plano</h2>
        <div className="canvas-container rounded-lg border-2 border-canvas-border overflow-hidden">
          <canvas
            ref={canvasRef}
            width={CANVAS_WIDTH}
            height={CANVAS_HEIGHT}
            className="canvas-grid cursor-crosshair block"
            onMouseDown={handleMouseDown}
            onMouseMove={handleMouseMove}
            onMouseUp={handleMouseUp}
          />
        </div>
        <div className="mt-4 text-sm text-muted-foreground">
          {activeTool === 'select' 
            ? 'Haz clic en una habitación para seleccionarla' 
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
                activeTool === 'storage' ? 'el depósito' : 'una habitación'} arrastrando en el lienzo`}
        </div>
      </div>
    </div>
  );
};