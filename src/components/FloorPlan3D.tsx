import { useRef, useEffect } from 'react';
import * as THREE from 'three';
import { Room, Dimensions } from '@/types/floorplan';

interface FloorPlan3DProps {
  rooms: Room[];
  terrainDimensions: Dimensions;
  onClose: () => void;
}

export const FloorPlan3D = ({ rooms, terrainDimensions, onClose }: FloorPlan3DProps) => {
  const mountRef = useRef<HTMLDivElement>(null);
  const sceneRef = useRef<THREE.Scene>();
  const rendererRef = useRef<THREE.WebGLRenderer>();
  const cameraRef = useRef<THREE.PerspectiveCamera>();

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
    camera.lookAt(0, 0, 0);
    cameraRef.current = camera;

    // Renderer setup
    const renderer = new THREE.WebGLRenderer({ antialias: true });
    renderer.setSize(mountRef.current.clientWidth, mountRef.current.clientHeight);
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    rendererRef.current = renderer;
    mountRef.current.appendChild(renderer.domElement);

    // Lighting
    const ambientLight = new THREE.AmbientLight(0x404040, 0.6);
    scene.add(ambientLight);

    const directionalLight = new THREE.DirectionalLight(0xffffff, 0.8);
    directionalLight.position.set(10, 10, 5);
    directionalLight.castShadow = true;
    directionalLight.shadow.mapSize.width = 2048;
    directionalLight.shadow.mapSize.height = 2048;
    scene.add(directionalLight);

    // Ground plane
    const groundGeometry = new THREE.PlaneGeometry(terrainDimensions.width, terrainDimensions.height);
    const groundMaterial = new THREE.MeshLambertMaterial({ color: 0xcccccc });
    const ground = new THREE.Mesh(groundGeometry, groundMaterial);
    ground.rotation.x = -Math.PI / 2;
    ground.receiveShadow = true;
    scene.add(ground);

    // Room colors
    const roomColors = {
      bedroom: 0x8b5cf6,
      bathroom: 0x3b82f6,
      living: 0xf97316,
      kitchen: 0x10b981
    };

    // Create 3D rooms
    rooms.forEach(room => {
      const roomGroup = new THREE.Group();

      // Convert 2D canvas coordinates to 3D world coordinates
      const worldX = (room.position.x / 20) - (terrainDimensions.width / 2);
      const worldZ = (room.position.y / 20) - (terrainDimensions.height / 2);
      const worldWidth = room.dimensions.width / 20;
      const worldHeight = room.dimensions.height / 20;

      // Floor
      const floorGeometry = new THREE.PlaneGeometry(worldWidth, worldHeight);
      const floorMaterial = new THREE.MeshLambertMaterial({ 
        color: roomColors[room.type],
        transparent: true,
        opacity: 0.8
      });
      const floor = new THREE.Mesh(floorGeometry, floorMaterial);
      floor.rotation.x = -Math.PI / 2;
      floor.position.set(worldX + worldWidth/2, 0.01, worldZ + worldHeight/2);
      roomGroup.add(floor);

      // Walls
      const wallHeight = 2.5;
      const wallThickness = 0.1;
      const wallMaterial = new THREE.MeshLambertMaterial({ color: 0xffffff });

      // Front wall
      const frontWallGeometry = new THREE.BoxGeometry(worldWidth, wallHeight, wallThickness);
      const frontWall = new THREE.Mesh(frontWallGeometry, wallMaterial);
      frontWall.position.set(worldX + worldWidth/2, wallHeight/2, worldZ);
      frontWall.castShadow = true;
      roomGroup.add(frontWall);

      // Back wall
      const backWall = new THREE.Mesh(frontWallGeometry, wallMaterial);
      backWall.position.set(worldX + worldWidth/2, wallHeight/2, worldZ + worldHeight);
      backWall.castShadow = true;
      roomGroup.add(backWall);

      // Left wall
      const sideWallGeometry = new THREE.BoxGeometry(wallThickness, wallHeight, worldHeight);
      const leftWall = new THREE.Mesh(sideWallGeometry, wallMaterial);
      leftWall.position.set(worldX, wallHeight/2, worldZ + worldHeight/2);
      leftWall.castShadow = true;
      roomGroup.add(leftWall);

      // Right wall
      const rightWall = new THREE.Mesh(sideWallGeometry, wallMaterial);
      rightWall.position.set(worldX + worldWidth, wallHeight/2, worldZ + worldHeight/2);
      rightWall.castShadow = true;
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

      scene.add(roomGroup);
    });

    // Animation loop
    const animate = () => {
      requestAnimationFrame(animate);
      
      // Rotate camera around the scene
      const time = Date.now() * 0.0005;
      camera.position.x = Math.cos(time) * 25;
      camera.position.z = Math.sin(time) * 25;
      camera.lookAt(0, 0, 0);
      
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
      if (mountRef.current && renderer.domElement) {
        mountRef.current.removeChild(renderer.domElement);
      }
      renderer.dispose();
    };
  }, [rooms, terrainDimensions]);

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg p-6 w-[90vw] h-[90vh] flex flex-col">
        <div className="flex justify-between items-center mb-4">
          <h2 className="text-2xl font-bold">Vista 3D del Plano</h2>
          <button
            onClick={onClose}
            className="text-gray-500 hover:text-gray-700 text-2xl"
          >
            ×
          </button>
        </div>
        <div ref={mountRef} className="flex-1 border rounded-lg overflow-hidden" />
        <div className="mt-4 text-sm text-gray-600 text-center">
          La cámara rota automáticamente alrededor del plano. Cada habitación se muestra con paredes y colores distintivos.
        </div>
      </div>
    </div>
  );
};