import { Canvas, useFrame } from '@react-three/fiber';
import { useMemo, useRef } from 'react';

function LiquidityBars() {
  const groupRef = useRef(null);
  const barRefs = useRef([]);

  const bars = useMemo(() => {
    const data = [];
    const palette = ['#1bcfb4', '#4de3cf', '#66f0db', '#2cc8e8'];
    let id = 0;

    for (let z = -3; z <= 2; z += 1) {
      for (let x = -3; x <= 3; x += 1) {
        data.push({
          id: `bar-${id}`,
          x,
          z,
          color: palette[id % palette.length],
          phase: id * 0.35,
        });
        id += 1;
      }
    }

    return data;
  }, []);

  useFrame(({ clock }, delta) => {
    if (groupRef.current) {
      groupRef.current.rotation.y += delta * 0.08;
    }

    const t = clock.getElapsedTime();
    for (let i = 0; i < barRefs.current.length; i += 1) {
      const mesh = barRefs.current[i];
      if (!mesh) {
        continue;
      }
      const phase = bars[i].phase;
      const scaleY = 0.35 + (Math.sin(t * 2 + phase) + 1) * 0.45;
      mesh.scale.y = scaleY;
      mesh.position.y = scaleY / 2;
    }
  });

  return (
    <group ref={groupRef} position={[0, 0, 0]} rotation={[0.2, 0.35, 0]}>
      {bars.map((bar, idx) => (
        <mesh
          key={bar.id}
          ref={(mesh) => {
            barRefs.current[idx] = mesh;
          }}
          position={[bar.x * 0.68, 0.5, bar.z * 0.68]}
        >
          <boxGeometry args={[0.42, 1, 0.42]} />
          <meshStandardMaterial color={bar.color} roughness={0.3} metalness={0.25} />
        </mesh>
      ))}
    </group>
  );
}

export default function MarketScene3D() {
  return (
    <div className="market-scene" aria-label="3D liquidity scene">
      <Canvas camera={{ position: [4.8, 4.4, 5.6], fov: 44 }} dpr={[1, 1.5]}>
        <color attach="background" args={['#07111b']} />
        <ambientLight intensity={0.65} />
        <directionalLight position={[5, 8, 2]} intensity={1.2} color="#aef7eb" />
        <directionalLight position={[-4, 4, -3]} intensity={0.5} color="#4fc9e7" />

        <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.02, 0]}>
          <planeGeometry args={[9, 9]} />
          <meshStandardMaterial color="#102031" roughness={0.92} metalness={0.08} />
        </mesh>

        <gridHelper args={[9, 14, '#2e4f6b', '#16283a']} position={[0, 0, 0]} />
        <LiquidityBars />
      </Canvas>
    </div>
  );
}
