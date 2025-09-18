import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Separator } from '@/components/ui/separator';
import { MousePointer, Home, Bath, Sofa, ChefHat, Square, DoorOpen, RectangleHorizontal, Shirt, Car, Trees, WashingMachine, ArrowUp, Building, Briefcase, UtensilsCrossed, Archive } from 'lucide-react';
import { ToolType } from '@/types/floorplan';

interface ToolPanelProps {
  activeTool: ToolType;
  onToolChange: (tool: ToolType) => void;
}

export const ToolPanel = ({ activeTool, onToolChange }: ToolPanelProps) => {
  const tools = [
    {
      id: 'select' as ToolType,
      name: 'Seleccionar',
      icon: MousePointer,
      description: 'Seleccionar y mover elementos'
    }
  ];

  const roomTools = [
    {
      id: 'bedroom' as ToolType,
      name: 'Alcoba',
      icon: Home,
      description: 'Agregar dormitorio'
    },
    {
      id: 'bathroom' as ToolType,
      name: 'Baño',
      icon: Bath,
      description: 'Agregar baño'
    },
    {
      id: 'living' as ToolType,
      name: 'Sala',
      icon: Sofa,
      description: 'Agregar sala de estar'
    },
    {
      id: 'kitchen' as ToolType,
      name: 'Cocina',
      icon: ChefHat,
      description: 'Agregar cocina'
    },
    {
      id: 'dining' as ToolType,
      name: 'Comedor',
      icon: UtensilsCrossed,
      description: 'Agregar comedor'
    },
    {
      id: 'office' as ToolType,
      name: 'Oficina',
      icon: Briefcase,
      description: 'Agregar oficina'
    }
  ];

  const utilityTools = [
    {
      id: 'closet' as ToolType,
      name: 'Closet',
      icon: Shirt,
      description: 'Agregar closet'
    },
    {
      id: 'laundry' as ToolType,
      name: 'Lavandería',
      icon: WashingMachine,
      description: 'Agregar zona de lavado'
    },
    {
      id: 'storage' as ToolType,
      name: 'Depósito',
      icon: Archive,
      description: 'Agregar depósito'
    },
    {
      id: 'garage' as ToolType,
      name: 'Garaje',
      icon: Car,
      description: 'Agregar garaje'
    },
    {
      id: 'balcony' as ToolType,
      name: 'Balcón',
      icon: Building,
      description: 'Agregar balcón'
    },
    {
      id: 'stairs' as ToolType,
      name: 'Escaleras',
      icon: ArrowUp,
      description: 'Agregar escaleras'
    },
    {
      id: 'garden' as ToolType,
      name: 'Jardín',
      icon: Trees,
      description: 'Agregar zona verde'
    }
  ];

  const structuralTools = [
    {
      id: 'wall' as ToolType,
      name: 'Pared',
      icon: Square,
      description: 'Agregar pared'
    },
    {
      id: 'door' as ToolType,
      name: 'Puerta',
      icon: DoorOpen,
      description: 'Agregar puerta'
    },
    {
      id: 'window' as ToolType,
      name: 'Ventana',
      icon: RectangleHorizontal,
      description: 'Agregar ventana'
    }
  ];

  return (
    <div className="w-80 p-4 bg-muted/30 border-r border-border overflow-y-auto">
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-lg font-semibold">Herramientas</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3 overflow-y-auto max-h-[calc(100vh-120px)]">
          <div className="grid grid-cols-2 gap-1">
            {tools.concat(roomTools, utilityTools).map((tool) => {
              const Icon = tool.icon;
              return (
                <Button
                  key={tool.id}
                  variant={activeTool === tool.id ? "default" : "outline"}
                  size="sm"
                  className="h-auto p-2 flex flex-col items-center gap-1"
                  onClick={() => onToolChange(tool.id)}
                >
                  <Icon className="h-3 w-3" />
                  <span className="text-xs">{tool.name}</span>
                </Button>
              );
            })}
          </div>

          <Separator />

          <div>
            <h4 className="text-sm font-medium mb-3 text-muted-foreground">ESTRUCTURA</h4>
            <div className="grid grid-cols-2 gap-2">
              {structuralTools.map((tool) => {
                const Icon = tool.icon;
                return (
                  <Button
                    key={tool.id}
                    variant={activeTool === tool.id ? "default" : "outline"}
                    size="sm"
                    className="h-auto p-2 flex flex-col items-center gap-1 tool-button opacity-50"
                    onClick={() => onToolChange(tool.id)}
                    disabled
                  >
                    <Icon className="h-4 w-4" />
                    <span className="text-xs font-medium">{tool.name}</span>
                  </Button>
                );
              })}
            </div>
            <p className="text-xs text-muted-foreground mt-2">
              Próximamente: Herramientas estructurales
            </p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};