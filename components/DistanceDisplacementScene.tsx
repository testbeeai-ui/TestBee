"use client";

import { useRef, useState, useEffect } from "react";
import { Canvas, useFrame } from "@react-three/fiber";
import { OrbitControls, Text, Line } from "@react-three/drei";
import * as THREE from "three";

function WindingPath() {
  const points = [
    new THREE.Vector3(-2, 0, 0),
    new THREE.Vector3(-1.2, 0, 0.8),
    new THREE.Vector3(0, 0, 1.2),
    new THREE.Vector3(1, 0, 0.6),
    new THREE.Vector3(2, 0, 0),
  ];
  return (
    <Line points={points} color="#f97316" />
  );
}

function StraightArrow() {
  return (
    <Line points={[new THREE.Vector3(-2, 0, 0), new THREE.Vector3(2, 0, 0)]} color="#3b82f6" />
  );
}

function CircularTrack() {
  const points: THREE.Vector3[] = [];
  const radius = 1.2;
  for (let i = 0; i <= 64; i++) {
    const t = (i / 64) * Math.PI * 2;
    points.push(new THREE.Vector3(Math.cos(t) * radius, 0, Math.sin(t) * radius));
  }
  return <Line points={points} color="#84cc16" />;
}

function RunnerOnTrack() {
  const ref = useRef<THREE.Mesh>(null);
  const phase = useRef(0);
  useFrame((_, delta) => {
    if (ref.current) {
      phase.current += delta * 0.5;
      ref.current.position.x = Math.cos(phase.current) * 1.2;
      ref.current.position.z = Math.sin(phase.current) * 1.2;
    }
  });
  return (
    <mesh ref={ref} position={[1.2, 0, 0]}>
      <sphereGeometry args={[0.12, 16, 16]} />
      <meshStandardMaterial color="#facc15" />
    </mesh>
  );
}

function SceneContent() {
  return (
    <>
      <ambientLight intensity={0.7} />
      <directionalLight position={[5, 5, 5]} intensity={1} />
      <gridHelper args={[6, 12, "#444", "#222"]} position={[0, -0.01, 0]} />
      <group position={[-2, 0, 0]}>
        <Text fontSize={0.2} anchorX="center" anchorY="middle" color="#fff">
          START
        </Text>
        <mesh position={[0, 0.15, 0]}>
          <boxGeometry args={[0.4, 0.3, 0.4]} />
          <meshStandardMaterial color="#22c55e" />
        </mesh>
      </group>
      <group position={[2, 0, 0]}>
        <Text fontSize={0.2} anchorX="center" anchorY="middle" color="#fff">
          END
        </Text>
        <mesh position={[0, 0.2, 0]}>
          <boxGeometry args={[0.5, 0.4, 0.5]} />
          <meshStandardMaterial color="#e11d48" />
        </mesh>
      </group>
      <WindingPath />
      <StraightArrow />
      <group position={[0, 0, -2.5]}>
        <CircularTrack />
        <RunnerOnTrack />
        <Text position={[0, 0.8, 0]} fontSize={0.15} anchorX="center" color="#a3e635">
          Lap: Distance = 2πr, Displacement = 0
        </Text>
      </group>
      <OrbitControls enableZoom enablePan />
    </>
  );
}

export default function DistanceDisplacementScene() {
  const [mounted, setMounted] = useState(false);
  useEffect(() => {
    queueMicrotask(() => setMounted(true));
  }, []);

  if (!mounted) {
    return (
      <div className="w-full h-[400px] rounded-xl overflow-hidden bg-zinc-900 flex items-center justify-center text-muted-foreground text-sm">
        Loading 3D…
      </div>
    );
  }

  return (
    <div className="w-full h-[400px] rounded-xl overflow-hidden bg-zinc-900">
      <Canvas camera={{ position: [0, 4, 6], fov: 50 }} gl={{ antialias: true }}>
        <SceneContent />
      </Canvas>
    </div>
  );
}
