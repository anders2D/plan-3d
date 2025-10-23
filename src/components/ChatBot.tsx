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
  terrainDimensions?: { width: number; height: number };
}

export const ChatBot = ({ onGeneratePlan, rooms = [], onRoomUpdate, onRoomDelete, terrainDimensions }: ChatBotProps) => {
  const [isOpen, setIsOpen] = useState(false);
  const [isMinimized, setIsMinimized] = useState(false);
  const [messages, setMessages] = useState<Message[]>(() => {
    const saved = localStorage.getItem('chatbot-history');
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        return parsed.messages || [];
      } catch {
        return [];
      }
    }
    return [
      {
        id: '1',
text: '👋 ¡Hola! Soy ARQUIA, tu asistente inteligente en diseño de planos.\nEstoy aquí para ayudarte a dar forma a tus ideas y convertir tus sueños en espacios reales.\nYa sea una casa, oficina, local o cualquier proyecto, juntos lo haremos realidad.\n✨ ¡Dime qué necesitas y comencemos a diseñar!',
        isBot: true,
        timestamp: new Date(),
        type: 'info',
        metadata: {
          quickActions: [
            { label: '🏠 Plano Simple', action: 'plano simple' },
            { label: '🔓 Área Abierta', action: 'plano abierto 12x10m' },
            { label: '📊 Info Actual', action: 'info del plano' },
            { label: '🏡 Casa Familiar', action: 'casa 15x12m con 3 alcobas y garaje' }
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
    const area = terrainDimensions.width * terrainDimensions.height;
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

  const getAIResponse = async (userMessage: string): Promise<{response: string, planData?: any, action?: string}> => {
    try {
      const currentPlan = {
        terrain: terrainDimensions ? `${terrainDimensions.width}x${terrainDimensions.height}m` : 'No definido',
        rooms: rooms.map(r => {
          const widthM = (r.dimensions.width/20).toFixed(1);
          const heightM = (r.dimensions.height/20).toFixed(1);
          const areaM = (parseFloat(widthM) * parseFloat(heightM)).toFixed(1);
          const posX = ((r.position.x - (800 - terrainDimensions.width * 20) / 2) / 20).toFixed(1);
          const posY = ((r.position.y - (600 - terrainDimensions.height * 20) / 2) / 20).toFixed(1);
          return `${r.name}: ${widthM}x${heightM}m (${areaM}m²) en posición ${posX},${posY}m`;
        }).join(' | ') || 'Ninguna',
        totalRooms: rooms.length,
        area: terrainDimensions ? (terrainDimensions.width * terrainDimensions.height).toFixed(1) : '0',
        roomsByType: {
          bedrooms: rooms.filter(r => r.type === 'bedroom').length,
          bathrooms: rooms.filter(r => r.type === 'bathroom').length,
          living: rooms.filter(r => r.type === 'living').length,
          kitchen: rooms.filter(r => r.type === 'kitchen').length,
          dining: rooms.filter(r => r.type === 'dining').length,
          office: rooms.filter(r => r.type === 'office').length,
          garage: rooms.filter(r => r.type === 'garage').length,
          garden: rooms.filter(r => r.type === 'garden').length,
          laundry: rooms.filter(r => r.type === 'laundry').length,
          hallway: rooms.filter(r => r.type === 'hallway').length
        },
        occupiedArea: rooms.reduce((acc, r) => acc + (r.dimensions.width/20) * (r.dimensions.height/20), 0).toFixed(1),
        freeArea: terrainDimensions ? (terrainDimensions.width * terrainDimensions.height - rooms.reduce((acc, r) => acc + (r.dimensions.width/20) * (r.dimensions.height/20), 0)).toFixed(1) : '0'
      };

      const prompt = `Eres un arquitecto experto. Analiza la solicitud considerando el estado actual del plano:

ESTADO ACTUAL DEL PLANO:
- Terreno: ${currentPlan.terrain} (${currentPlan.area}m² total)
- Habitaciones existentes (${currentPlan.totalRooms}): ${currentPlan.rooms}
- Distribución actual: ${currentPlan.roomsByType.bedrooms} alcobas, ${currentPlan.roomsByType.bathrooms} baños, ${currentPlan.roomsByType.living} sala, ${currentPlan.roomsByType.kitchen} cocina, ${currentPlan.roomsByType.dining} comedor, ${currentPlan.roomsByType.office} oficina, ${currentPlan.roomsByType.garage} garaje, ${currentPlan.roomsByType.garden} jardín, ${currentPlan.roomsByType.laundry} lavandería, ${currentPlan.roomsByType.hallway} pasillo
- Área ocupada: ${currentPlan.occupiedArea}m²
- Área libre: ${currentPlan.freeArea}m²

SOLICITUD: "${userMessage}"

Si pide generar plano NUEVO (reemplazar todo):
{
  "shouldGeneratePlan": true,
  "dimensions": {"width": numero, "height": numero},
  "specs": {"bedrooms": numero, "bathrooms": numero, "hasGarage": boolean, "hasGarden": boolean, "hasOffice": boolean, "hasLaundry": boolean, "hasDining": boolean, "hasHallway": boolean, "openConcept": boolean, "separateRooms": boolean},
  "message": "🏗️ Generando plano NUEVO [ancho]x[alto]m reemplazando el actual. Incluirá [bedrooms] alcobas, [bathrooms] baños y espacios adicionales según especificaciones."
}

Si pide información del plano actual:
{
  "shouldGeneratePlan": false,
  "message": "📊 PLANO ACTUAL:\n\n🏠 Terreno: ${currentPlan.terrain} (${currentPlan.area}m²)\n📐 Habitaciones (${currentPlan.totalRooms}): ${currentPlan.roomsByType.bedrooms} alcobas, ${currentPlan.roomsByType.bathrooms} baños, ${currentPlan.roomsByType.living} sala, ${currentPlan.roomsByType.kitchen} cocina\n📏 Área ocupada: ${currentPlan.occupiedArea}m² | Área libre: ${currentPlan.freeArea}m²\n\n💡 Puedes pedir modificaciones específicas o generar un plano completamente nuevo."
}

Si pide plano simple:
{
  "shouldGeneratePlan": true,
  "dimensions": {"width": 10, "height": 8},
  "specs": {"bedrooms": 2, "bathrooms": 1, "hasGarage": false, "hasGarden": true, "hasOffice": false, "hasLaundry": true, "hasDining": true, "hasHallway": true, "openConcept": true},
  "message": "🏡 Generando plano simple 10x8m (80m²) con área social abierta (sala-cocina-comedor integrados): 2 alcobas, 1 baño, área social abierta, lavandería, jardín y pasillo."
}

Si no hay información suficiente:
{
  "shouldGeneratePlan": false,
  "message": "❓ Necesito más detalles. Ejemplos:\n\n🏠 'plano simple' → Casa básica 10x8m con área abierta\n📐 'casa 12x10m con 3 alcobas' → Personalizada\n🔓 'plano abierto 15x12m' → Concepto abierto sala-cocina-comedor\n🚪 'plano tradicional 12x10m' → Habitaciones separadas\n📊 'info del plano' → Ver estado actual\n🔄 'nuevo plano 15x12m' → Reemplazar actual\n\nEspecifica qué necesitas."
}

Responde SOLO con JSON válido. Considera el estado actual para dar recomendaciones inteligentes.`;
      
      const response = await genAI.models.generateContentStream({
        model: 'gemini-flash-latest',
        contents: [{
          role: 'user',
          parts: [{ text: prompt }]
        }]
      });
      
      let fullText = '';
      for await (const chunk of response) {
        fullText += chunk.text || '';
      }
      
      try {
        const jsonResponse = JSON.parse(fullText);
        return {
          response: jsonResponse.message,
          planData: jsonResponse.shouldGeneratePlan ? {
            dimensions: jsonResponse.dimensions,
            specs: jsonResponse.specs
          } : null
        };
      } catch {
        // If JSON parsing fails, extract message from raw text
        const messageMatch = fullText.match(/"message":\s*"([^"]+)"/); 
        return { 
          response: messageMatch ? messageMatch[1].replace(/\\n/g, '\n') : 'Error procesando respuesta' 
        };
      }
    } catch (error) {
      console.error('Gemini AI Error:', error);
      throw error;
    }
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
    setConversationContext(prev => [...prev.slice(-4), messageText]);
    setInputText('');
    setIsLoading(true);

    try {
      const aiResponse = await getAIResponse(messageText);
      
      const botMessage: Message = {
        id: (Date.now() + 1).toString(),
        text: aiResponse.response,
        isBot: true,
        timestamp: new Date(),
        type: aiResponse.planData ? 'plan' : 'info',
        metadata: {
          planData: aiResponse.planData,
          suggestions: getContextualSuggestions()
        }
      };
      
      setMessages(prev => [...prev, botMessage]);
      
      if (aiResponse.planData && onGeneratePlan) {
        const { dimensions, specs } = aiResponse.planData;
        toast.success('🏗️ Generando plano arquitectónico...');
        setTimeout(() => {
          onGeneratePlan(dimensions.width, dimensions.height, specs);
          toast.success('✅ Plano generado exitosamente');
        }, 1000);
      }
    } catch (error) {
      const errorMessage: Message = {
        id: (Date.now() + 1).toString(),
        text: '⚠️ Error de conexión. Verifica tu conexión a internet e intenta nuevamente.',
        isBot: true,
        timestamp: new Date(),
        type: 'error'
      };
      setMessages(prev => [...prev, errorMessage]);
      toast.error('Error en el asistente IA');
    } finally {
      setIsLoading(false);
    }
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
text: '👋 ¡Hola! Soy ARQUIA, tu asistente inteligente en diseño de planos.\nEstoy aquí para ayudarte a dar forma a tus ideas y convertir tus sueños en espacios reales.\nYa sea una casa, oficina, local o cualquier proyecto, juntos lo haremos realidad.\n✨ ¡Dime qué necesitas y comencemos a diseñar!',
      isBot: true,
      timestamp: new Date(),
      type: 'info'
    }]);
    setConversationContext([]);
    localStorage.removeItem('chatbot-history');
    toast.success('Chat reiniciado');
  };

  const exportChat = () => {
    const chatData = {
      messages,
      planContext: { rooms: rooms.length, terrain: terrainDimensions },
      exportDate: new Date().toISOString()
    };
    const blob = new Blob([JSON.stringify(chatData, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `chat-arquitecto-${new Date().toISOString().split('T')[0]}.json`;
    a.click();
    URL.revokeObjectURL(url);
    toast.success('Chat exportado');
  };

  const copyMessage = (text: string) => {
    navigator.clipboard.writeText(text);
    toast.success('Mensaje copiado');
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
                            {message.isBot && (
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => copyMessage(message.text)}
                                className="absolute top-1 right-1 opacity-0 group-hover:opacity-100 transition-opacity h-6 w-6 p-0"
                              >
                                <Copy className="w-3 h-3" />
                              </Button>
                            )}
                          </div>
                          <span className="text-xs text-gray-500 mt-1 px-2">
                            {message.timestamp.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
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
                  
                  {isLoading && (
                    <div className="flex justify-start">
                      <div className="bg-gray-100 p-3 rounded-2xl">
                        <div className="flex space-x-1">
                          <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce"></div>
                          <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{animationDelay: '0.1s'}}></div>
                          <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{animationDelay: '0.2s'}}></div>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
                <div ref={messagesEndRef} />
              </ScrollArea>

              {/* Suggestions */}
              {showSuggestions && getContextualSuggestions().length > 0 && (
                <div className="px-4 py-2 border-t bg-gray-50">
                  <div className="flex items-center gap-2 mb-2">
                    <Lightbulb className="w-4 h-4 text-yellow-600" />
                    <span className="text-xs font-medium text-gray-600">Sugerencias:</span>
                  </div>
                  <div className="flex flex-wrap gap-1">
                    {getContextualSuggestions().slice(0, 3).map((suggestion, idx) => (
                      <Button
                        key={idx}
                        variant="ghost"
                        size="sm"
                        onClick={() => handleSend(suggestion)}
                        className="text-xs h-6 px-2 bg-white hover:bg-gray-100"
                      >
                        {suggestion}
                      </Button>
                    ))}
                  </div>
                </div>
              )}

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
                    {isLoading ? (
                      <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                    ) : (
                      <Send className="w-4 h-4" />
                    )}
                  </Button>
                </div>
                <div className="flex justify-between items-center mt-2">
                  <div className="flex gap-1">
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => handleSend('info del plano')}
                      className="text-xs h-6 px-2"
                    >
                      <Home className="w-3 h-3 mr-1" />Info
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={exportChat}
                      className="text-xs h-6 px-2"
                    >
                      <Download className="w-3 h-3 mr-1" />Exportar
                    </Button>
                  </div>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => setShowSuggestions(!showSuggestions)}
                    className="text-xs h-6 px-2"
                  >
                    <Settings className="w-3 h-3" />
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