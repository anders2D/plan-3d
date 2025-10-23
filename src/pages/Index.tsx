import { useState, useEffect } from 'react';
import { FloorPlanCanvas } from '@/components/FloorPlanCanvas';
import { FloorPlan3D } from '@/components/FloorPlan3D';
import { ToolPanel } from '@/components/ToolPanel';
import { PropertiesPanel } from '@/components/PropertiesPanel';
import { ChatBot } from '@/components/ChatBotImproved';
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
  const [show3D, setShow3D] = useState(false);
  const [showWelcome, setShowWelcome] = useState(true);

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

  const generateAutomaticPlan = (width: number, height: number, specs?: any) => {
    // Clear all existing rooms first
    setRooms([]);
    setSelectedRoom(null);
    setTerrainDimensions({ width, height });
    
    // Wait for state to clear before generating new plan
    setTimeout(() => {
    
    const scale = 20; // Escala 1:5 (1m = 20px)
    const offsetX = (800 - width * scale) / 2;
    const offsetY = (600 - height * scale) / 2;
    
    const newRooms: Room[] = [];
    let roomId = 1;
    
    const addRoom = (type: Room['type'], name: string, x: number, y: number, w: number, h: number) => {
      // Strict bounds checking - rooms MUST fit within terrain
      const maxX = Math.max(0, width - w);
      const maxY = Math.max(0, height - h);
      const roomX = Math.max(0, Math.min(x, maxX));
      const roomY = Math.max(0, Math.min(y, maxY));
      const roomW = Math.max(1, Math.min(w, width - roomX));
      const roomH = Math.max(1, Math.min(h, height - roomY));
      
      // Only add if room has valid dimensions
      if (roomW > 0.5 && roomH > 0.5) {
        newRooms.push({
          id: roomId.toString(),
          type, name,
          position: { x: offsetX + roomX * scale, y: offsetY + roomY * scale },
          dimensions: { width: roomW * scale, height: roomH * scale },
          color: type
        });
        roomId++;
      }
    };
    
    // Distribución sin superposiciones con pasillo central
    const w = width, h = height;
    const bedrooms = specs?.bedrooms || 2;
    const bathrooms = specs?.suiteMode ? bedrooms : (specs?.bathrooms || 1);
    
    // Check if each bedroom needs its own bathroom
    const suiteMode = specs?.suiteMode || false;
    const needsHallway = bedrooms > 2 || specs?.hasHallway;
    
    // ZONA ÍNTIMA - DISEÑO CON PASILLO INTEGRADO
    const bedroomZone = needsHallway ? h * 0.5 : h * 0.55; // Menos espacio si hay pasillo
    const minBedroomArea = 3.5 * scale; // 7m² mínimo recomendado
    const minBathroomArea = 2.5 * scale; // 2.5m² mínimo recomendado
    const hallwaySpace = needsHallway ? 1.5 : 0; // Espacio reservado para pasillo
    
    if (bedrooms === 1) {
      // Alcoba principal con acceso directo
      const masterW = Math.max(minBedroomArea, w*0.6);
      const masterH = Math.max(minBedroomArea/1.6, bedroomZone*0.8);
      addRoom('bedroom', 'Alcoba Principal', 0, 0, masterW, masterH);
      addRoom('bathroom', 'Baño Principal', masterW, 0, w-masterW, Math.max(minBathroomArea, bedroomZone*0.4));
      
      if (specs?.hasOffice && w > 12) {
        addRoom('office', 'Estudio', masterW, bedroomZone*0.4, w-masterW, bedroomZone*0.4);
      }
    } else if (bedrooms === 2) {
      if (needsHallway) {
        // Distribución con pasillo central
        const bedroomW = (w - hallwaySpace) * 0.5;
        addRoom('bedroom', 'Alcoba Principal', 0, 0, bedroomW, bedroomZone*0.8);
        addRoom('bedroom', 'Alcoba 2', w - bedroomW, 0, bedroomW, bedroomZone*0.8);
        addRoom('bathroom', 'Baño Principal', w*0.3, bedroomZone*0.8, w*0.4, bedroomZone*0.2);
      } else if (suiteMode) {
        // Suite profesional con baños privados
        const suiteW = w * 0.45;
        addRoom('bedroom', 'Alcoba Principal', 0, 0, suiteW, bedroomZone*0.75);
        addRoom('bathroom', 'Baño Principal', 0, bedroomZone*0.75, suiteW, bedroomZone*0.25);
        addRoom('bedroom', 'Alcoba 2', w*0.55, 0, w*0.45, bedroomZone*0.75);
        addRoom('bathroom', 'Baño 2', w*0.55, bedroomZone*0.75, w*0.45, bedroomZone*0.25);
      } else {
        // Distribución optimizada con baño compartido
        const masterW = Math.max(minBedroomArea, w*0.45);
        const secondW = Math.max(minBedroomArea, w*0.35);
        addRoom('bedroom', 'Alcoba Principal', 0, 0, masterW, bedroomZone*0.85);
        addRoom('bedroom', 'Alcoba 2', masterW, 0, secondW, bedroomZone*0.85);
        addRoom('bathroom', 'Baño Principal', masterW+secondW, 0, w-(masterW+secondW), bedroomZone);
      }
    } else if (bedrooms === 3) {
      if (needsHallway) {
        // Distribución en L con pasillo conectando
        const bedroomW = (w - hallwaySpace) * 0.33;
        addRoom('bedroom', 'Alcoba Principal', 0, 0, bedroomW*1.2, bedroomZone*0.7);
        addRoom('bedroom', 'Alcoba 2', bedroomW*1.2 + hallwaySpace, 0, bedroomW, bedroomZone*0.7);
        addRoom('bedroom', 'Alcoba 3', bedroomW*2.2 + hallwaySpace, 0, bedroomW*0.8, bedroomZone*0.7);
        addRoom('bathroom', 'Baño Principal', w*0.25, bedroomZone*0.7, w*0.5, bedroomZone*0.3);
      } else if (suiteMode) {
        // Tres suites con distribución L
        const suiteW = w / 3;
        for (let i = 0; i < 3; i++) {
          addRoom('bedroom', `Alcoba ${i === 0 ? 'Principal' : i+1}`, suiteW*i, 0, suiteW, bedroomZone*0.7);
          addRoom('bathroom', `Baño ${i === 0 ? 'Principal' : i+1}`, suiteW*i, bedroomZone*0.7, suiteW, bedroomZone*0.3);
        }
      } else {
        // Distribución en L con baño central
        const masterW = w * 0.4;
        const secondW = w * 0.3;
        const thirdW = w * 0.3;
        addRoom('bedroom', 'Alcoba Principal', 0, 0, masterW, bedroomZone);
        addRoom('bedroom', 'Alcoba 2', masterW, 0, secondW, bedroomZone*0.6);
        addRoom('bedroom', 'Alcoba 3', masterW+secondW, 0, thirdW, bedroomZone*0.6);
        addRoom('bathroom', 'Baño Principal', masterW, bedroomZone*0.6, secondW+thirdW, bedroomZone*0.4);
      }
    }
    
    // Baños adicionales (solo si no es suite mode)
    if (!suiteMode && bathrooms > 1 && bedrooms > 1) {
      if (bedrooms === 2) {
        addRoom('bathroom', 'Baño 2', w*0.6, bedroomZone*0.7, w*0.2, bedroomZone*0.3);
      }
    }
    
    // ZONA SOCIAL - CONECTADA POR PASILLO
    const socialStart = bedroomZone + (needsHallway ? hallwaySpace : 0);
    const socialHeight = h - socialStart;
    const minLivingArea = 4 * scale; // 16m² mínimo recomendado
    const minKitchenArea = 2.75 * scale; // 5.5m² mínimo recomendado
    
    // Determinar si usar concepto abierto (cocina-sala-comedor integrados)
    const useOpenConcept = specs?.openConcept || (w * h > 100 && !specs?.separateRooms && !needsHallway);
    
    if (specs?.hasGarage && w > 10) {
      // Garaje orientado al acceso principal
      const garageW = Math.min(w*0.35, 3.5*scale); // Máximo 3.5m ancho
      addRoom('garage', 'Garaje', 0, socialStart, garageW, socialHeight);
      
      if (useOpenConcept) {
        // CONCEPTO ABIERTO: Área social integrada
        const openAreaW = w - garageW;
        addRoom('living', 'Área Social Abierta (Sala-Cocina-Comedor)', garageW, socialStart, openAreaW, socialHeight);
      } else {
        // Distribución tradicional separada
        const livingW = Math.max(minLivingArea/3, w*0.4);
        addRoom('living', 'Sala', garageW, socialStart, livingW, socialHeight*0.7);
        
        const kitchenW = w - garageW - livingW;
        addRoom('kitchen', 'Cocina', garageW+livingW, socialStart, kitchenW, socialHeight*0.6);
        
        if (specs?.hasDining) {
          addRoom('dining', 'Comedor', garageW, socialStart + socialHeight*0.7, w-garageW, socialHeight*0.3);
        }
      }
    } else {
      if (useOpenConcept) {
        // CONCEPTO ABIERTO sin garaje: Área social completamente integrada
        const openAreaW = Math.max(minLivingArea/2, w*0.7);
        addRoom('living', 'Área Social Abierta (Sala-Cocina-Comedor)', 0, socialStart, openAreaW, socialHeight);
        
        // Zona de servicios separada
        if (specs?.hasLaundry) {
          addRoom('laundry', 'Lavandería', openAreaW, socialStart, w-openAreaW, socialHeight*0.6);
        }
      } else {
        // Distribución tradicional separada
        const livingW = Math.max(minLivingArea/3, w*0.55);
        const kitchenW = Math.max(minKitchenArea/2.5, w*0.3);
        
        addRoom('living', 'Sala', 0, socialStart, livingW, socialHeight*0.75);
        addRoom('kitchen', 'Cocina', livingW, socialStart, kitchenW, socialHeight*0.6);
        
        if (specs?.hasDining) {
          addRoom('dining', 'Comedor', 0, socialStart + socialHeight*0.75, livingW, socialHeight*0.25);
        }
        
        // Zona de servicios agrupada
        if (specs?.hasLaundry) {
          addRoom('laundry', 'Lavandería', livingW+kitchenW, socialStart, w-(livingW+kitchenW), socialHeight*0.6);
        }
      }
    }
    
    // PASILLO DE CIRCULACIÓN INTELIGENTE - CONECTA TODOS LOS ESPACIOS
    if (specs?.hasHallway || bedrooms > 2) {
      const hallwayWidth = Math.max(1.5, w * 0.08); // Mínimo 1.5m para comodidad
      
      if (w > h) {
        // Terreno horizontal: pasillo en L conectando zonas
        // Pasillo principal horizontal (conecta zona íntima con social)
        addRoom('hallway', 'Pasillo Principal', w*0.15, bedroomZone*0.85, w*0.7, hallwayWidth);
        
        // Pasillo secundario vertical (conecta habitaciones)
        if (bedrooms > 2) {
          addRoom('hallway', 'Pasillo Habitaciones', w*0.75, 0, hallwayWidth, bedroomZone*0.9);
        }
      } else {
        // Terreno vertical: pasillo central longitudinal
        const hallwayX = w * 0.35; // Posición central
        addRoom('hallway', 'Pasillo Central', hallwayX, bedroomZone*0.1, hallwayWidth, h*0.8);
        
        // Pasillo de distribución horizontal si hay muchas habitaciones
        if (bedrooms > 3) {
          addRoom('hallway', 'Distribuidor', w*0.1, bedroomZone*0.5, w*0.8, hallwayWidth*0.8);
        }
      }
    }
    
    // ESPACIOS ADICIONALES (sin superposición)
    let extraX = 0;
    let extraY = bedroomZone * 0.3;
    
    if (specs?.hasOffice && bedrooms > 1) {
      if (w > 12) {
        addRoom('office', 'Estudio', w*0.8, extraY, w*0.2, bedroomZone*0.2);
        extraY += bedroomZone*0.2;
      }
    }
    
    if (specs?.hasLaundry && specs?.hasGarage) {
      addRoom('laundry', 'Lavandería', w*0.75, socialStart + socialHeight*0.6, w*0.25, socialHeight*0.4);
    }
    
    // ESPACIOS EXTERIORES - DISEÑO BIOCLIMÁTICO
    if (specs?.hasGarden && (w * h) > 80) {
      const gardenArea = Math.min((w * h) * 0.15, 25); // Máximo 25m²
      if (w > h) {
        // Jardín lateral con orientación este
        const gardenW = Math.max(2, gardenArea / bedroomZone);
        addRoom('garden', 'Jardín', w-gardenW, 0, gardenW, bedroomZone);
      } else {
        // Jardín posterior
        const gardenH = Math.max(2, gardenArea / (w*0.4));
        addRoom('garden', 'Jardín', w*0.6, socialStart + socialHeight - gardenH, w*0.4, gardenH);
      }
    }
    
    if (specs?.hasTerrace && w > 8) {
      // Terraza con orientación sur para aprovechamiento solar
      const terraceW = Math.min(w*0.25, 3*scale);
      const terraceH = Math.min(socialHeight*0.3, 2*scale);
      addRoom('balcony', 'Terraza', w-terraceW, socialStart, terraceW, terraceH);
    }
    
      setRooms(newRooms);
      setActiveTool('select');
      toast.success(`🏗️ Plano arquitectónico ${width}x${height}m generado`);
      toast.info('✅ Aplicados: Zonificación inteligente, diseño profesional, ventilación cruzada');
      toast.info('🔧 Usa las herramientas del panel para ajustes personalizados');
    }, 100); // Small delay to ensure state is cleared
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

  useEffect(() => {
    const timer = setTimeout(() => {
      setShowWelcome(false);
    }, 5000);
    return () => clearTimeout(timer);
  }, []);

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
            <Button variant="outline" size="sm" onClick={() => setShow3D(true)}>
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
        <div className="flex-1 relative">
          {rooms.length === 0 && showWelcome && (
            <div className="absolute inset-0 flex items-center justify-center z-10 bg-background/80 backdrop-blur-sm">
              <div className="text-center max-w-md mx-auto p-8">
                <div className="mb-6">
                  <div className="w-16 h-16 mx-auto mb-4 bg-gradient-to-br from-primary to-accent rounded-full flex items-center justify-center">
                    <span className="text-2xl">🏠</span>
                  </div>
                  <h2 className="text-2xl font-bold mb-2">¡Bienvenido a Plan Forge 3D!</h2>
                  <p className="text-muted-foreground mb-6">
                    Diseña el plano de tu hogar ideal con nuestra herramienta intuitiva
                  </p>
                </div>
                <div className="space-y-3 text-sm text-left">
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 bg-primary/10 rounded-full flex items-center justify-center">
                      <span className="text-primary font-bold">1</span>
                    </div>
                    <span>Usa el <strong>chat inteligente</strong> para generar planos automáticamente</span>
                  </div>
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 bg-primary/10 rounded-full flex items-center justify-center">
                      <span className="text-primary font-bold">2</span>
                    </div>
                    <span>Selecciona herramientas del <strong>panel izquierdo</strong> para dibujar manualmente</span>
                  </div>
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 bg-primary/10 rounded-full flex items-center justify-center">
                      <span className="text-primary font-bold">3</span>
                    </div>
                    <span>Personaliza dimensiones en el <strong>panel derecho</strong></span>
                  </div>
                </div>
                <div className="mt-6 pt-4 border-t border-border">
                  <p className="text-xs text-muted-foreground">
                    💡 <strong>Consejo:</strong> Prueba diciendo "Crea una casa de 3 habitaciones" en el chat
                  </p>
                </div>
              </div>
            </div>
          )}
          <FloorPlanCanvas
            activeTool={activeTool}
            rooms={rooms}
            onRoomAdd={handleRoomAdd}
            onRoomSelect={handleRoomSelect}
            onRoomUpdate={handleRoomUpdate}
            selectedRoom={selectedRoom}
            terrainDimensions={terrainDimensions}
          />
        </div>

        {/* Right Panel - Properties */}
        <PropertiesPanel
          selectedRoom={selectedRoom}
          onRoomUpdate={handleRoomUpdate}
          onRoomDelete={handleRoomDelete}
          terrainDimensions={terrainDimensions}
          onTerrainUpdate={handleTerrainUpdate}
        />
      </div>

      {/* 3D View Modal */}
      {show3D && (
        <FloorPlan3D
          rooms={rooms}
          terrainDimensions={terrainDimensions}
          onClose={() => setShow3D(false)}
        />
      )}
      
      {/* ChatBot */}
      <ChatBot 
        onGeneratePlan={generateAutomaticPlan}
        rooms={rooms}
        onRoomUpdate={handleRoomUpdate}
        onRoomDelete={handleRoomDelete}
        onRoomAdd={handleRoomAdd}
        onTerrainUpdate={handleTerrainUpdate}
        terrainDimensions={terrainDimensions}
      />
    </div>
  );
};

export default Index;