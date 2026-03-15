import { Canvas, useFrame } from '@react-three/fiber';
import { useMemo, useRef } from 'react';

function CandleField() {
  const groupRef = useRef(null);
  const bodyRefs = useRef([]);
  const wickRefs = useRef([]);

  const candles = useMemo(() => {
    const items = [];
    let id = 0;

    for (let z = -4; z <= 3; z += 1) {
      for (let x = -5; x <= 5; x += 1) {
        const isUp = (x + z) % 3 !== 0;
        items.push({
          id: `intro-candle-${id}`,
          x: x * 0.68,
          z: z * 0.72,
          phase: id * 0.19,
          base: 0.35 + ((id % 5) * 0.11),
          isUp,
          color: isUp ? '#2be0bf' : '#ff6b7a',
        });
        id += 1;
      }
    }

    return items;
  }, []);

  useFrame(({ clock }, delta) => {
    if (groupRef.current) {
      groupRef.current.rotation.y += delta * 0.035;
    }

    const t = clock.getElapsedTime();
    for (let i = 0; i < candles.length; i += 1) {
      const c = candles[i];
      const body = bodyRefs.current[i];
      const wick = wickRefs.current[i];
      if (!body || !wick) {
        continue;
      }

      const pulse = 0.28 + (Math.sin(t * 1.75 + c.phase) + 1) * 0.42;
      const bodyHeight = c.base + pulse;
      const wickHeight = bodyHeight + 0.62;

      body.scale.y = bodyHeight;
      body.position.y = bodyHeight / 2;

      wick.scale.y = wickHeight;
      wick.position.y = wickHeight / 2;
    }
  });

  return (
    <group ref={groupRef} position={[0, -0.15, 0]}>
      {candles.map((c, idx) => (
        <group key={c.id} position={[c.x, 0, c.z]}>
          <mesh
            ref={(el) => {
              bodyRefs.current[idx] = el;
            }}
          >
            <boxGeometry args={[0.18, 1, 0.18]} />
            <meshStandardMaterial
              color={c.color}
              emissive={c.color}
              emissiveIntensity={0.35}
              metalness={0.25}
              roughness={0.32}
            />
          </mesh>
          <mesh
            ref={(el) => {
              wickRefs.current[idx] = el;
            }}
          >
            <boxGeometry args={[0.035, 1, 0.035]} />
            <meshStandardMaterial color={c.color} emissive={c.color} emissiveIntensity={0.2} roughness={0.28} />
          </mesh>
        </group>
      ))}
    </group>
  );
}

function DataParticles() {
  const geoRef = useRef(null);

  const count = 520;
  const positions = useMemo(() => {
    const arr = new Float32Array(count * 3);
    for (let i = 0; i < count; i += 1) {
      arr[i * 3] = (Math.random() - 0.5) * 26;
      arr[i * 3 + 1] = (Math.random() - 0.5) * 12;
      arr[i * 3 + 2] = (Math.random() - 0.5) * 26;
    }
    return arr;
  }, [count]);

  const drift = useMemo(() => {
    const arr = new Float32Array(count);
    for (let i = 0; i < count; i += 1) {
      arr[i] = 0.08 + Math.random() * 0.22;
    }
    return arr;
  }, [count]);

  useFrame(({ clock }, delta) => {
    const geometry = geoRef.current;
    if (!geometry) {
      return;
    }

    const arr = geometry.attributes.position.array;
    const t = clock.getElapsedTime();

    for (let i = 0; i < count; i += 1) {
      const xIdx = i * 3;
      const yIdx = xIdx + 1;
      const zIdx = xIdx + 2;

      arr[yIdx] += drift[i] * delta * 0.45;
      arr[xIdx] += Math.sin(t * 0.9 + i * 0.11) * 0.0028;
      arr[zIdx] += Math.cos(t * 0.7 + i * 0.13) * 0.0022;

      if (arr[yIdx] > 6) {
        arr[yIdx] = -6;
      }
    }

    geometry.attributes.position.needsUpdate = true;
  });

  return (
    <points>
      <bufferGeometry ref={geoRef}>
        <bufferAttribute attach="attributes-position" count={count} array={positions} itemSize={3} />
      </bufferGeometry>
      <pointsMaterial color="#79d7ff" size={0.035} sizeAttenuation transparent opacity={0.76} />
    </points>
  );
}

function CenterSymbol() {
  const ref = useRef(null);

  useFrame(({ clock }, delta) => {
    if (!ref.current) {
      return;
    }
    ref.current.rotation.y += delta * 0.6;
    ref.current.position.y = 1.65 + Math.sin(clock.getElapsedTime() * 1.5) * 0.09;
  });

  return (
    <group ref={ref} position={[0, 1.65, 0]}>
      <mesh>
        <torusGeometry args={[0.62, 0.12, 14, 58]} />
        <meshStandardMaterial color="#f59e0b" emissive="#f59e0b" emissiveIntensity={0.4} metalness={0.35} roughness={0.28} />
      </mesh>
      <mesh position={[0, 0.34, 0]}>
        <boxGeometry args={[0.08, 0.86, 0.08]} />
        <meshStandardMaterial color="#ffd27a" emissive="#ffd27a" emissiveIntensity={0.22} metalness={0.2} />
      </mesh>
      <mesh position={[0, -0.34, 0]}>
        <boxGeometry args={[0.08, 0.86, 0.08]} />
        <meshStandardMaterial color="#ffd27a" emissive="#ffd27a" emissiveIntensity={0.22} metalness={0.2} />
      </mesh>
    </group>
  );
}

function PulseLights() {
  const keyRef = useRef(null);
  const pulse = useRef({ cooldown: 0, target: 1.25, intensity: 1.25 });

  useFrame((_, delta) => {
    const light = keyRef.current;
    if (!light) {
      return;
    }

    const p = pulse.current;
    p.cooldown -= delta;
    if (p.cooldown <= 0) {
      p.cooldown = 0.45 + Math.random() * 1.6;
      p.target = 1 + Math.random() * 1.8;
    }

    p.intensity += (p.target - p.intensity) * Math.min(1, delta * 2.6);
    light.intensity = p.intensity;
  });

  return (
    <>
      <ambientLight intensity={0.45} />
      <pointLight ref={keyRef} position={[0, 3.9, 0]} color="#39d6ff" intensity={1.25} distance={18} />
      <pointLight position={[-4.2, 2.3, 4.4]} color="#18d5b2" intensity={0.9} distance={14} />
      <pointLight position={[5.1, 2.6, -3.7]} color="#2dd7ff" intensity={0.7} distance={14} />
      <directionalLight position={[4, 6, 3]} color="#c5f6ff" intensity={0.74} />
    </>
  );
}

function CameraOrbit() {
  useFrame(({ camera, clock }) => {
    const t = clock.getElapsedTime() * 0.12;
    const radius = 8.5;

    camera.position.x = Math.cos(t) * radius;
    camera.position.z = Math.sin(t) * radius;
    camera.position.y = 3.2 + Math.sin(t * 1.4) * 0.28;
    camera.lookAt(0, 0.25, 0);
  });

  return null;
}

export default function Intro3D({ onEnter }) {
  function handleEnter() {
    if (onEnter) {
      onEnter();
    }
  }

  return (
    <main className="intro3d-shell">
      <Canvas className="intro3d-canvas" camera={{ position: [8.2, 3.2, 2.2], fov: 54 }} dpr={[1, 1.4]}>
        <color attach="background" args={['#040b14']} />
        <fog attach="fog" args={['#040b14', 9, 28]} />

        <PulseLights />
        <CameraOrbit />

        <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.03, 0]}>
          <planeGeometry args={[42, 42]} />
          <meshStandardMaterial color="#0a1524" roughness={0.96} metalness={0.08} />
        </mesh>
        <gridHelper args={[42, 52, '#1e486f', '#11253c']} position={[0, 0, 0]} />

        <CandleField />
        <DataParticles />
        <CenterSymbol />
      </Canvas>

      <div className="intro3d-atmosphere" aria-hidden="true">
        <span className="intro3d-orb orb-a" />
        <span className="intro3d-orb orb-b" />
        <span className="intro3d-orb orb-c" />
      </div>

      <div className="intro3d-overlay">
        <div className="intro3d-panel">
          <p className="intro3d-kicker">Welcome</p>
          <h1>QuantEdge Market Research Platform</h1>
          <p>Interactive Market Microstructure and Strategy Simulation</p>
          <button className="btn btn-primary intro3d-enter" onClick={handleEnter}>
            Enter Platform
          </button>
        </div>
      </div>
    </main>
  );
}