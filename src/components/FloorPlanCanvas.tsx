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

  useEffect(() => {
    drawCanvas();
  }, [rooms, selectedRoom, terrainDimensions]);

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

  const drawTerrain = (ctx: CanvasRenderingContext2D) => {
    const scale = Math.min(CANVAS_WIDTH / terrainDimensions.width, CANVAS_HEIGHT / terrainDimensions.height) * 0.8;
    const scaledWidth = terrainDimensions.width * scale;
    const scaledHeight = terrainDimensions.height * scale;
    const offsetX = (CANVAS_WIDTH - scaledWidth) / 2;
    const offsetY = (CANVAS_HEIGHT - scaledHeight) / 2;

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
      kitchen: '#bbf7d0'
    };

    const roomBorders = {
      bedroom: '#8b5cf6',
      bathroom: '#3b82f6',
      living: '#f97316',
      kitchen: '#10b981'
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
    
    ctx.fillText(room.name, centerX, centerY - 5);
    ctx.fillText(`${room.dimensions.width}×${room.dimensions.height}m`, centerX, centerY + 10);
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
    const point = snapToGrid({
      x: e.clientX - rect.left,
      y: e.clientY - rect.top
    });

    if (activeTool === 'select') {
      // Check if clicking on a room
      const clickedRoom = rooms.find(room => 
        point.x >= room.position.x &&
        point.x <= room.position.x + room.dimensions.width &&
        point.y >= room.position.y &&
        point.y <= room.position.y + room.dimensions.height
      );
      onRoomSelect(clickedRoom || null);
    } else if (['bedroom', 'bathroom', 'living', 'kitchen'].includes(activeTool)) {
      setIsDrawing(true);
      setStartPoint(point);
    }
  };

  const handleMouseUp = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (!isDrawing || !startPoint) return;

    const canvas = canvasRef.current;
    if (!canvas) return;

    const rect = canvas.getBoundingClientRect();
    const endPoint = snapToGrid({
      x: e.clientX - rect.left,
      y: e.clientY - rect.top
    });

    const width = Math.abs(endPoint.x - startPoint.x);
    const height = Math.abs(endPoint.y - startPoint.y);

    if (width > GRID_SIZE && height > GRID_SIZE) {
      const roomTypeNames = {
        bedroom: 'Alcoba',
        bathroom: 'Baño',
        living: 'Sala',
        kitchen: 'Cocina'
      };

      const newRoom: Room = {
        id: Date.now().toString(),
        type: activeTool as 'bedroom' | 'bathroom' | 'living' | 'kitchen',
        name: `${roomTypeNames[activeTool as keyof typeof roomTypeNames]} ${rooms.filter(r => r.type === activeTool).length + 1}`,
        position: {
          x: Math.min(startPoint.x, endPoint.x),
          y: Math.min(startPoint.y, endPoint.y)
        },
        dimensions: {
          width: width,
          height: height
        },
        color: activeTool
      };

      onRoomAdd(newRoom);
    }

    setIsDrawing(false);
    setStartPoint(null);
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
            onMouseUp={handleMouseUp}
          />
        </div>
        <div className="mt-4 text-sm text-muted-foreground">
          {activeTool === 'select' 
            ? 'Haz clic en una habitación para seleccionarla' 
            : `${activeTool === 'bedroom' ? 'Dibuja una alcoba' : 
                activeTool === 'bathroom' ? 'Dibuja un baño' :
                activeTool === 'living' ? 'Dibuja la sala' :
                activeTool === 'kitchen' ? 'Dibuja la cocina' : 'Selecciona una herramienta'} arrastrando en el lienzo`}
        </div>
      </div>
    </div>
  );
};