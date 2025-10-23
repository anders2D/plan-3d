import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Separator } from '@/components/ui/separator';
import { Room, Dimensions } from '@/types/floorplan';
import { Trash2 } from 'lucide-react';

interface PropertiesPanelProps {
  selectedRoom: Room | null;
  onRoomUpdate: (room: Room) => void;
  onRoomDelete: (roomId: string) => void;
  terrainDimensions: Dimensions;
  onTerrainUpdate: (dimensions: Dimensions) => void;
}

export const PropertiesPanel = ({
  selectedRoom,
  onRoomUpdate,
  onRoomDelete,
  terrainDimensions,
  onTerrainUpdate
}: PropertiesPanelProps) => {
  const [localRoom, setLocalRoom] = useState<Room | null>(null);
  const [localTerrain, setLocalTerrain] = useState(terrainDimensions);

  useEffect(() => {
    setLocalRoom(selectedRoom);
  }, [selectedRoom]);

  useEffect(() => {
    setLocalTerrain(terrainDimensions);
  }, [terrainDimensions]);

  const handleRoomChange = (field: string, value: any) => {
    if (!localRoom) return;

    const updatedRoom = { ...localRoom };
    if (field.includes('.')) {
      const [parent, child] = field.split('.');
      if (parent === 'dimensions') {
        // Convert meters to pixels using scale 1:5 (20px per meter)
        const pixelValue = (parseFloat(value) || 0) * 20;
        (updatedRoom as any)[parent] = {
          ...(updatedRoom as any)[parent],
          [child]: pixelValue
        };
      } else {
        (updatedRoom as any)[parent] = {
          ...(updatedRoom as any)[parent],
          [child]: parseFloat(value) || 0
        };
      }
    } else {
      (updatedRoom as any)[field] = value;
    }

    setLocalRoom(updatedRoom);
    onRoomUpdate(updatedRoom);
  };

  const handleTerrainChange = (field: keyof Dimensions, value: string) => {
    const numValue = parseFloat(value) || 1;
    const newDimensions = {
      ...localTerrain,
      [field]: Math.max(0.5, numValue)
    };
    setLocalTerrain(newDimensions);
  };

  const applyTerrainChanges = () => {
    onTerrainUpdate(localTerrain);
  };

  const roomTypeNames = {
    bedroom: 'Alcoba',
    bathroom: 'Baño',
    living: 'Sala',
    kitchen: 'Cocina'
  };

  return (
    <div className="w-80 p-6 bg-muted/30 border-l border-border space-y-6">
      {/* Terrain Properties */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg font-semibold">Configuración del Terreno</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label htmlFor="terrain-width" className="text-sm font-medium">
                Ancho (m)
              </Label>
              <Input
                id="terrain-width"
                type="number"
                min="0.5"
                step="0.5"
                value={localTerrain.width}
                onChange={(e) => handleTerrainChange('width', e.target.value)}
                className="mt-1"
              />
            </div>
            <div>
              <Label htmlFor="terrain-height" className="text-sm font-medium">
                Largo (m)
              </Label>
              <Input
                id="terrain-height"
                type="number"
                min="0.5"
                step="0.5"
                value={localTerrain.height}
                onChange={(e) => handleTerrainChange('height', e.target.value)}
                className="mt-1"
              />
            </div>
          </div>
          <Button 
            onClick={applyTerrainChanges} 
            size="sm" 
            className="w-full"
          >
            Aplicar Cambios
          </Button>
          <div className="text-xs text-muted-foreground text-center">
            Área total: {localTerrain.width * localTerrain.height} m²
          </div>
        </CardContent>
      </Card>

      <Separator />

      {/* Room Properties */}
      {selectedRoom ? (
        <Card>
          <CardHeader>
            <CardTitle className="text-lg font-semibold flex items-center justify-between">
              Propiedades de la Habitación
              <Button
                variant="outline"
                size="sm"
                onClick={() => onRoomDelete(selectedRoom.id)}
                className="text-destructive hover:text-destructive"
              >
                <Trash2 className="h-4 w-4" />
              </Button>
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <Label htmlFor="room-name" className="text-sm font-medium">
                Nombre
              </Label>
              <Input
                id="room-name"
                value={localRoom?.name || ''}
                onChange={(e) => handleRoomChange('name', e.target.value)}
                className="mt-1"
              />
            </div>

            <div>
              <Label className="text-sm font-medium text-muted-foreground">
                Tipo: {roomTypeNames[selectedRoom.type]}
              </Label>
            </div>

            <Separator />

            <div>
              <Label className="text-sm font-medium mb-3 block">Dimensiones</Label>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label htmlFor="room-width" className="text-xs text-muted-foreground">
                    Ancho (m)
                  </Label>
                  <Input
                    id="room-width"
                    type="number"
                    min="0.1"
                    step="0.1"
                    value={((localRoom?.dimensions.width || 0) / 20).toFixed(1)}
                    onChange={(e) => handleRoomChange('dimensions.width', e.target.value)}
                    className="mt-1"
                  />
                </div>
                <div>
                  <Label htmlFor="room-height" className="text-xs text-muted-foreground">
                    Alto (m)
                  </Label>
                  <Input
                    id="room-height"
                    type="number"
                    min="0.1"
                    step="0.1"
                    value={((localRoom?.dimensions.height || 0) / 20).toFixed(1)}
                    onChange={(e) => handleRoomChange('dimensions.height', e.target.value)}
                    className="mt-1"
                  />
                </div>
              </div>
            </div>

            <Separator />

            <div>
              <Label className="text-sm font-medium mb-3 block">Posición</Label>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label htmlFor="room-x" className="text-xs text-muted-foreground">
                    X (px)
                  </Label>
                  <Input
                    id="room-x"
                    type="number"
                    value={localRoom?.position.x || 0}
                    onChange={(e) => handleRoomChange('position.x', e.target.value)}
                    className="mt-1"
                  />
                </div>
                <div>
                  <Label htmlFor="room-y" className="text-xs text-muted-foreground">
                    Y (px)
                  </Label>
                  <Input
                    id="room-y"
                    type="number"
                    value={localRoom?.position.y || 0}
                    onChange={(e) => handleRoomChange('position.y', e.target.value)}
                    className="mt-1"
                  />
                </div>
              </div>
            </div>

            <div className="pt-2 text-xs text-muted-foreground">
              Área: {(((localRoom?.dimensions.width || 0) / 20) * ((localRoom?.dimensions.height || 0) / 20)).toFixed(2)} m²
            </div>
          </CardContent>
        </Card>
      ) : (
        <Card>
          <CardContent className="p-6 text-center text-muted-foreground">
            Selecciona una habitación para ver sus propiedades
          </CardContent>
        </Card>
      )}
    </div>
  );
};