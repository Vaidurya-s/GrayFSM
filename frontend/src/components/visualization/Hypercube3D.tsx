/**
 * Hypercube3D — Interactive 3D hypercube visualization for Gray code FSM states.
 *
 * Renders an N-dimensional hypercube (N = 2..5) in 3D space using @react-three/fiber
 * and @react-three/drei. Vertices represent Gray code states; edges connect Hamming-
 * distance-1 neighbors. Highlighted states appear in green; active transitions animate
 * as a particle travelling along the edge.
 */

import { useRef, useMemo, useState, useEffect, useCallback } from 'react';
import { Canvas, useFrame } from '@react-three/fiber';
import { OrbitControls, Text } from '@react-three/drei';
import * as THREE from 'three';
import type { Transition } from '../../types/fsm';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface Hypercube3DProps {
  /** Number of bits (2–5). Defaults to 3. */
  numBits?: number;
  /** Gray-code strings of states that should appear highlighted. */
  highlightedStates?: string[];
  /** Transitions to animate as moving particles. */
  transitions?: Transition[];
}

interface Vertex3D {
  code: string;
  index: number;
  position: THREE.Vector3;
}

interface Edge3D {
  from: string;
  to: string;
  bitPosition: number;
  fromPos: THREE.Vector3;
  toPos: THREE.Vector3;
}

interface AnimParticle {
  id: string;
  fromPos: THREE.Vector3;
  toPos: THREE.Vector3;
  progress: number;
  speed: number;
}

// ---------------------------------------------------------------------------
// Color palette
// ---------------------------------------------------------------------------

const COLORS = {
  vertex: '#6b7280',          // gray-500
  vertexHighlight: '#009E73', // Okabe-Ito teal
  vertexActive: '#f59e0b',    // amber-400
  edge: '#374151',            // gray-700
  edgeHighlight: '#007a59',   // teal-700 (darker teal for edges)
  particle: '#E69F00',        // Okabe-Ito orange
  label: '#e5e7eb',           // gray-200
  grid: '#1f2937',            // gray-800
};

// ---------------------------------------------------------------------------
// Hypercube geometry helpers
// ---------------------------------------------------------------------------

/**
 * Map an N-dimensional hypercube vertex (identified by its binary index) to a
 * 3D position by projecting higher dimensions into the XY plane as scaled
 * offsets.  The result is a unit-scaled cube layout for N ≤ 3 and a nested-
 * cube projection for N > 3.
 */
function ndVertexTo3D(index: number, n: number, scale = 1.8): THREE.Vector3 {
  // Extract raw binary coordinates along each dimension
  const dims: number[] = [];
  for (let d = 0; d < n; d++) {
    dims.push((index >> d) & 1);
  }

  // Dimensions 0–2 map directly to X, Y, Z
  let x = (dims[0] ?? 0) * 2 - 1;
  let y = (dims[1] ?? 0) * 2 - 1;
  let z = n >= 3 ? (dims[2] ?? 0) * 2 - 1 : 0;

  // Dimensions 3+ fold back as smaller nested offsets so the shape stays
  // legible.  Dimension 3 → diagonal in XY, dimension 4 → diagonal in XZ.
  if (n >= 4) {
    const d3 = (dims[3] ?? 0) * 2 - 1;
    x += d3 * 0.38;
    y += d3 * 0.38;
  }
  if (n >= 5) {
    const d4 = (dims[4] ?? 0) * 2 - 1;
    x += d4 * 0.18;
    z += d4 * 0.18;
  }

  return new THREE.Vector3(x * scale, y * scale, z * (n >= 3 ? scale : 0));
}

function buildVertices(numBits: number): Vertex3D[] {
  const count = 1 << numBits;
  return Array.from({ length: count }, (_, i) => {
    const gray = i ^ (i >> 1);
    return {
      code: gray.toString(2).padStart(numBits, '0'),
      index: i,
      position: ndVertexTo3D(i, numBits),
    };
  });
}

function buildEdges(vertices: Vertex3D[], _numBits: number): Edge3D[] {
  const edges: Edge3D[] = [];

  for (let i = 0; i < vertices.length; i++) {
    for (let j = i + 1; j < vertices.length; j++) {
      const xor = i ^ j;
      if ((xor & (xor - 1)) === 0) {
        // exactly one bit differs in the *binary index*
        const vI = vertices[i];
        const vJ = vertices[j];
        // Verify neighbors share a Gray-code Hamming distance of 1
        const codeXor = parseInt(vI.code, 2) ^ parseInt(vJ.code, 2);
        const bitPosition = Math.log2(codeXor);
        // Only add proper Gray-code adjacency edges
        if (Number.isInteger(bitPosition)) {
          edges.push({
            from: vI.code,
            to: vJ.code,
            bitPosition,
            fromPos: vI.position,
            toPos: vJ.position,
          });
        }
      }
    }
  }

  // Fallback: if no integer-bit-position edges found (can happen with higher
  // dims where Gray code adjacency doesn't perfectly align with binary index
  // adjacency), connect all pairs differing by exactly one bit in Gray code.
  if (edges.length === 0) {
    for (let i = 0; i < vertices.length; i++) {
      for (let j = i + 1; j < vertices.length; j++) {
        const a = parseInt(vertices[i].code, 2);
        const b = parseInt(vertices[j].code, 2);
        const diff = a ^ b;
        if ((diff & (diff - 1)) === 0) {
          edges.push({
            from: vertices[i].code,
            to: vertices[j].code,
            bitPosition: Math.log2(diff),
            fromPos: vertices[i].position,
            toPos: vertices[j].position,
          });
        }
      }
    }
  }

  return edges;
}

// ---------------------------------------------------------------------------
// Three.js sub-components
// ---------------------------------------------------------------------------

/** A single vertex sphere. */
function VertexSphere({
  vertex,
  highlighted,
  active,
  showLabel,
  onClick,
}: {
  vertex: Vertex3D;
  highlighted: boolean;
  active: boolean;
  showLabel: boolean;
  onClick?: () => void;
}) {
  const meshRef = useRef<THREE.Mesh>(null);
  const baseColor = highlighted ? COLORS.vertexHighlight : COLORS.vertex;
  const color = active ? COLORS.vertexActive : baseColor;
  const radius = highlighted || active ? 0.14 : 0.10;

  useFrame((_, delta) => {
    if (!meshRef.current) return;
    if (highlighted || active) {
      meshRef.current.rotation.y += delta * 0.8;
    }
  });

  return (
    <group position={vertex.position}>
      <mesh ref={meshRef} onClick={onClick}>
        <sphereGeometry args={[radius, 24, 24]} />
        <meshStandardMaterial
          color={color}
          emissive={color}
          emissiveIntensity={highlighted || active ? 0.45 : 0.12}
          roughness={0.3}
          metalness={0.5}
        />
      </mesh>
      {/* Glow ring for highlighted vertices */}
      {(highlighted || active) && (
        <mesh rotation={[Math.PI / 2, 0, 0]}>
          <ringGeometry args={[radius * 1.5, radius * 2.1, 32]} />
          <meshBasicMaterial color={color} transparent opacity={0.25} side={THREE.DoubleSide} />
        </mesh>
      )}
      {showLabel && (
        <Text
          position={[0, radius + 0.18, 0]}
          fontSize={0.15}
          color={highlighted ? '#5de0b8' : COLORS.label}
          anchorX="center"
          anchorY="bottom"
          outlineWidth={0.02}
          outlineColor="#000000"
        >
          {vertex.code}
        </Text>
      )}
    </group>
  );
}

/** A single edge as a BufferGeometry line. */
function EdgeLine({
  edge,
  highlighted,
}: {
  edge: Edge3D;
  highlighted: boolean;
}) {
  const color = highlighted ? COLORS.edgeHighlight : COLORS.edge;

  return (
    <line>
      <bufferGeometry>
        <bufferAttribute
          attach="attributes-position"
          args={[
            new Float32Array([
              edge.fromPos.x, edge.fromPos.y, edge.fromPos.z,
              edge.toPos.x, edge.toPos.y, edge.toPos.z,
            ]),
            3,
          ]}
          count={2}
          itemSize={3}
        />
      </bufferGeometry>
      <lineBasicMaterial color={color} linewidth={highlighted ? 2 : 1} />
    </line>
  );
}

/** Animated particle travelling along an edge. */
function TransitionParticle({ particle }: { particle: AnimParticle }) {
  const meshRef = useRef<THREE.Mesh>(null);
  const progressRef = useRef(particle.progress);

  useFrame((_, delta) => {
    progressRef.current = (progressRef.current + delta * particle.speed) % 1;
    if (meshRef.current) {
      meshRef.current.position.lerpVectors(
        particle.fromPos,
        particle.toPos,
        progressRef.current
      );
    }
  });

  return (
    <mesh ref={meshRef}>
      <sphereGeometry args={[0.07, 12, 12]} />
      <meshStandardMaterial
        color={COLORS.particle}
        emissive={COLORS.particle}
        emissiveIntensity={1.2}
      />
    </mesh>
  );
}

/** The entire hypercube scene graph. */
function HypercubeScene({
  numBits,
  highlightedStates,
  transitions,
  showLabels,
  animateTransitions,
}: {
  numBits: number;
  highlightedStates: Set<string>;
  transitions: Transition[];
  showLabels: boolean;
  animateTransitions: boolean;
}) {
  const vertices = useMemo(() => buildVertices(numBits), [numBits]);
  const edges = useMemo(() => buildEdges(vertices, numBits), [vertices, numBits]);

  // Build a set of highlighted edge keys (code pairs that appear in transitions)
  const highlightedEdgeKeys = useMemo(() => {
    const keys = new Set<string>();
    for (const t of transitions) {
      keys.add(`${t.from_state}-${t.to_state}`);
      keys.add(`${t.to_state}-${t.from_state}`);
    }
    return keys;
  }, [transitions]);

  // Build particles for animated transitions
  const particles = useMemo((): AnimParticle[] => {
    if (!animateTransitions) return [];
    const byCode = new Map(vertices.map((v) => [v.code, v]));
    return transitions.flatMap((t, i) => {
      const from = byCode.get(t.from_state);
      const to = byCode.get(t.to_state);
      if (!from || !to) return [];
      return [{
        id: `particle-${i}`,
        fromPos: from.position,
        toPos: to.position,
        progress: (i * 0.37) % 1,
        speed: 0.4 + (i % 3) * 0.15,
      }];
    });
  }, [transitions, vertices, animateTransitions]);

  return (
    <>
      {/* Lighting */}
      <ambientLight intensity={0.6} />
      <directionalLight position={[5, 8, 5]} intensity={1.2} castShadow />
      <directionalLight position={[-5, -4, -5]} intensity={0.4} />
      <pointLight position={[0, 0, 6]} intensity={0.5} color="#60a5fa" />

      {/* Grid helper */}
      <gridHelper args={[12, 20, COLORS.grid, COLORS.grid]} rotation={[0, 0, 0]} position={[0, -3, 0]} />

      {/* Edges */}
      {edges.map((e, i) => {
        const key = `${e.from}-${e.to}`;
        return (
          <EdgeLine
            key={`edge-${i}`}
            edge={e}
            highlighted={highlightedEdgeKeys.has(key)}
          />
        );
      })}

      {/* Vertices */}
      {vertices.map((v) => (
        <VertexSphere
          key={v.code}
          vertex={v}
          highlighted={highlightedStates.has(v.code)}
          active={transitions.some(
            (t) => t.from_state === v.code || t.to_state === v.code
          )}
          showLabel={showLabels}
        />
      ))}

      {/* Transition particles */}
      {particles.map((p) => (
        <TransitionParticle key={p.id} particle={p} />
      ))}
    </>
  );
}

// ---------------------------------------------------------------------------
// Controls panel (HTML overlay)
// ---------------------------------------------------------------------------

function ControlsPanel({
  numBits,
  onNumBitsChange,
  showLabels,
  onShowLabelsToggle,
  animateTransitions,
  onAnimateToggle,
}: {
  numBits: number;
  onNumBitsChange: (n: number) => void;
  showLabels: boolean;
  onShowLabelsToggle: () => void;
  animateTransitions: boolean;
  onAnimateToggle: () => void;
}) {
  return (
    <div
      className="absolute top-3 left-3 z-10 bg-gray-900/90 backdrop-blur-sm border border-gray-700 rounded-xl p-4 space-y-4 shadow-2xl min-w-[200px]"
      onPointerDown={(e) => e.stopPropagation()}
    >
      <div className="text-xs font-semibold text-gray-400 uppercase tracking-widest">
        Hypercube Controls
      </div>

      {/* Bit-width slider */}
      <div className="space-y-1">
        <div className="flex justify-between items-center">
          <label className="text-xs text-gray-300">Bits</label>
          <span className="text-xs font-mono bg-gray-800 px-2 py-0.5 rounded" style={{ color: '#009E73' }}>
            {numBits}D &mdash; {1 << numBits} states
          </span>
        </div>
        <input
          type="range"
          min={2}
          max={5}
          step={1}
          value={numBits}
          onChange={(e) => onNumBitsChange(Number(e.target.value))}
          className="w-full accent-teal-500"
        />
        <div className="flex justify-between text-[10px] text-gray-500">
          <span>2</span><span>3</span><span>4</span><span>5</span>
        </div>
      </div>

      {/* Toggles */}
      <div className="space-y-2">
        <Toggle
          label="Show labels"
          checked={showLabels}
          onChange={onShowLabelsToggle}
        />
        <Toggle
          label="Animate transitions"
          checked={animateTransitions}
          onChange={onAnimateToggle}
        />
      </div>

      {/* Legend */}
      <div className="border-t border-gray-700 pt-3 space-y-1.5">
        <div className="text-[10px] font-semibold text-gray-500 uppercase tracking-widest mb-1">Legend</div>
        <LegendItem color={COLORS.vertex} label="Default state" />
        <LegendItem color={COLORS.vertexHighlight} label="Highlighted state" />
        <LegendItem color={COLORS.vertexActive} label="Transition state" />
        <LegendItem color={COLORS.particle} label="Transition particle" />
      </div>
    </div>
  );
}

function Toggle({
  label,
  checked,
  onChange,
}: {
  label: string;
  checked: boolean;
  onChange: () => void;
}) {
  return (
    <button
      onClick={onChange}
      className="flex items-center gap-2 w-full text-left"
    >
      <div
        className={`relative w-8 h-4 rounded-full transition-colors ${
          checked ? 'bg-teal-500' : 'bg-gray-600'
        }`}
      >
        <div
          className={`absolute top-0.5 left-0.5 w-3 h-3 bg-white rounded-full shadow transition-transform ${
            checked ? 'translate-x-4' : 'translate-x-0'
          }`}
        />
      </div>
      <span className="text-xs text-gray-300">{label}</span>
    </button>
  );
}

function LegendItem({ color, label }: { color: string; label: string }) {
  return (
    <div className="flex items-center gap-2">
      <div
        className="w-2.5 h-2.5 rounded-full flex-shrink-0"
        style={{ backgroundColor: color }}
      />
      <span className="text-[10px] text-gray-400">{label}</span>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Stats overlay (top-right)
// ---------------------------------------------------------------------------

function StatsOverlay({ numBits, highlightedCount, transitionCount }: {
  numBits: number;
  highlightedCount: number;
  transitionCount: number;
}) {
  const stateCount = 1 << numBits;
  const edgeCount = (numBits * stateCount) / 2;

  return (
    <div className="absolute top-3 right-3 z-10 bg-gray-900/90 backdrop-blur-sm border border-gray-700 rounded-xl p-3 text-right space-y-1 shadow-2xl">
      <div className="text-[10px] font-semibold text-gray-500 uppercase tracking-widest">Stats</div>
      <StatRow label="Vertices" value={stateCount} />
      <StatRow label="Edges" value={edgeCount} />
      <StatRow label="Highlighted" value={highlightedCount} accent />
      <StatRow label="Transitions" value={transitionCount} />
    </div>
  );
}

function StatRow({ label, value, accent }: { label: string; value: number; accent?: boolean }) {
  return (
    <div className="flex items-center gap-3 justify-between">
      <span className="text-[10px] text-gray-400">{label}</span>
      <span className={`text-xs font-mono font-semibold ${accent ? 'text-teal-400' : 'text-gray-200'}`}>
        {value}
      </span>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Main exported component
// ---------------------------------------------------------------------------

export default function Hypercube3D({
  numBits: numBitsProp = 3,
  highlightedStates: highlightedStatesProp = [],
  transitions: transitionsProp = [],
}: Hypercube3DProps) {
  const [numBits, setNumBits] = useState<number>(
    Math.min(5, Math.max(2, numBitsProp))
  );
  const [showLabels, setShowLabels] = useState(true);
  const [animateTransitions, setAnimateTransitions] = useState(true);

  // Sync prop changes into local state
  useEffect(() => {
    setNumBits(Math.min(5, Math.max(2, numBitsProp)));
  }, [numBitsProp]);

  const highlightedSet = useMemo(
    () => new Set(highlightedStatesProp),
    [highlightedStatesProp]
  );

  const handleNumBitsChange = useCallback((n: number) => setNumBits(n), []);
  const handleLabelsToggle = useCallback(() => setShowLabels((v) => !v), []);
  const handleAnimateToggle = useCallback(() => setAnimateTransitions((v) => !v), []);

  return (
    <div className="relative w-full h-full min-h-[400px] bg-gray-950 rounded-xl overflow-hidden select-none">
      {/* 3D Canvas */}
      <Canvas
        camera={{ position: [0, 0, 8], fov: 50, near: 0.1, far: 100 }}
        dpr={[1, 2]}
        gl={{ antialias: true, alpha: false }}
        style={{ background: 'transparent' }}
      >
        <color attach="background" args={['#030712']} />
        <fog attach="fog" args={['#030712', 14, 28]} />

        <HypercubeScene
          numBits={numBits}
          highlightedStates={highlightedSet}
          transitions={transitionsProp}
          showLabels={showLabels}
          animateTransitions={animateTransitions}
        />

        <OrbitControls
          enableDamping
          dampingFactor={0.08}
          rotateSpeed={0.6}
          zoomSpeed={0.8}
          minDistance={3}
          maxDistance={20}
          autoRotate={transitionsProp.length === 0}
          autoRotateSpeed={0.4}
        />
      </Canvas>

      {/* HTML overlays — rendered outside Canvas via normal DOM */}
      <ControlsPanel
        numBits={numBits}
        onNumBitsChange={handleNumBitsChange}
        showLabels={showLabels}
        onShowLabelsToggle={handleLabelsToggle}
        animateTransitions={animateTransitions}
        onAnimateToggle={handleAnimateToggle}
      />

      <StatsOverlay
        numBits={numBits}
        highlightedCount={highlightedSet.size}
        transitionCount={transitionsProp.length}
      />

      {/* Drag hint (fades via CSS animation) */}
      <div className="absolute bottom-4 left-1/2 -translate-x-1/2 z-10 pointer-events-none">
        <div className="text-[10px] text-gray-500 bg-gray-900/70 px-3 py-1 rounded-full border border-gray-800">
          Drag to rotate &bull; Scroll to zoom &bull; Right-drag to pan
        </div>
      </div>
    </div>
  );
}
