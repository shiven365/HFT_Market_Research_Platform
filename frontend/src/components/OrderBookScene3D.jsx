import { Canvas, useFrame } from '@react-three/fiber';
import { useMemo, useRef } from 'react';

function colorByIntensity(intensity) {
  const i = Math.max(0, Math.min(1, intensity));
  if (i < 0.35) {
    return '#3fa7d6';
  }
  if (i < 0.65) {
    return '#20c997';
  }
  return '#f4d35e';
}

function BarsLayer({ bins, animate, onHoverBin, onLeaveBin }) {
  const refs = useRef([]);

  const plotted = useMemo(() => {
    if (!bins || bins.length === 0) {
      return [];
    }

    const spacing = bins.length > 80 ? 0.28 : 0.36;
    const start = -(bins.length - 1) / 2;

    return bins.map((bin, idx) => {
      const baseHeight = 0.35 + bin.intensity * 5.4;
      const x = (start + idx) * spacing;
      const z = (Math.round(bin.intensity * 4) - 2) * 0.58;
      return {
        ...bin,
        id: `${bin.price_bucket}-${idx}`,
        x,
        z,
        baseHeight,
        color: colorByIntensity(bin.intensity),
      };
    });
  }, [bins]);

  useFrame((state) => {
    const t = state.clock.elapsedTime;

    refs.current.forEach((mesh, idx) => {
      if (!mesh || !plotted[idx]) {
        return;
      }

      const p = plotted[idx];
      const pulse = animate ? 1 + Math.sin(t * 2.4 + idx * 0.17) * 0.06 : 1;
      const scaled = p.baseHeight * pulse;
      mesh.scale.y = scaled;
      mesh.position.y = scaled / 2;
    });
  });

  return (
    <group>
      {plotted.map((bar, idx) => (
        <mesh
          key={bar.id}
          ref={(el) => {
            refs.current[idx] = el;
          }}
          position={[bar.x, bar.baseHeight / 2, bar.z]}
          scale={[1, bar.baseHeight, 1]}
          onPointerOver={(e) => {
            e.stopPropagation();
            onHoverBin(bar);
          }}
          onPointerOut={(e) => {
            e.stopPropagation();
            onLeaveBin();
          }}
        >
          <boxGeometry args={[0.26, 1, 0.26]} />
          <meshStandardMaterial color={bar.color} roughness={0.35} metalness={0.22} />
        </mesh>
      ))}
    </group>
  );
}

export default function OrderBookScene3D({ bins, animate, onHoverBin, onLeaveBin }) {
  return (
    <div className="orderbook-scene" aria-label="3D order book liquidity scene">
      <Canvas camera={{ position: [0, 7.6, 9.4], fov: 44 }} dpr={[1, 1.6]}>
        <color attach="background" args={['#081420']} />
        <ambientLight intensity={0.62} />
        <directionalLight position={[4, 7, 6]} intensity={1.14} color="#d7f5ff" />
        <directionalLight position={[-6, 5, -4]} intensity={0.45} color="#7bd9f5" />

        <gridHelper args={[22, 28, '#29506d', '#17324a']} position={[0, 0, 0]} />
        <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.01, 0]}>
          <planeGeometry args={[22, 12]} />
          <meshStandardMaterial color="#0e2233" roughness={0.94} metalness={0.05} />
        </mesh>

        <BarsLayer bins={bins} animate={animate} onHoverBin={onHoverBin} onLeaveBin={onLeaveBin} />
      </Canvas>
    </div>
  );
}
