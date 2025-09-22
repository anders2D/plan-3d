import { useRef, useEffect, useState } from 'react';
import * as THREE from 'three';
import { OrbitControls } from 'three-stdlib';
import { Room, Dimensions } from '@/types/floorplan';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

interface FloorPlan3DProps {
  rooms: Room[];
  terrainDimensions: Dimensions;
  onClose: () => void;
}

interface RoomHeight {
  [roomId: string]: number;
}

interface Door {
  id: string;
  roomId: string;
  wall: 'front' | 'back' | 'left' | 'right';
  position: number; // 0-1 along the wall
  width: number;
  height: number;
}

interface Window {
  id: string;
  roomId: string;
  wall: 'front' | 'back' | 'left' | 'right';
  position: number; // 0-1 along the wall
  width: number;
  height: number;
  bottomHeight: number;
  design?: string;
}

export const FloorPlan3D = ({ rooms, terrainDimensions, onClose }: FloorPlan3DProps) => {
  const mountRef = useRef<HTMLDivElement>(null);
  const sceneRef = useRef<THREE.Scene>();
  const rendererRef = useRef<THREE.WebGLRenderer>();
  const cameraRef = useRef<THREE.PerspectiveCamera>();
  const controlsRef = useRef<OrbitControls>();
  const animationRef = useRef<number>();
  const [roomHeights, setRoomHeights] = useState<RoomHeight>({});
  const [isRealistic, setIsRealistic] = useState(false);
  const [selectedRoomId, setSelectedRoomId] = useState<string | null>(null);
  const [doors, setDoors] = useState<Door[]>([]);
  const [windows, setWindows] = useState<Window[]>([]);
  const [editMode, setEditMode] = useState<'height' | 'door' | 'window'>('height');
  const [selectedWall, setSelectedWall] = useState<string>('simple');
  const [showWindowDesigns, setShowWindowDesigns] = useState(false);
  const [selectedWindowId, setSelectedWindowId] = useState<string | null>(null);
  const [isDraggingWindow, setIsDraggingWindow] = useState(false);
  const [windowDesigns] = useState([
    { id: 'simple', name: 'Simple', color: 0x87CEEB },
    { id: 'frame', name: 'Con Marco', color: 0x4682B4 },
    { id: 'grid', name: 'Con Rejilla', color: 0x6495ED },
    { id: 'arch', name: 'Arqueada', color: 0x5F9EA0 },
    { id: 'bay', name: 'Ventana Saliente', color: 0x708090 },
    { id: 'french', name: 'Francesa', color: 0x778899 }
  ]);

  useEffect(() => {
    if (!mountRef.current) return;

    // Scene setup
    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0xf0f0f0);
    sceneRef.current = scene;

    // Camera setup
    const camera = new THREE.PerspectiveCamera(
      75,
      mountRef.current.clientWidth / mountRef.current.clientHeight,
      0.1,
      1000
    );
    camera.position.set(20, 15, 20);
    cameraRef.current = camera;

    // Renderer setup
    const renderer = new THREE.WebGLRenderer({ antialias: true });
    renderer.setSize(mountRef.current.clientWidth, mountRef.current.clientHeight);
    renderer.shadowMap.enabled = false;
    rendererRef.current = renderer;
    mountRef.current.appendChild(renderer.domElement);

    // Controls setup
    const controls = new OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true;
    controls.dampingFactor = 0.05;
    controls.minDistance = 1;
    controls.maxDistance = 200;
    controls.enablePan = true;
    controls.enableZoom = true;
    controls.enableRotate = true;
    controls.target.set(0, 0, 0);
    controlsRef.current = controls;

    // Lighting
    const ambientLight = new THREE.AmbientLight(0x404040, 0.8);
    scene.add(ambientLight);

    // Multiple directional lights for even coverage
    const directionalLight1 = new THREE.DirectionalLight(0xffffff, 0.6);
    directionalLight1.position.set(10, 10, 5);
    scene.add(directionalLight1);

    const directionalLight2 = new THREE.DirectionalLight(0xffffff, 0.4);
    directionalLight2.position.set(-10, 10, -5);
    scene.add(directionalLight2);

    const directionalLight3 = new THREE.DirectionalLight(0xffffff, 0.3);
    directionalLight3.position.set(5, 10, -10);
    scene.add(directionalLight3);

    const directionalLight4 = new THREE.DirectionalLight(0xffffff, 0.3);
    directionalLight4.position.set(-5, 10, 10);
    scene.add(directionalLight4);

    // Create textures
    const createBrickTexture = () => {
      const canvas = document.createElement('canvas');
      canvas.width = 512;
      canvas.height = 512;
      const ctx = canvas.getContext('2d')!;
      
      // Base brick color
      ctx.fillStyle = '#8B4513';
      ctx.fillRect(0, 0, 512, 512);
      
      // Mortar lines
      ctx.strokeStyle = '#D3D3D3';
      ctx.lineWidth = 4;
      
      // Horizontal mortar lines
      for (let y = 0; y < 512; y += 64) {
        ctx.beginPath();
        ctx.moveTo(0, y);
        ctx.lineTo(512, y);
        ctx.stroke();
      }
      
      // Vertical mortar lines (offset pattern)
      for (let row = 0; row < 8; row++) {
        const offset = (row % 2) * 64;
        for (let x = offset; x < 512; x += 128) {
          ctx.beginPath();
          ctx.moveTo(x, row * 64);
          ctx.lineTo(x, (row + 1) * 64);
          ctx.stroke();
        }
      }
      
      // Add brick texture variation
      for (let i = 0; i < 100; i++) {
        ctx.fillStyle = `rgba(${139 + Math.random() * 40}, ${69 + Math.random() * 30}, ${19 + Math.random() * 20}, 0.3)`;
        ctx.fillRect(Math.random() * 512, Math.random() * 512, Math.random() * 20, Math.random() * 10);
      }
      
      return new THREE.CanvasTexture(canvas);
    };

    const createFloorTexture = (color: number) => {
      const canvas = document.createElement('canvas');
      canvas.width = 256;
      canvas.height = 256;
      const ctx = canvas.getContext('2d')!;
      
      const r = (color >> 16) & 255;
      const g = (color >> 8) & 255;
      const b = color & 255;
      
      ctx.fillStyle = `rgb(${r}, ${g}, ${b})`;
      ctx.fillRect(0, 0, 256, 256);
      
      // Add tile pattern
      ctx.strokeStyle = `rgba(${Math.max(0, r-30)}, ${Math.max(0, g-30)}, ${Math.max(0, b-30)}, 0.5)`;
      ctx.lineWidth = 2;
      
      for (let x = 0; x < 256; x += 64) {
        ctx.beginPath();
        ctx.moveTo(x, 0);
        ctx.lineTo(x, 256);
        ctx.stroke();
      }
      
      for (let y = 0; y < 256; y += 64) {
        ctx.beginPath();
        ctx.moveTo(0, y);
        ctx.lineTo(256, y);
        ctx.stroke();
      }
      
      return new THREE.CanvasTexture(canvas);
    };

    const brickTexture = createBrickTexture();
    brickTexture.wrapS = THREE.RepeatWrapping;
    brickTexture.wrapT = THREE.RepeatWrapping;
    brickTexture.repeat.set(2, 1);

    // Ground plane
    const groundGeometry = new THREE.PlaneGeometry(terrainDimensions.width, terrainDimensions.height);
    const groundMaterial = isRealistic 
      ? new THREE.MeshPhongMaterial({ 
          color: 0x8FBC8F,
          shininess: 5
        })
      : new THREE.MeshLambertMaterial({ color: 0xcccccc });
    const ground = new THREE.Mesh(groundGeometry, groundMaterial);
    ground.rotation.x = -Math.PI / 2;
    scene.add(ground);

    // Room colors
    const roomColors = {
      bedroom: 0x8b5cf6,
      bathroom: 0x3b82f6,
      living: 0xf97316,
      kitchen: 0x10b981,
      closet: 0xa855f7,
      garage: 0x6b7280,
      garden: 0x16a34a,
      laundry: 0x2563eb,
      stairs: 0xeab308,
      balcony: 0x0284c7,
      office: 0xca8a04,
      dining: 0xdb2777,
      storage: 0x64748b
    };

    // Create 3D rooms
    rooms.forEach(room => {
      const roomGroup = new THREE.Group();

      // Convert 2D canvas coordinates to 3D world coordinates
      const { offsetX, offsetY, scaledWidth, scaledHeight, scale } = getTerrainBounds();
      const worldX = ((room.position.x - offsetX) / scale) - (terrainDimensions.width / 2);
      const worldZ = ((room.position.y - offsetY) / scale) - (terrainDimensions.height / 2);
      const worldWidth = room.dimensions.width / scale;
      const worldHeight = room.dimensions.height / scale;

      // Floor
      const floorGeometry = new THREE.PlaneGeometry(worldWidth, worldHeight);
      const roomColor = roomColors[room.type as keyof typeof roomColors] || 0x888888;
      const floorMaterial = isRealistic
        ? new THREE.MeshPhongMaterial({ 
            map: createFloorTexture(roomColor),
            shininess: 30,
            specular: 0x222222
          })
        : new THREE.MeshLambertMaterial({ 
            color: roomColor,
            transparent: true,
            opacity: 0.8
          });
      const floor = new THREE.Mesh(floorGeometry, floorMaterial);
      floor.rotation.x = -Math.PI / 2;
      floor.position.set(worldX + worldWidth/2, 0.01, worldZ + worldHeight/2);
      roomGroup.add(floor);

      // Walls
      const wallHeight = roomHeights[room.id] || 2.5;
      const wallThickness = 0.1;
      const wallMaterial = isRealistic 
        ? new THREE.MeshPhongMaterial({ 
            map: brickTexture,
            shininess: 10,
            specular: 0x111111
          })
        : new THREE.MeshLambertMaterial({ color: 0xffffff });

      // Front wall
      const frontWallGeometry = new THREE.BoxGeometry(worldWidth, wallHeight, wallThickness);
      const frontWall = new THREE.Mesh(frontWallGeometry, wallMaterial.clone());
      if (isRealistic) {
        frontWall.material.map.repeat.set(worldWidth / 2, wallHeight / 2);
      }
      frontWall.position.set(worldX + worldWidth/2, wallHeight/2, worldZ);
      frontWall.userData = { type: 'wall', roomId: room.id, wall: 'front', roomName: room.name };
      roomGroup.add(frontWall);

      // Back wall
      const backWall = new THREE.Mesh(frontWallGeometry, wallMaterial.clone());
      if (isRealistic) {
        backWall.material.map.repeat.set(worldWidth / 2, wallHeight / 2);
      }
      backWall.position.set(worldX + worldWidth/2, wallHeight/2, worldZ + worldHeight);
      backWall.userData = { type: 'wall', roomId: room.id, wall: 'back', roomName: room.name };
      roomGroup.add(backWall);

      // Left wall
      const sideWallGeometry = new THREE.BoxGeometry(wallThickness, wallHeight, worldHeight);
      const leftWall = new THREE.Mesh(sideWallGeometry, wallMaterial.clone());
      if (isRealistic) {
        leftWall.material.map.repeat.set(1, wallHeight / 2);
      }
      leftWall.position.set(worldX, wallHeight/2, worldZ + worldHeight/2);
      leftWall.userData = { type: 'wall', roomId: room.id, wall: 'left', roomName: room.name };
      roomGroup.add(leftWall);

      // Right wall
      const rightWall = new THREE.Mesh(sideWallGeometry, wallMaterial.clone());
      if (isRealistic) {
        rightWall.material.map.repeat.set(1, wallHeight / 2);
      }
      rightWall.position.set(worldX + worldWidth, wallHeight/2, worldZ + worldHeight/2);
      rightWall.userData = { type: 'wall', roomId: room.id, wall: 'right', roomName: room.name };
      roomGroup.add(rightWall);



      // Room label
      const canvas = document.createElement('canvas');
      const context = canvas.getContext('2d')!;
      canvas.width = 256;
      canvas.height = 64;
      context.fillStyle = '#ffffff';
      context.fillRect(0, 0, canvas.width, canvas.height);
      context.fillStyle = '#000000';
      context.font = '20px Arial';
      context.textAlign = 'center';
      context.fillText(room.name, canvas.width/2, 40);

      const texture = new THREE.CanvasTexture(canvas);
      const labelMaterial = new THREE.MeshBasicMaterial({ map: texture });
      const labelGeometry = new THREE.PlaneGeometry(1, 0.25);
      const label = new THREE.Mesh(labelGeometry, labelMaterial);
      label.position.set(worldX + worldWidth/2, wallHeight + 0.5, worldZ + worldHeight/2);
      roomGroup.add(label);

      // Add click handler for room selection
      roomGroup.userData = { roomId: room.id, roomName: room.name };
      scene.add(roomGroup);
    });

    // Raycaster for room selection
    const raycaster = new THREE.Raycaster();
    const mouse = new THREE.Vector2();

    const onMouseClick = (event: MouseEvent) => {
      console.log('Click detected, editMode:', editMode);
      const rect = renderer.domElement.getBoundingClientRect();
      mouse.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
      mouse.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;

      raycaster.setFromCamera(mouse, camera);
      const intersects = raycaster.intersectObjects(scene.children, true);
      console.log('Intersects found:', intersects.length);

      if (intersects.length > 0) {
        const intersect = intersects[0];
        const object = intersect.object;
        console.log('Object userData:', object.userData);
        
        if (object.userData.type === 'window') {
          if (editMode === 'window') {
            // Start dragging window
            setSelectedWindowId(object.userData.id);
            setIsDraggingWindow(true);
            if (controlsRef.current) {
              controlsRef.current.enabled = false;
            }
          } else {
            // Show design menu only in height mode
            setSelectedWindowId(object.userData.id);
            setShowWindowDesigns(true);
          }
        } else if (editMode === 'door' || (editMode === 'window' && !isDraggingWindow)) {
          // Check all intersected objects for walls
          for (const hit of intersects) {
            if (hit.object.userData.type === 'wall') {
              const wallData = hit.object.userData;
              const point = hit.point;
              console.log('Wall found:', wallData);
              
              const room = rooms.find(r => r.id === wallData.roomId);
              if (room) {
                const { offsetX, offsetY, scaledWidth, scaledHeight, scale } = getTerrainBounds();
                const worldX = ((room.position.x - offsetX) / scale) - (terrainDimensions.width / 2);
                const worldZ = ((room.position.y - offsetY) / scale) - (terrainDimensions.height / 2);
                const worldWidth = room.dimensions.width / scale;
                const worldHeight = room.dimensions.height / scale;
                
                let position = 0.5;
                if (wallData.wall === 'front' || wallData.wall === 'back') {
                  position = Math.max(0.1, Math.min(0.9, (point.x - worldX) / worldWidth));
                } else {
                  position = Math.max(0.1, Math.min(0.9, (point.z - worldZ) / worldHeight));
                }
                
                if (editMode === 'door') {
                  const newDoor: Door = {
                    id: Date.now().toString(),
                    roomId: wallData.roomId,
                    wall: wallData.wall,
                    position: position,
                    width: 0.8,
                    height: 2.0
                  };
                  setDoors(prev => [...prev, newDoor]);
                  console.log('Door created');
                } else if (editMode === 'window') {
                  const selectedDesign = windowDesigns.find(d => d.id === selectedWall) || windowDesigns[0];
                  const newWindow: Window = {
                    id: Date.now().toString(),
                    roomId: wallData.roomId,
                    wall: wallData.wall,
                    position: position,
                    width: 1.0,
                    height: 1.0,
                    bottomHeight: 1.0,
                    design: selectedDesign.id
                  };
                  setWindows(prev => {
                    const updated = [...prev, newWindow];
                    // Force update the scene
                    setTimeout(() => {
                      if (sceneRef.current) {
                        // Remove existing windows
                        const toRemove: THREE.Object3D[] = [];
                        sceneRef.current.traverse((child) => {
                          if (child.userData.type === 'window') {
                            toRemove.push(child);
                          }
                        });
                        toRemove.forEach(obj => sceneRef.current!.remove(obj));
                        
                        // Add all windows
                        updated.forEach(window => {
                          const room = rooms.find(r => r.id === window.roomId);
                          if (room) {
                            const { offsetX, offsetY, scaledWidth, scaledHeight, scale } = getTerrainBounds();
                            const worldX = ((room.position.x - offsetX) / scale) - (terrainDimensions.width / 2);
                            const worldZ = ((room.position.y - offsetY) / scale) - (terrainDimensions.height / 2);
                            const worldWidth = room.dimensions.width / scale;
                            const worldHeight = room.dimensions.height / scale;
                            
                            let windowGeometry, windowX, windowY, windowZ;
                            const design = windowDesigns.find(d => d.id === window.design) || windowDesigns[0];
                            const windowMaterial = new THREE.MeshPhongMaterial({ 
                              color: design.color, 
                              transparent: true, 
                              opacity: 0.9,
                              emissive: design.color,
                              emissiveIntensity: 0.1
                            });
                            
                            if (window.wall === 'front' || window.wall === 'back') {
                              windowGeometry = new THREE.BoxGeometry(window.width, window.height, 0.1);
                              windowX = worldX + window.position * worldWidth;
                              windowY = window.bottomHeight + window.height / 2;
                              windowZ = window.wall === 'front' ? worldZ - 0.05 : worldZ + worldHeight + 0.05;
                            } else {
                              windowGeometry = new THREE.BoxGeometry(0.1, window.height, window.width);
                              windowX = window.wall === 'left' ? worldX - 0.05 : worldX + worldWidth + 0.05;
                              windowY = window.bottomHeight + window.height / 2;
                              windowZ = worldZ + window.position * worldHeight;
                            }
                            
                            const windowMesh = new THREE.Mesh(windowGeometry, windowMaterial);
                            windowMesh.position.set(windowX, windowY, windowZ);
                            windowMesh.userData = { type: 'window', id: window.id };
                            sceneRef.current!.add(windowMesh);
                          }
                        });
                      }
                    }, 0);
                    return updated;
                  });
                  console.log('Window created with design:', selectedDesign.id);
                  // Auto switch to height mode after creating window
                  setEditMode('height');
                }
                
                setSelectedRoomId(wallData.roomId);
                return; // Exit after creating element
              }
            }
          }
        }
        
        // Regular room selection
        let roomObject = intersects[0].object;
        while (roomObject.parent && !roomObject.userData.roomId) {
          roomObject = roomObject.parent;
        }
        if (roomObject.userData.roomId) {
          setSelectedRoomId(roomObject.userData.roomId);
        }
      }
    };

    const onMouseMove = (event: MouseEvent) => {
      if (isDraggingWindow && selectedWindowId) {
        const rect = renderer.domElement.getBoundingClientRect();
        mouse.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
        mouse.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;

        raycaster.setFromCamera(mouse, camera);
        const intersects = raycaster.intersectObjects(scene.children, true);

        for (const hit of intersects) {
          if (hit.object.userData.type === 'wall') {
            const wallData = hit.object.userData;
            const point = hit.point;
            
            const room = rooms.find(r => r.id === wallData.roomId);
            if (room) {
              const { offsetX, offsetY, scaledWidth, scaledHeight, scale } = getTerrainBounds();
              const worldX = ((room.position.x - offsetX) / scale) - (terrainDimensions.width / 2);
              const worldZ = ((room.position.y - offsetY) / scale) - (terrainDimensions.height / 2);
              const worldWidth = room.dimensions.width / scale;
              const worldHeight = room.dimensions.height / scale;
              
              let position = 0.5;
              if (wallData.wall === 'front' || wallData.wall === 'back') {
                position = Math.max(0.1, Math.min(0.9, (point.x - worldX) / worldWidth));
              } else {
                position = Math.max(0.1, Math.min(0.9, (point.z - worldZ) / worldHeight));
              }
              
              // Update window position
              setWindows(prev => prev.map(window => 
                window.id === selectedWindowId 
                  ? { ...window, position, roomId: wallData.roomId, wall: wallData.wall }
                  : window
              ));
              break;
            }
          }
        }
      }
    };
    
    const onMouseUp = () => {
      if (isDraggingWindow) {
        setIsDraggingWindow(false);
        if (controlsRef.current) {
          controlsRef.current.enabled = true;
        }
      }
    };

    renderer.domElement.addEventListener('click', onMouseClick);
    renderer.domElement.addEventListener('mousemove', onMouseMove);
    renderer.domElement.addEventListener('mouseup', onMouseUp);

    // Animation loop
    const animate = () => {
      animationRef.current = requestAnimationFrame(animate);
      controls.update();
      renderer.render(scene, camera);
    };
    animate();

    // Handle resize
    const handleResize = () => {
      if (!mountRef.current) return;
      camera.aspect = mountRef.current.clientWidth / mountRef.current.clientHeight;
      camera.updateProjectionMatrix();
      renderer.setSize(mountRef.current.clientWidth, mountRef.current.clientHeight);
    };
    window.addEventListener('resize', handleResize);

    return () => {
      window.removeEventListener('resize', handleResize);
      renderer.domElement.removeEventListener('click', onMouseClick);
      renderer.domElement.removeEventListener('mousemove', onMouseMove);
      renderer.domElement.removeEventListener('mouseup', onMouseUp);
      if (animationRef.current) {
        cancelAnimationFrame(animationRef.current);
      }
      if (controlsRef.current) {
        controlsRef.current.dispose();
      }
      if (mountRef.current && renderer.domElement) {
        mountRef.current.removeChild(renderer.domElement);
      }
      renderer.dispose();
    };
  }, [rooms, terrainDimensions, roomHeights]);

  // Separate effect for doors and windows to avoid recreating the whole scene
  useEffect(() => {
    if (!sceneRef.current) return;
    
    const scene = sceneRef.current;
    
    // Remove existing doors and windows
    const toRemove: THREE.Object3D[] = [];
    scene.traverse((child) => {
      if (child.userData.type === 'door' || child.userData.type === 'window') {
        toRemove.push(child);
      }
    });
    toRemove.forEach(obj => scene.remove(obj));
    
    // Add doors and windows to existing rooms
    rooms.forEach(room => {
      const { offsetX, offsetY, scaledWidth, scaledHeight, scale } = getTerrainBounds();
      const worldX = ((room.position.x - offsetX) / scale) - (terrainDimensions.width / 2);
      const worldZ = ((room.position.y - offsetY) / scale) - (terrainDimensions.height / 2);
      const worldWidth = room.dimensions.width / scale;
      const worldHeight = room.dimensions.height / scale;
      
      // Add doors
      doors.filter(door => door.roomId === room.id).forEach(door => {
        let doorGeometry, doorX, doorY, doorZ;
        const doorMaterial = new THREE.MeshPhongMaterial({ color: 0x8B4513 });
        
        if (door.wall === 'front' || door.wall === 'back') {
          doorGeometry = new THREE.BoxGeometry(door.width, door.height, 0.05);
          doorX = worldX + door.position * worldWidth;
          doorY = door.height / 2;
          doorZ = door.wall === 'front' ? worldZ - 0.025 : worldZ + worldHeight + 0.025;
        } else {
          doorGeometry = new THREE.BoxGeometry(0.05, door.height, door.width);
          doorX = door.wall === 'left' ? worldX - 0.025 : worldX + worldWidth + 0.025;
          doorY = door.height / 2;
          doorZ = worldZ + door.position * worldHeight;
        }
        
        const doorMesh = new THREE.Mesh(doorGeometry, doorMaterial);
        doorMesh.position.set(doorX, doorY, doorZ);
        doorMesh.userData = { type: 'door', id: door.id };
        scene.add(doorMesh);
      });

      // Add windows
      windows.filter(window => window.roomId === room.id).forEach(window => {
        let windowGeometry, windowX, windowY, windowZ;
        const design = windowDesigns.find(d => d.id === window.design) || windowDesigns[0];
        const windowMaterial = new THREE.MeshPhongMaterial({ 
          color: design.color, 
          transparent: true, 
          opacity: 0.9,
          emissive: design.color,
          emissiveIntensity: 0.1
        });
        
        if (window.wall === 'front' || window.wall === 'back') {
          windowGeometry = new THREE.BoxGeometry(window.width, window.height, 0.1);
          windowX = worldX + window.position * worldWidth;
          windowY = window.bottomHeight + window.height / 2;
          windowZ = window.wall === 'front' ? worldZ - 0.05 : worldZ + worldHeight + 0.05;
        } else {
          windowGeometry = new THREE.BoxGeometry(0.1, window.height, window.width);
          windowX = window.wall === 'left' ? worldX - 0.05 : worldX + worldWidth + 0.05;
          windowY = window.bottomHeight + window.height / 2;
          windowZ = worldZ + window.position * worldHeight;
        }
        
        const windowMesh = new THREE.Mesh(windowGeometry, windowMaterial);
        windowMesh.position.set(windowX, windowY, windowZ);
        windowMesh.userData = { type: 'window', id: window.id };
        scene.add(windowMesh);
      });
    });
  }, [doors, windows, rooms, terrainDimensions]);

  // Separate effect for editMode changes that doesn't recreate the scene
  useEffect(() => {
    // Just update the renderer without recreating the scene
    if (rendererRef.current && cameraRef.current && sceneRef.current && controlsRef.current) {
      controlsRef.current.update();
      rendererRef.current.render(sceneRef.current, cameraRef.current);
    }
  }, [editMode]);

  // Separate effect for realistic mode to preserve camera position
  useEffect(() => {
    if (!sceneRef.current || !rendererRef.current || !cameraRef.current) return;
    
    const scene = sceneRef.current;
    const renderer = rendererRef.current;
    const camera = cameraRef.current;
    const controls = controlsRef.current;
    
    // Create brick texture
    const createBrickTexture = () => {
      const canvas = document.createElement('canvas');
      canvas.width = 512;
      canvas.height = 512;
      const ctx = canvas.getContext('2d')!;
      
      ctx.fillStyle = '#8B4513';
      ctx.fillRect(0, 0, 512, 512);
      
      ctx.strokeStyle = '#D3D3D3';
      ctx.lineWidth = 4;
      
      for (let y = 0; y < 512; y += 64) {
        ctx.beginPath();
        ctx.moveTo(0, y);
        ctx.lineTo(512, y);
        ctx.stroke();
      }
      
      for (let row = 0; row < 8; row++) {
        const offset = (row % 2) * 64;
        for (let x = offset; x < 512; x += 128) {
          ctx.beginPath();
          ctx.moveTo(x, row * 64);
          ctx.lineTo(x, (row + 1) * 64);
          ctx.stroke();
        }
      }
      
      for (let i = 0; i < 100; i++) {
        ctx.fillStyle = `rgba(${139 + Math.random() * 40}, ${69 + Math.random() * 30}, ${19 + Math.random() * 20}, 0.3)`;
        ctx.fillRect(Math.random() * 512, Math.random() * 512, Math.random() * 20, Math.random() * 10);
      }
      
      const texture = new THREE.CanvasTexture(canvas);
      texture.wrapS = THREE.RepeatWrapping;
      texture.wrapT = THREE.RepeatWrapping;
      return texture;
    };
    
    // Update all wall materials
    scene.traverse((child) => {
      if (child instanceof THREE.Mesh && child.material) {
        const material = child.material as THREE.Material;
        
        // Check if it's a wall (has specific geometry dimensions)
        const geometry = child.geometry as THREE.BoxGeometry;
        if (geometry && geometry.parameters) {
          const { width, height, depth } = geometry.parameters;
          
          // Identify walls by their thin depth
          if (depth === 0.1 || width === 0.1) {
            if (isRealistic) {
              const brickTexture = createBrickTexture();
              const newMaterial = new THREE.MeshPhongMaterial({
                map: brickTexture,
                shininess: 10,
                specular: 0x111111
              });
              child.material = newMaterial;
            } else {
              child.material = new THREE.MeshLambertMaterial({ color: 0xffffff });
            }
          }
        }
      }
    });
    
    if (controls) {
      controls.update();
      renderer.render(scene, camera);
    }
  }, [isRealistic]);

  const updateRoomHeight = (roomId: string, height: number) => {
    setRoomHeights(prev => ({ ...prev, [roomId]: height }));
  };

  const addDoor = () => {
    if (!selectedRoomId) return;
    const newDoor: Door = {
      id: Date.now().toString(),
      roomId: selectedRoomId,
      wall: selectedWall,
      position: 0.5,
      width: 0.8,
      height: 2.0
    };
    setDoors(prev => [...prev, newDoor]);
  };

  const addWindow = () => {
    if (!selectedRoomId) return;
    const newWindow: Window = {
      id: Date.now().toString(),
      roomId: selectedRoomId,
      wall: selectedWall,
      position: 0.5,
      width: 1.0,
      height: 1.0,
      bottomHeight: 1.0
    };
    setWindows(prev => [...prev, newWindow]);
  };

  const updateDoor = (doorId: string, updates: Partial<Door>) => {
    setDoors(prev => prev.map(door => 
      door.id === doorId ? { ...door, ...updates } : door
    ));
  };

  const updateWindow = (windowId: string, updates: Partial<Window>) => {
    setWindows(prev => prev.map(window => 
      window.id === windowId ? { ...window, ...updates } : window
    ));
  };

  const deleteDoor = (doorId: string) => {
    setDoors(prev => prev.filter(door => door.id !== doorId));
  };

  const deleteWindow = (windowId: string) => {
    setWindows(prev => prev.filter(window => window.id !== windowId));
  };

  const updateWindowDesign = (windowId: string, designId: string) => {
    const design = windowDesigns.find(d => d.id === designId);
    if (design) {
      setWindows(prev => prev.map(window => 
        window.id === windowId ? { ...window, design: designId } : window
      ));
    }
    setShowWindowDesigns(false);
    setSelectedWindowId(null);
  };

  const selectedRoom = rooms.find(room => room.id === selectedRoomId);
  const roomDoors = doors.filter(door => door.roomId === selectedRoomId);
  const roomWindows = windows.filter(window => window.roomId === selectedRoomId);

  const getTerrainBounds = () => {
    const scale = Math.min(800 / terrainDimensions.width, 600 / terrainDimensions.height) * 0.8;
    const scaledWidth = terrainDimensions.width * scale;
    const scaledHeight = terrainDimensions.height * scale;
    const offsetX = (800 - scaledWidth) / 2;
    const offsetY = (600 - scaledHeight) / 2;
    return { offsetX, offsetY, scaledWidth, scaledHeight, scale };
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg p-6 w-[90vw] h-[90vh] flex flex-col">
        <div className="flex justify-between items-center mb-4">
          <h2 className="text-2xl font-bold">Vista 3D del Plano</h2>
          <div className="flex gap-2">
            <Button
              variant={isRealistic ? "default" : "outline"}
              size="sm"
              onClick={() => setIsRealistic(!isRealistic)}
            >
              {isRealistic ? "Modo Simple" : "Modo Realista"}
            </Button>
            <button
              onClick={onClose}
              className="text-gray-500 hover:text-gray-700 text-2xl px-2"
            >
              ×
            </button>
          </div>
        </div>
        
        <div className="flex gap-4 h-full">
          <div className="w-64 bg-gray-50 p-4 rounded-lg overflow-y-auto">
            <div className="mb-4">
              <Label className="text-sm font-medium mb-2 block">Modo de Edición</Label>
              <div className="flex gap-1">
                <Button
                  variant={editMode === 'height' ? 'default' : 'outline'}
                  size="sm"
                  onClick={() => setEditMode('height')}
                  className="text-xs"
                >
                  Altura
                </Button>
                <Button
                  variant={editMode === 'door' ? 'default' : 'outline'}
                  size="sm"
                  onClick={() => setEditMode('door')}
                  className="text-xs"
                >
                  Puertas
                </Button>
                <Button
                  variant={editMode === 'window' ? 'default' : 'outline'}
                  size="sm"
                  onClick={() => {
                    console.log('Setting editMode to window');
                    setEditMode('window');
                  }}
                  className="text-xs"
                >
                  Ventanas
                </Button>
              </div>
            </div>
            
            {selectedRoom && (
              <div className="mb-4 p-3 bg-blue-50 rounded border">
                <Label className="text-sm font-medium text-blue-700">
                  {selectedRoom.name} (Seleccionada)
                </Label>
                
                {editMode === 'height' && (
                  <div className="mt-2">
                    <Label htmlFor="height" className="text-xs">Altura (m)</Label>
                    <Input
                      id="height"
                      type="number"
                      step="0.1"
                      min="2"
                      max="6"
                      value={roomHeights[selectedRoom.id] || 2.5}
                      onChange={(e) => updateRoomHeight(selectedRoom.id, parseFloat(e.target.value) || 2.5)}
                      className="mt-1"
                    />
                  </div>
                )}
                
                {editMode === 'door' && (
                  <div className="mt-2 p-2 bg-yellow-50 rounded border">
                    <p className="text-xs text-yellow-700 mb-2">
                      <strong>Modo Puerta:</strong><br/>
                      Haz click en la pared donde quieres colocar la puerta
                    </p>
                  </div>
                )}
                
                {editMode === 'window' && (
                  <div className="mt-2">
                    <div className="p-2 bg-yellow-50 rounded border mb-3">
                      <p className="text-xs text-yellow-700 mb-2">
                        <strong>Modo Ventana:</strong><br/>
                        1. Selecciona tipo y click en pared para crear<br/>
                        2. Click y arrastra ventana existente para mover
                      </p>
                    </div>
                    
                    <Label className="text-xs font-medium mb-2 block">Tipo de Ventana</Label>
                    <div className="grid grid-cols-2 gap-2 mb-3">
                      {windowDesigns.map(design => (
                        <button
                          key={design.id}
                          onClick={() => setSelectedWall(design.id)}
                          className={`p-2 border rounded text-xs ${
                            selectedWall === design.id ? 'bg-blue-100 border-blue-300' : 'bg-white hover:bg-gray-50'
                          }`}
                        >
                          <div 
                            className="w-full h-4 rounded mb-1"
                            style={{ backgroundColor: `#${design.color.toString(16)}` }}
                          ></div>
                          {design.name}
                        </button>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}
            
            {editMode === 'height' && (
              <div className="space-y-2">
                {rooms.map(room => (
                  <div key={room.id} className={`p-2 rounded border ${
                    selectedRoomId === room.id ? 'bg-blue-100 border-blue-300' : 'bg-white'
                  }`}>
                    <div className="flex justify-between items-center">
                      <span className="text-sm font-medium">{room.name}</span>
                      <span className="text-xs text-gray-500">
                        {roomHeights[room.id] || 2.5}m
                      </span>
                    </div>
                    <Input
                      type="number"
                      step="0.1"
                      min="2"
                      max="6"
                      value={roomHeights[room.id] || 2.5}
                      onChange={(e) => updateRoomHeight(room.id, parseFloat(e.target.value) || 2.5)}
                      className="mt-1 h-8 text-xs"
                    />
                  </div>
                ))}
              </div>
            )}
            
            {editMode === 'door' && selectedRoom && (
              <div className="space-y-2">
                <h4 className="text-sm font-medium">Puertas</h4>
                {roomDoors.map(door => (
                  <div key={door.id} className="p-2 bg-white rounded border">
                    <div className="flex justify-between items-center mb-2">
                      <span className="text-xs font-medium">Puerta {door.wall}</span>
                      <Button size="sm" variant="destructive" onClick={() => deleteDoor(door.id)} className="text-xs h-6 w-6 p-0">×</Button>
                    </div>
                    <div className="grid grid-cols-2 gap-1">
                      <div>
                        <Label className="text-xs">Posición</Label>
                        <Input
                          type="number"
                          step="0.1"
                          min="0"
                          max="1"
                          value={door.position}
                          onChange={(e) => updateDoor(door.id, { position: parseFloat(e.target.value) })}
                          className="h-6 text-xs"
                        />
                      </div>
                      <div>
                        <Label className="text-xs">Ancho</Label>
                        <Input
                          type="number"
                          step="0.1"
                          min="0.5"
                          max="2"
                          value={door.width}
                          onChange={(e) => updateDoor(door.id, { width: parseFloat(e.target.value) })}
                          className="h-6 text-xs"
                        />
                      </div>
                    </div>
                    <div className="mt-1">
                      <Label className="text-xs">Alto</Label>
                      <Input
                        type="number"
                        step="0.1"
                        min="1.5"
                        max="3"
                        value={door.height}
                        onChange={(e) => updateDoor(door.id, { height: parseFloat(e.target.value) })}
                        className="h-6 text-xs"
                      />
                    </div>
                  </div>
                ))}
              </div>
            )}
            
            {editMode === 'window' && selectedRoom && (
              <div className="space-y-2">
                <h4 className="text-sm font-medium">Ventanas</h4>
                {roomWindows.map(window => (
                  <div key={window.id} className="p-2 bg-white rounded border">
                    <div className="flex justify-between items-center mb-2">
                      <span className="text-xs font-medium">Ventana {window.wall}</span>
                      <Button size="sm" variant="destructive" onClick={() => deleteWindow(window.id)} className="text-xs h-6 w-6 p-0">×</Button>
                    </div>
                    <div>
                      <Label className="text-xs">Ancho</Label>
                      <Input
                        type="number"
                        step="0.1"
                        min="0.3"
                        max="3"
                        value={window.width}
                        onChange={(e) => updateWindow(window.id, { width: parseFloat(e.target.value) })}
                        className="h-6 text-xs"
                      />
                    </div>
                    <div className="mt-1">
                      <Label className="text-xs">Alto</Label>
                      <Input
                        type="number"
                        step="0.1"
                        min="0.3"
                        max="2"
                        value={window.height}
                        onChange={(e) => updateWindow(window.id, { height: parseFloat(e.target.value) })}
                        className="h-6 text-xs"
                      />
                    </div>
                  </div>
                ))}
              </div>
            )}
            
            <div className="mt-4 text-xs text-gray-500">
              <p><strong>Tip:</strong> Haz click en una habitación en la vista 3D para seleccionarla</p>
            </div>
          </div>
          
          <div ref={mountRef} className="flex-1 border rounded-lg overflow-hidden" />
        </div>
        
        <div className="mt-2 text-sm text-gray-600 text-center">
          <strong>Controles:</strong> Click izquierdo + arrastrar = rotar | Rueda del mouse = zoom | Click derecho + arrastrar = mover | Click en ventana = diseños
        </div>
        
        {/* Window Design Menu */}
        {showWindowDesigns && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
            <div className="bg-white rounded-lg p-6 w-80">
              <div className="flex justify-between items-center mb-4">
                <h3 className="text-lg font-semibold">Diseños de Ventana</h3>
                <button
                  onClick={() => setShowWindowDesigns(false)}
                  className="text-gray-500 hover:text-gray-700 text-xl"
                >
                  ×
                </button>
              </div>
              <div className="grid grid-cols-2 gap-3">
                {windowDesigns.map(design => (
                  <button
                    key={design.id}
                    onClick={() => selectedWindowId && updateWindowDesign(selectedWindowId, design.id)}
                    className="p-3 border rounded-lg hover:bg-gray-50 text-left"
                    style={{ borderColor: `#${design.color.toString(16)}` }}
                  >
                    <div 
                      className="w-full h-8 rounded mb-2"
                      style={{ backgroundColor: `#${design.color.toString(16)}` }}
                    ></div>
                    <span className="text-sm font-medium">{design.name}</span>
                  </button>
                ))}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};