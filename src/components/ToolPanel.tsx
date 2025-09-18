import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Separator } from '@/components/ui/separator';
import { MousePointer, Home, Bath, Sofa, ChefHat, Square, DoorOpen, RectangleHorizontal } from 'lucide-react';
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
    },
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
    <div className="w-80 p-6 bg-muted/30 border-r border-border">
      <Card>
        <CardHeader>
          <CardTitle className="text-lg font-semibold">Herramientas</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <h4 className="text-sm font-medium mb-3 text-muted-foreground">HABITACIONES</h4>
            <div className="grid grid-cols-2 gap-2">
              {tools.map((tool) => {
                const Icon = tool.icon;
                return (
                  <Button
                    key={tool.id}
                    variant={activeTool === tool.id ? "default" : "outline"}
                    size="sm"
                    className="h-auto p-3 flex flex-col items-center gap-2 tool-button"
                    onClick={() => onToolChange(tool.id)}
                  >
                    <Icon className="h-5 w-5" />
                    <span className="text-xs font-medium">{tool.name}</span>
                  </Button>
                );
              })}
            </div>
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
                    className="h-auto p-3 flex flex-col items-center gap-2 tool-button opacity-50"
                    onClick={() => onToolChange(tool.id)}
                    disabled
                  >
                    <Icon className="h-5 w-5" />
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