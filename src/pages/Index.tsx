import { useState } from 'react';
import { FloorPlanCanvas } from '@/components/FloorPlanCanvas';
import { ToolPanel } from '@/components/ToolPanel';
import { PropertiesPanel } from '@/components/PropertiesPanel';
import { Button } from '@/components/ui/button';
import { Room, ToolType, Dimensions } from '@/types/floorplan';
import { Save, Download, RotateCcw, Eye } from 'lucide-react';
import { toast } from 'sonner';

const Index = () => {
  const [activeTool, setActiveTool] = useState<ToolType>('select');
  const [rooms, setRooms] = useState<Room[]>([]);
  const [selectedRoom, setSelectedRoom] = useState<Room | null>(null);
  const [terrainDimensions, setTerrainDimensions] = useState<Dimensions>({
    width: 20,
    height: 15
  });

  const handleRoomAdd = (room: Room) => {
    setRooms(prev => [...prev, room]);
    setSelectedRoom(room);
    setActiveTool('select');
    toast.success(`${room.name} agregada al plano`);
  };

  const handleRoomUpdate = (updatedRoom: Room) => {
    setRooms(prev => prev.map(room => 
      room.id === updatedRoom.id ? updatedRoom : room
    ));
    setSelectedRoom(updatedRoom);
  };

  const handleRoomDelete = (roomId: string) => {
    setRooms(prev => prev.filter(room => room.id !== roomId));
    setSelectedRoom(null);
    toast.success('Habitación eliminada');
  };

  const handleRoomSelect = (room: Room | null) => {
    setSelectedRoom(room);
  };

  const handleTerrainUpdate = (dimensions: Dimensions) => {
    setTerrainDimensions(dimensions);
    toast.success('Dimensiones del terreno actualizadas');
  };

  const handleSave = () => {
    const floorPlanData = {
      terrainDimensions,
      rooms,
      timestamp: new Date().toISOString()
    };
    localStorage.setItem('floorplan', JSON.stringify(floorPlanData));
    toast.success('Plano guardado exitosamente');
  };

  const handleClear = () => {
    setRooms([]);
    setSelectedRoom(null);
    setTerrainDimensions({ width: 20, height: 15 });
    toast.success('Plano reiniciado');
  };

  const getRoomStats = () => {
    const stats = {
      bedrooms: rooms.filter(r => r.type === 'bedroom').length,
      bathrooms: rooms.filter(r => r.type === 'bathroom').length,
      living: rooms.filter(r => r.type === 'living').length,
      kitchen: rooms.filter(r => r.type === 'kitchen').length,
      totalArea: rooms.reduce((acc, room) => acc + (room.dimensions.width * room.dimensions.height), 0)
    };
    return stats;
  };

  const stats = getRoomStats();

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="bg-card border-b border-border px-6 py-4">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold bg-gradient-to-r from-primary to-accent bg-clip-text text-transparent">
              Diseñador de Planos
            </h1>
            <p className="text-sm text-muted-foreground">
              Crea y personaliza planos de vivienda en 2D
            </p>
          </div>

          {/* Stats */}
          <div className="hidden md:flex items-center gap-6 text-sm">
            <div className="text-center">
              <div className="font-semibold text-primary">{stats.bedrooms}</div>
              <div className="text-muted-foreground">Alcobas</div>
            </div>
            <div className="text-center">
              <div className="font-semibold text-primary">{stats.bathrooms}</div>
              <div className="text-muted-foreground">Baños</div>
            </div>
            <div className="text-center">
              <div className="font-semibold text-primary">{stats.totalArea.toFixed(1)}m²</div>
              <div className="text-muted-foreground">Área Total</div>
            </div>
          </div>

          {/* Actions */}
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" onClick={handleClear}>
              <RotateCcw className="h-4 w-4 mr-2" />
              Limpiar
            </Button>
            <Button variant="outline" size="sm">
              <Eye className="h-4 w-4 mr-2" />
              Vista 3D
            </Button>
            <Button variant="outline" size="sm">
              <Download className="h-4 w-4 mr-2" />
              Exportar
            </Button>
            <Button size="sm" onClick={handleSave}>
              <Save className="h-4 w-4 mr-2" />
              Guardar
            </Button>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <div className="flex h-[calc(100vh-80px)]">
        {/* Left Panel - Tools */}
        <ToolPanel 
          activeTool={activeTool}
          onToolChange={setActiveTool}
        />

        {/* Center - Canvas */}
        <FloorPlanCanvas
          activeTool={activeTool}
          rooms={rooms}
          onRoomAdd={handleRoomAdd}
          onRoomSelect={handleRoomSelect}
          selectedRoom={selectedRoom}
          terrainDimensions={terrainDimensions}
        />

        {/* Right Panel - Properties */}
        <PropertiesPanel
          selectedRoom={selectedRoom}
          onRoomUpdate={handleRoomUpdate}
          onRoomDelete={handleRoomDelete}
          terrainDimensions={terrainDimensions}
          onTerrainUpdate={handleTerrainUpdate}
        />
      </div>
    </div>
  );
};

export default Index;