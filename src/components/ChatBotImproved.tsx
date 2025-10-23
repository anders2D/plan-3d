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
        text: '🏛️ **¡Bienvenido a tu Estudio de Arquitectura Virtual!**\n\nSoy tu **Arquitecto IA Profesional** 👨‍💼 especializado en diseño residencial inteligente. Transformo tus ideas en planos arquitectónicos reales.\n\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n\n🎯 **COMANDOS INTELIGENTES**\n\n**📊 Análisis & Info:**\n• `info` → Diagnóstico completo del plano actual\n• `herramientas` → Catálogo de 14+ espacios disponibles\n\n**🏗️ Creación de Planos:**\n• `casa moderna 12x10` → Diseño contemporáneo\n• `plano familiar con 3 alcobas` → Distribución clásica\n• `concepto abierto 15x12` → Espacios integrados\n\n**🔧 Modificaciones Precisas:**\n• `cambiar terreno a 18x15` → Redimensionar lote\n• `ampliar alcoba principal a 4x4` → Ajustar habitación\n• `agregar jardín de 6x4 metros` → Nuevo espacio\n• `eliminar garaje` → Remover elemento\n\n**🎨 Personalización Avanzada:**\n• `suite principal con baño privado` → Diseño exclusivo\n• `cocina americana integrada` → Concepto abierto\n• `pasillo central de 1.5m` → Circulación optimizada\n\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n\n✨ **TECNOLOGÍA PROFESIONAL:**\n🔹 **Diseño arquitectónico** profesional\n🔹 **Análisis bioclimático** automático\n🔹 **Zonificación inteligente** (íntima/social/servicios)\n🔹 **Optimización de circulaciones** y privacidad\n🔹 **Cálculos de áreas** y eficiencia espacial\n\n💡 **¿Listo para diseñar tu hogar ideal?**\nDescribe tu proyecto en lenguaje natural o usa los comandos específicos. ¡Hagamos realidad tu visión arquitectónica!',
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

  // Función para mostrar herramientas disponibles
  const getAvailableTools = () => {
    return {
      habitaciones: [
        { type: 'bedroom', name: 'Alcoba', icon: '🛏️', defaultSize: '3.5x3.5m' },
        { type: 'bathroom', name: 'Baño', icon: '🚿', defaultSize: '2.5x2.5m' },
        { type: 'living', name: 'Sala', icon: '🛋️', defaultSize: '4x4m' },
        { type: 'kitchen', name: 'Cocina', icon: '🍳', defaultSize: '3x3m' },
        { type: 'dining', name: 'Comedor', icon: '🍽️', defaultSize: '3x3m' },
        { type: 'office', name: 'Oficina', icon: '💼', defaultSize: '3x3m' }
      ],
      espaciosAdicionales: [
        { type: 'garage', name: 'Garaje', icon: '🚗', defaultSize: '3.5x6m' },
        { type: 'garden', name: 'Jardín', icon: '🌱', defaultSize: '4x4m' },
        { type: 'laundry', name: 'Lavandería', icon: '🧱', defaultSize: '2x2.5m' },
        { type: 'stairs', name: 'Escaleras', icon: '🪜', defaultSize: '2x3m' },
        { type: 'hallway', name: 'Pasillo', icon: '🚺', defaultSize: '1.5x4m' },
        { type: 'balcony', name: 'Balcón', icon: '🏠', defaultSize: '2x3m' },
        { type: 'closet', name: 'Closet', icon: '👔', defaultSize: '1.5x2m' },
        { type: 'storage', name: 'Depósito', icon: '📦', defaultSize: '2x2m' }
      ]
    };
  };

  // Función para procesar descripción de habitaciones
  const processRoomDescription = (description: string) => {
    const tools = getAvailableTools();
    
    let response = '🏗️ **ANÁLISIS DE TU DESCRIPCIÓN**\n\n';
    
    // Buscar números de habitaciones
    const bedroomMatch = description.match(/(\d+)\s*(habitacion|alcoba|cuarto)s?/i);
    const bathroomMatch = description.match(/(\d+)\s*(baño|bano)s?/i);
    const sizeMatch = description.match(/(\d+(?:\.\d+)?)\s*x\s*(\d+(?:\.\d+)?)\s*m/i);
    
    if (bedroomMatch || bathroomMatch) {
      response += '📊 **Habitaciones solicitadas:**\n';
      if (bedroomMatch) response += `• ${bedroomMatch[1]} alcobas\n`;
      if (bathroomMatch) response += `• ${bathroomMatch[1]} baños\n`;
      response += '\n';
    }
    
    if (sizeMatch) {
      response += '📐 **Medidas especificadas:** ${sizeMatch[1]}x${sizeMatch[2]}m\n\n';
    }
    
    // Mostrar herramientas disponibles
    response += '🏛️ **CATÁLOGO ARQUITECTÓNICO PROFESIONAL**\n\n';
    response += '━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n\n';
    response += '🏠 **ESPACIOS HABITACIONALES:**\n';
    tools.habitaciones.forEach(room => {
      response += `• ${room.icon} **${room.name}** (${room.defaultSize}) - Diseño optimizado\n`;
    });
    
    response += '\n🌿 **ESPACIOS COMPLEMENTARIOS:**\n';
    tools.espaciosAdicionales.forEach(room => {
      response += `• ${room.icon} **${room.name}** (${room.defaultSize}) - Funcionalidad especializada\n`;
    });
    
    response += '\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n\n';
    response += '💡 **EJEMPLOS DE COMANDOS PROFESIONALES:**\n\n';
    response += '🔹 `agregar suite principal 4.5x4` → Alcoba con baño privado\n';
    response += '🔹 `cocina americana 4x3 integrada` → Concepto abierto\n';
    response += '🔹 `jardín bioclimático 6x5` → Espacio verde optimizado\n';
    response += '🔹 `garaje doble 6x3.5` → Estacionamiento amplio\n';
    response += '🔹 `oficina en casa 3.5x3` → Espacio de trabajo\n\n';
    response += '✨ **¿Qué espacio arquitectónico deseas crear hoy?**\n';
    response += '*Describe tu visión y la haré realidad con precisión profesional*';
    
    return response;
  };

  // Función para procesar modificaciones del plano
  const processModification = (description: string) => {
    const lowerDesc = description.toLowerCase();
    
    // Cambiar tamaño del terreno
    const terrainMatch = lowerDesc.match(/(terreno|lote).*?(\d+(?:\.\d+)?)\s*x\s*(\d+(?:\.\d+)?)/i);
    if (terrainMatch) {
      return {
        action: 'terrain',
        width: parseFloat(terrainMatch[2]),
        height: parseFloat(terrainMatch[3]),
        response: `🏗️ **TERRENO MODIFICADO**\n\nNuevas dimensiones: ${terrainMatch[2]}x${terrainMatch[3]}m\nÁrea total: ${(parseFloat(terrainMatch[2]) * parseFloat(terrainMatch[3])).toFixed(1)}m²\n\n✅ Terreno actualizado exitosamente`
      };
    }
    
    // Cambiar tamaño de habitación específica
    const roomResizeMatch = lowerDesc.match(/(alcoba|baño|sala|cocina|comedor|garaje|jardín).*?(\d+(?:\.\d+)?)\s*x\s*(\d+(?:\.\d+)?)/i);
    if (roomResizeMatch) {
      const roomType = roomResizeMatch[1];
      const width = parseFloat(roomResizeMatch[2]);
      const height = parseFloat(roomResizeMatch[3]);
      return {
        action: 'resize_room',
        roomType,
        width,
        height,
        response: `📐 **HABITACIÓN REDIMENSIONADA**\n\n${roomType.charAt(0).toUpperCase() + roomType.slice(1)}: ${width}x${height}m\nÁrea: ${(width * height).toFixed(1)}m²\n\n✅ Dimensiones actualizadas`
      };
    }
    
    // Eliminar habitación - mejorado para detectar nombres específicos
    const deleteMatch = lowerDesc.match(/eliminar|quitar|borrar.*?(alcoba|baño|bano|sala|cocina|comedor|garaje|jardín|jardin|oficina|lavandería|lavanderia|principal)/i);
    if (deleteMatch) {
      return {
        action: 'delete_room',
        roomType: deleteMatch[1],
        response: `🗑️ **HABITACIÓN ELIMINADA**\n\n${deleteMatch[1].charAt(0).toUpperCase() + deleteMatch[1].slice(1)} removida del plano\n\n✅ Modificación aplicada exitosamente`
      };
    }
    
    return { action: null, response: '' };
  };

  // Función para ejecutar modificaciones
  const executeModification = (modification: any) => {
    if (modification.action === 'terrain' && onTerrainUpdate) {
      onTerrainUpdate({ width: modification.width, height: modification.height });
      toast.success('Terreno redimensionado');
    }
    
    if (modification.action === 'resize_room' && onRoomUpdate) {
      const roomTypeMap: { [key: string]: string } = {
        'alcoba': 'bedroom', 'baño': 'bathroom', 'sala': 'living',
        'cocina': 'kitchen', 'comedor': 'dining', 'garaje': 'garage',
        'jardín': 'garden', 'oficina': 'office', 'lavandería': 'laundry'
      };
      
      const targetType = roomTypeMap[modification.roomType] || modification.roomType;
      const targetRoom = rooms.find(r => r.type === targetType);
      
      if (targetRoom) {
        const updatedRoom = {
          ...targetRoom,
          dimensions: {
            width: modification.width * 20,
            height: modification.height * 20
          }
        };
        onRoomUpdate(updatedRoom);
        toast.success(`${targetRoom.name} redimensionada`);
      }
    }
    
    if (modification.action === 'delete_room' && onRoomDelete) {
      const roomTypeMap: { [key: string]: string } = {
        'alcoba': 'bedroom', 'baño': 'bathroom', 'bano': 'bathroom', 'sala': 'living',
        'cocina': 'kitchen', 'comedor': 'dining', 'garaje': 'garage',
        'jardín': 'garden', 'jardin': 'garden', 'oficina': 'office', 
        'lavandería': 'laundry', 'lavanderia': 'laundry', 'principal': 'bathroom'
      };
      
      const targetType = roomTypeMap[modification.roomType] || modification.roomType;
      
      // Buscar por tipo o por nombre que contenga la palabra clave
      let targetRoom = rooms.find(r => r.type === targetType);
      
      // Si no encuentra por tipo, buscar por nombre
      if (!targetRoom && modification.roomType === 'principal') {
        targetRoom = rooms.find(r => r.name.toLowerCase().includes('principal'));
      }
      
      if (targetRoom) {
        onRoomDelete(targetRoom.id);
        toast.success(`${targetRoom.name} eliminada`);
      } else {
        toast.error(`No se encontró ${modification.roomType} en el plano`);
      }
    }
  };

  const getAIResponse = async (userMessage: string): Promise<{response: string, planData?: any, action?: string}> => {
    try {
      const currentPlan = {
        terrain: terrainDimensions ? `${terrainDimensions.width}x${terrainDimensions.height}m` : 'No definido',
        rooms: rooms.map(r => {
          const widthM = (r.dimensions.width/20).toFixed(1);
          const heightM = (r.dimensions.height/20).toFixed(1);
          const areaM = (parseFloat(widthM) * parseFloat(heightM)).toFixed(1);
          const posX = terrainDimensions ? ((r.position.x - (800 - terrainDimensions.width * 20) / 2) / 20).toFixed(1) : '0';
          const posY = terrainDimensions ? ((r.position.y - (600 - terrainDimensions.height * 20) / 2) / 20).toFixed(1) : '0';
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

      const contextHistory = conversationContext.length > 0 ? `\n\nCONTEXTO CONVERSACIÓN PREVIA:\n${conversationContext.join(' → ')}` : '';
      
      const prompt = `Eres ARQUIA, un asistente cálido y experto en diseño de espacios. Tu personalidad es amigable, empática y siempre buscas entender las necesidades reales del usuario.

🏠 CONTEXTO ACTUAL:
- Terreno: ${currentPlan.terrain} (${currentPlan.area}m²)
- Habitaciones: ${currentPlan.totalRooms} (${currentPlan.rooms})
- Distribución: ${currentPlan.roomsByType.bedrooms} alcobas, ${currentPlan.roomsByType.bathrooms} baños
- Ocupación: ${currentPlan.occupiedArea}m² | Libre: ${currentPlan.freeArea}m²${contextHistory}

👤 USUARIO DICE: "${userMessage}"

🎯 INSTRUCCIONES:

SI PIDE GENERAR PLANO NUEVO:
{
  "shouldGeneratePlan": true,
  "dimensions": {"width": numero_entre_8_y_25, "height": numero_entre_6_y_20},
  "specs": {
    "bedrooms": numero_entre_1_y_5, 
    "bathrooms": numero_entre_1_y_4, 
    "hasGarage": boolean,
    "hasGarden": boolean,
    "hasOffice": boolean,
    "hasLaundry": boolean,
    "hasDining": boolean,
    "hasHallway": boolean,
    "openConcept": boolean,
    "separateRooms": boolean,
    "suiteMode": boolean
  },
  "rooms": [
    {
      "type": "bedroom|bathroom|living|kitchen|dining|office|garage|garden|laundry|hallway|balcony|closet|storage",
      "name": "Nombre descriptivo",
      "position": {"x": coordenada_x_en_metros, "y": coordenada_y_en_metros},
      "dimensions": {"width": ancho_en_metros, "height": alto_en_metros}
    }
  ],
  "message": "😊 ¡Perfecto! He entendido lo que necesitas. Voy a crear un plano de [width]x[height]m con [bedrooms] alcobas y [bathrooms] baños.\\n\\n🏗️ **Características:**\\n• Diseño pensado para tu comodidad\\n• Espacios bien iluminados\\n• Circulación fluida\\n\\n✨ En unos segundos verás tu nuevo hogar tomar forma. ¿Te parece bien?"
}

SI PIDE INFORMACIÓN:
{
  "shouldGeneratePlan": false,
  "message": "📊 **Tu plano actual:**\\n\\n🏠 Terreno: ${currentPlan.terrain}\\n🏡 Habitaciones: ${currentPlan.totalRooms}\\n📏 Espacio usado: ${currentPlan.occupiedArea}m²\\n\\n💡 **Mi sugerencia:** ${parseFloat(currentPlan.freeArea) > 50 ? 'Tienes espacio para agregar más habitaciones o un jardín' : 'Tu distribución está bien optimizada'}\\n\\n¿Qué te gustaría cambiar o mejorar?"
}

SI NO ENTIENDE:
{
  "shouldGeneratePlan": false,
  "message": "🤔 Quiero asegurarme de entenderte bien. ¿Podrías contarme un poco más?\\n\\n💭 **Por ejemplo:**\\n• \"Una casa sencilla para 4 personas\"\\n• \"Necesito 3 habitaciones y garaje\"\\n• \"Algo moderno con cocina abierta\"\\n\\n😊 No te preocupes, juntos encontraremos la solución perfecta."
}

REGLAS IMPORTANTES:
- Responde SOLO con JSON válido
- Sé cálido y empático como ARQUIA
- SIEMPRE incluye el array "rooms" con las coordenadas exactas de cada habitación
- Las coordenadas deben estar en metros (0,0 es esquina superior izquierda)
- Asegúrate que las habitaciones no se superpongan
- Valida que todas las habitaciones quepan dentro del terreno
- Usa distribución arquitectónica profesional (zona íntima, social, servicios)`;
      
      const response = await genAI.models.generateContentStream({
        model: 'gemini-2.5-pro',
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
        console.log('=== RESPUESTA COMPLETA DE AI ===');
        console.log('Texto completo:', fullText);
        
        // Limpiar markdown code blocks
        let cleanText = fullText.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
        console.log('Texto limpio:', cleanText);
        
        const jsonResponse = JSON.parse(cleanText);
        console.log('JSON parseado:', jsonResponse);
        console.log('shouldGeneratePlan:', jsonResponse.shouldGeneratePlan);
        return {
          response: jsonResponse.message,
          planData: jsonResponse.shouldGeneratePlan ? {
            dimensions: jsonResponse.dimensions,
            specs: jsonResponse.specs,
            rooms: jsonResponse.rooms || []
          } : null
        };
      } catch (error) {
        console.log('=== ERROR AL PARSEAR JSON ===');
        console.log('Error:', error);
        console.log('Texto que falló:', fullText);
        console.log('===============================');
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

    // Todas las solicitudes van directamente a la AI

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
        const { dimensions, specs, rooms } = aiResponse.planData;
        console.log('=== RESPUESTA AI PARA GENERAR PLANO ===');
        console.log('Respuesta completa:', aiResponse);
        console.log('Dimensiones:', dimensions);
        console.log('Especificaciones:', specs);
        console.log('Habitaciones con coordenadas:', rooms);
        console.log('Mensaje:', aiResponse.response);
        console.log('=====================================');
        toast.success('🏗️ Generando plano arquitectónico...');
        setTimeout(() => {
          onGeneratePlan(dimensions.width, dimensions.height, specs, rooms);
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
text: '😊 ¡Hola de nuevo! Soy ARQUIA, y me da mucha alegría verte por aquí.\n\nEmpecemos con una nueva aventura de diseño. No importa si tienes una idea clara o solo una sensación de lo que quieres, estoy aquí para acompañarte en cada paso.\n\n🏠 Cuéntame: ¿qué espacio te gustaría crear hoy? Puede ser tan simple como "una casita cómoda" o tan detallado como quieras.\n\n✨ Confía en mí, juntos haremos algo increíble.',
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
    a.download = `chat-arquia-${new Date().toISOString().split('T')[0]}.json`;
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
placeholder="Cuéntame sobre tu hogar soñado..."
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