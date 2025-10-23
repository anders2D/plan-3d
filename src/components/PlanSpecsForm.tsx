import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';

interface PlanSpecsFormProps {
  dimensions: { width: number; height: number };
  onSubmit: (specs: any) => void;
  onClose: () => void;
}

export const PlanSpecsForm = ({ dimensions, onSubmit, onClose }: PlanSpecsFormProps) => {
  const [bedrooms, setBedrooms] = useState(2);
  const [bathrooms, setBathrooms] = useState(1);
  const [hasGarden, setHasGarden] = useState(false);
  const [hasGarage, setHasGarage] = useState(false);
  const [hasOffice, setHasOffice] = useState(false);
  const [hasLaundry, setHasLaundry] = useState(true);
  const [hasDining, setHasDining] = useState(false);
  const [hasPool, setHasPool] = useState(false);
  const [hasTerrace, setHasTerrace] = useState(false);

  const handleSubmit = () => {
    onSubmit({
      bedrooms,
      bathrooms,
      hasGarden,
      hasGarage,
      hasOffice,
      hasLaundry,
      hasDining,
      hasPool,
      hasTerrace
    });
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg p-6 w-96 max-h-[80vh] overflow-y-auto">
        <div className="flex justify-between items-center mb-4">
          <h3 className="text-lg font-semibold">Especificaciones del Plano</h3>
          <Button variant="ghost" size="sm" onClick={onClose}>×</Button>
        </div>
        
        <div className="mb-4 p-3 bg-blue-50 rounded">
          <p className="text-sm text-blue-700">
            <strong>Terreno:</strong> {dimensions.width}m × {dimensions.height}m
          </p>
        </div>

        <div className="space-y-4">
          {/* Espacios con números */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label htmlFor="bedrooms">🏠 Alcobas</Label>
              <Input
                id="bedrooms"
                type="number"
                min="1"
                max="4"
                value={bedrooms}
                onChange={(e) => setBedrooms(parseInt(e.target.value) || 1)}
              />
            </div>
            <div>
              <Label htmlFor="bathrooms">🚿 Baños</Label>
              <Input
                id="bathrooms"
                type="number"
                min="1"
                max="3"
                value={bathrooms}
                onChange={(e) => setBathrooms(parseInt(e.target.value) || 1)}
              />
            </div>
          </div>

          {/* Espacios de selección */}
          <div className="space-y-3">
            <Label className="text-sm font-medium">Espacios Opcionales:</Label>
            
            <div className="flex items-center space-x-2">
              <Checkbox
                id="garden"
                checked={hasGarden}
                onCheckedChange={setHasGarden}
              />
              <Label htmlFor="garden">🌳 Jardín/Zona Verde</Label>
            </div>

            <div className="flex items-center space-x-2">
              <Checkbox
                id="garage"
                checked={hasGarage}
                onCheckedChange={setHasGarage}
              />
              <Label htmlFor="garage">🚗 Garaje</Label>
            </div>

            <div className="flex items-center space-x-2">
              <Checkbox
                id="office"
                checked={hasOffice}
                onCheckedChange={setHasOffice}
              />
              <Label htmlFor="office">🏢 Estudio/Oficina</Label>
            </div>

            <div className="flex items-center space-x-2">
              <Checkbox
                id="laundry"
                checked={hasLaundry}
                onCheckedChange={setHasLaundry}
              />
              <Label htmlFor="laundry">🧹 Lavandería</Label>
            </div>

            <div className="flex items-center space-x-2">
              <Checkbox
                id="dining"
                checked={hasDining}
                onCheckedChange={setHasDining}
              />
              <Label htmlFor="dining">🍽️ Comedor Separado</Label>
            </div>

            <div className="flex items-center space-x-2">
              <Checkbox
                id="pool"
                checked={hasPool}
                onCheckedChange={setHasPool}
              />
              <Label htmlFor="pool">🏊 Piscina</Label>
            </div>

            <div className="flex items-center space-x-2">
              <Checkbox
                id="terrace"
                checked={hasTerrace}
                onCheckedChange={setHasTerrace}
              />
              <Label htmlFor="terrace">🌿 Terraza/Balcón</Label>
            </div>
          </div>
        </div>

        <div className="flex gap-2 mt-6">
          <Button variant="outline" onClick={onClose} className="flex-1">
            Cancelar
          </Button>
          <Button onClick={handleSubmit} className="flex-1">
            Generar Plano
          </Button>
        </div>
      </div>
    </div>
  );
};