import { useState, useRef, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';
import { MessageCircle, Send, X, Minimize2, Maximize2, RotateCcw, Home, Lightbulb, Settings, Download, Copy } from 'lucide-react';
import { Room } from '@/types/floorplan';
import { GoogleGenAI } from '@google/genai';
import { toast } from 'sonner';

// Usar variable de entorno para seguridad
const genAI = new GoogleGenAI({
  apiKey: import.meta.env.VITE_GEMINI_API_KEY || 'AIzaSyBniLlu4rQtdpoEweZV8XMF2NGCQE1dhn8'
});

interface Message {
  id: string;
  text: string;
  isBot: boolean;
  timestamp: Date;
  type?: 'info' | 'success' | 'warning' | 'error' | 'plan';
  metadata?: {
    planData?: any;
    suggestions?: string[];
    quickActions?: Array<{label: string; action: string}>;
  };
}

interface ChatHistory {
  messages: Message[];
  timestamp: Date;
  planContext?: any;
}

interface ChatBotProps {
  onGeneratePlan?: (width: number, height: number, specs?: any) => void;
  rooms?: Room[];
  onRoomUpdate?: (room: Room) => void;
  onRoomDelete?: (roomId: string) => void;
  onRoomAdd?: (room: Room) => void;
  onTerrainUpdate?: (dimensions: { width: number; height: number }) => void;
  terrainDimensions?: { width: number; height: number };
}

export const ChatBot = ({ onGeneratePlan, rooms = [], onRoomUpdate, onRoomDelete, onRoomAdd, onTerrainUpdate, terrainDimensions }: ChatBotProps) => {
  const [isOpen, setIsOpen] = useState(false);
  const [isMinimized, setIsMinimized] = useState(false);
  const [messages, setMessages] = useState<Message[]>(() => {
    const saved = localStorage.getItem('chatbot-history');
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        return (parsed.messages || []).map((msg: any) => ({
          ...msg,
          timestamp: new Date(msg.timestamp)
        }));
      } catch {
        return [];
      }
    }
    return [
      {
        id: '1',
        text: '¡Hola! Soy ARQUIA, tu asistente inteligente en diseño de planos.\nEstoy aquí para ayudarte a dar forma a tus ideas y convertir tus sueños en espacios reales.\nYa sea una casa, oficina, local o cualquier proyecto, juntos lo haremos realidad.\n✨ ¡Dime qué necesitas y comencemos a diseñar!',
        isBot: true,
        timestamp: new Date(),
        type: 'info',
        metadata: {
          quickActions: [
            { label: '📊 Analizar Plano', action: 'info del plano' },
            { label: '🛠️ Ver Herramientas', action: 'herramientas' },
            { label: '🏗️ Casa Moderna', action: 'casa moderna 12x10 con 3 alcobas' },
            { label: '🌿 Concepto Abierto', action: 'plano abierto 15x12 con jardín' }
          ]
        }
      }
    ];
  });
  const [inputText, setInputText] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [showSuggestions, setShowSuggestions] = useState(true);
  const [conversationContext, setConversationContext] = useState<string[]>([]);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  // Guardar historial automáticamente
  useEffect(() => {
    const chatHistory: ChatHistory = {
      messages,
      timestamp: new Date(),
      planContext: { rooms: rooms.length, terrain: terrainDimensions }
    };
    localStorage.setItem('chatbot-history', JSON.stringify(chatHistory));
  }, [messages, rooms, terrainDimensions]);

  // Sugerencias inteligentes basadas en contexto
  const getContextualSuggestions = () => {
    const roomCount = rooms.length;
    const area = terrainDimensions ? terrainDimensions.width * terrainDimensions.height : 0;
    const hasRooms = roomCount > 0;
    
    if (!hasRooms) {
      return ['plano simple', 'casa 12x10m con 3 alcobas', 'plano abierto 15x12m'];
    }
    
    const suggestions = [];
    if (area > 150) suggestions.push('agregar garaje');
    if (roomCount < 3) suggestions.push('agregar alcoba');
    if (!rooms.some(r => r.type === 'garden')) suggestions.push('agregar jardín');
    if (area > 100) suggestions.push('concepto abierto');
    
    return suggestions.length > 0 ? suggestions : ['optimizar distribución', 'info del plano'];
  };

  // Función para agregar habitación individual con medidas personalizadas
  const addSingleRoom = (roomType: string, customWidth?: number, customHeight?: number) => {
    if (!onRoomAdd || !terrainDimensions) return;
    
    const scale = 20;
    const offsetX = (800 - terrainDimensions.width * scale) / 2;
    const offsetY = (600 - terrainDimensions.height * scale) / 2;
    
    // Dimensiones por defecto según tipo de habitación
    const defaultSizes = {
      'bedroom': { w: 3.5, h: 3.5 },
      'bathroom': { w: 2.5, h: 2.5 },
      'living': { w: 4, h: 4 },
      'kitchen': { w: 3, h: 3 },
      'dining': { w: 3, h: 3 },
      'office': { w: 3, h: 3 },
      'garage': { w: 3.5, h: 6 },
      'garden': { w: 4, h: 4 },
      'laundry': { w: 2, h: 2.5 },
      'stairs': { w: 2, h: 3 },
      'hallway': { w: 1.5, h: 4 },
      'balcony': { w: 2, h: 3 },
      'closet': { w: 1.5, h: 2 },
      'storage': { w: 2, h: 2 }
    };
    
    const roomSize = defaultSizes[roomType as keyof typeof defaultSizes] || { w: 3, h: 3 };
    const roomWidth = (customWidth || roomSize.w) * scale;
    const roomHeight = (customHeight || roomSize.h) * scale;
    
    // Encontrar espacio libre
    const findFreeSpace = () => {
      const gridSize = 1; // 1m grid para más precisión
      for (let y = 0; y <= terrainDimensions.height - (roomHeight/scale); y += gridSize) {
        for (let x = 0; x <= terrainDimensions.width - (roomWidth/scale); x += gridSize) {
          const testX = offsetX + x * scale;
          const testY = offsetY + y * scale;
          
          // Check if space is free
          const overlaps = rooms.some(room => {
            return !(testX + roomWidth < room.position.x || 
                    testX > room.position.x + room.dimensions.width ||
                    testY + roomHeight < room.position.y ||
                    testY > room.position.y + room.dimensions.height);
          });
          
          if (!overlaps) {
            return { x: testX, y: testY, w: roomWidth, h: roomHeight };
          }
        }
      }
      return null;
    };
    
    const freeSpace = findFreeSpace();
    if (!freeSpace) {
      toast.error('No hay espacio disponible para agregar la habitación');
      return;
    }
    
    const roomNames = {
      'garden': 'Jardín',
      'garage': 'Garaje', 
      'bedroom': 'Alcoba',
      'bathroom': 'Baño',
      'living': 'Sala',
      'kitchen': 'Cocina',
      'dining': 'Comedor',
      'office': 'Oficina',
      'laundry': 'Lavandería',
      'stairs': 'Escaleras',
      'hallway': 'Pasillo',
      'balcony': 'Balcón',
      'closet': 'Closet',
      'storage': 'Depósito'
    };
    
    const newRoom: Room = {
      id: (Date.now()).toString(),
      type: roomType as Room['type'],
      name: roomNames[roomType as keyof typeof roomNames] || roomType,
      position: { x: freeSpace.x, y: freeSpace.y },
      dimensions: { width: freeSpace.w, height: freeSpace.h },
      color: roomType
    };
    
    onRoomAdd(newRoom);
    const sizeText = customWidth && customHeight ? ` (${customWidth}x${customHeight}m)` : '';
    toast.success(`${newRoom.name}${sizeText} agregado al plano`);
  };

  const handleSend = async (text?: string) => {
    const messageText = text || inputText.trim();
    if (!messageText || isLoading) return;

    const userMessage: Message = {
      id: Date.now().toString(),
      text: messageText,
      isBot: false,
      timestamp: new Date()
    };

    setMessages(prev => [...prev, userMessage]);
    setInputText('');
    setIsLoading(false);
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const clearChat = () => {
    setMessages([{
      id: '1',
      text: '¡Hola! Soy ARQUIA, tu asistente inteligente en diseño de planos.\nEstoy aquí para ayudarte a dar forma a tus ideas y convertir tus sueños en espacios reales.\nYa sea una casa, oficina, local o cualquier proyecto, juntos lo haremos realidad.\n✨ ¡Dime qué necesitas y comencemos a diseñar!',
      isBot: true,
      timestamp: new Date(),
      type: 'info'
    }]);
    localStorage.removeItem('chatbot-history');
    toast.success('Chat reiniciado');
  };

  return (
    <>
      {/* Chat Button */}
      <div className="fixed bottom-4 right-4 z-50 flex flex-col gap-2">
        {!isOpen && (
          <Button
            onClick={() => setIsOpen(true)}
            className="rounded-full w-14 h-14 shadow-lg bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700 animate-pulse"
            size="lg"
          >
            <MessageCircle className="w-6 h-6" />
          </Button>
        )}
      </div>

      {/* Chat Window */}
      {isOpen && (
        <div className={`fixed bottom-4 right-4 bg-white border rounded-xl shadow-2xl z-50 flex flex-col transition-all duration-300 ${
          isMinimized ? 'w-80 h-16' : 'w-96 h-[600px]'
        }`}>
          {/* Header */}
          <div className="flex items-center justify-between p-4 border-b bg-gradient-to-r from-blue-600 to-purple-600 text-white rounded-t-xl">
            <div className="flex items-center gap-2">
              <div className="w-2 h-2 bg-green-400 rounded-full animate-pulse"></div>
              <h3 className="font-bold text-sm">ARQUIA</h3>
              <Badge variant="secondary" className="text-xs bg-white/20 text-white border-0">
                {rooms.length} habitaciones
              </Badge>
            </div>
            <div className="flex items-center gap-1">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setIsMinimized(!isMinimized)}
                className="text-white hover:bg-white/20 p-1 h-8 w-8"
              >
                {isMinimized ? <Maximize2 className="w-4 h-4" /> : <Minimize2 className="w-4 h-4" />}
              </Button>
              <Button
                variant="ghost"
                size="sm"
                onClick={clearChat}
                className="text-white hover:bg-white/20 p-1 h-8 w-8"
              >
                <RotateCcw className="w-4 h-4" />
              </Button>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setIsOpen(false)}
                className="text-white hover:bg-white/20 p-1 h-8 w-8"
              >
                <X className="w-4 h-4" />
              </Button>
            </div>
          </div>

          {!isMinimized && (
            <>
              {/* Messages */}
              <ScrollArea className="flex-1 p-4">
                <div className="space-y-4">
                  {messages.map((message) => (
                    <div key={message.id} className="space-y-2">
                      <div className={`flex ${message.isBot ? 'justify-start' : 'justify-end'}`}>
                        <div className="flex flex-col max-w-[85%]">
                          <div
                            className={`p-3 rounded-2xl text-sm whitespace-pre-line relative group ${
                              message.isBot
                                ? `${
                                    message.type === 'error' ? 'bg-red-50 text-red-800 border border-red-200' :
                                    message.type === 'success' ? 'bg-green-50 text-green-800 border border-green-200' :
                                    message.type === 'plan' ? 'bg-blue-50 text-blue-800 border border-blue-200' :
                                    'bg-gray-100 text-gray-800'
                                  }`
                                : 'bg-gradient-to-r from-blue-600 to-purple-600 text-white'
                            }`}
                          >
                            {message.text}
                          </div>
                          <span className="text-xs text-gray-500 mt-1 px-2">
                            {new Date(message.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                          </span>
                        </div>
                      </div>
                      
                      {/* Quick Actions */}
                      {message.metadata?.quickActions && (
                        <div className="flex flex-wrap gap-2 ml-2">
                          {message.metadata.quickActions.map((action, idx) => (
                            <Button
                              key={idx}
                              variant="outline"
                              size="sm"
                              onClick={() => handleSend(action.action)}
                              className="text-xs h-7 px-2"
                            >
                              {action.label}
                            </Button>
                          ))}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
                <div ref={messagesEndRef} />
              </ScrollArea>

              {/* Input */}
              <div className="p-4 border-t bg-white rounded-b-xl">
                <div className="flex gap-2">
                  <Input
                    value={inputText}
                    onChange={(e) => setInputText(e.target.value)}
                    onKeyPress={handleKeyPress}
                    placeholder="Describe tu proyecto ideal..."
                    className="flex-1 text-sm border-gray-300 focus:border-blue-500"
                    disabled={isLoading}
                  />
                  <Button 
                    onClick={() => handleSend()} 
                    size="sm" 
                    disabled={isLoading || !inputText.trim()}
                    className="bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700"
                  >
                    <Send className="w-4 h-4" />
                  </Button>
                </div>
              </div>
            </>
          )}
        </div>
      )}
    </>
  );
};