/* eslint-disable react/no-unknown-property */
/**
 * Hypercube3D — N-dimensional hypercube blueprint, drawn as wireframe.
 *
 * Datasheet aesthetic. No shaded materials, no atmospheric fog, no point
 * lights — only line segments and unlit dots. Vertices are tiny flat
 * disks in ink colour; edges are hairline strokes; highlighted vertices
 * and edges read in the accent. Background is whatever the host page
 * uses (paper / dark paper).
 *
 * Theme-aware: colours are sampled from CSS custom properties on the
 * document root, so dark mode flips automatically.
 */

import { useRef, useMemo, useState, useEffect, useCallback } from 'react';
import { Canvas, useFrame } from '@react-three/fiber';
import { OrbitControls, Text } from '@react-three/drei';
import * as THREE from 'three';
import type { Transition } from '../../types/fsm';
import { useThemeColors, type ThemeColors } from './use-theme-colors';

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

// `useThemeColors` is now shared with the recharts-based visualisations
// (HammingChart, ComparisonView, MetricsDashboard) — see use-theme-colors.ts.

// ---------------------------------------------------------------------------
// Hypercube geometry helpers (unchanged from the previous version)
// ---------------------------------------------------------------------------

function ndVertexTo3D(index: number, n: number, scale = 1.8): THREE.Vector3 {
  const dims: number[] = [];
  for (let d = 0; d < n; d++) dims.push((index >> d) & 1);

  let x = (dims[0] ?? 0) * 2 - 1;
  let y = (dims[1] ?? 0) * 2 - 1;
  let z = n >= 3 ? (dims[2] ?? 0) * 2 - 1 : 0;

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
        const vI = vertices[i];
        const vJ = vertices[j];
        const codeXor = parseInt(vI.code, 2) ^ parseInt(vJ.code, 2);
        const bitPosition = Math.log2(codeXor);
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
// Three.js sub-components — wireframe / unlit only
// ---------------------------------------------------------------------------

/**
 * VertexDot — a tiny flat ring/disk in ink colour, accent when highlighted.
 * Uses an unlit `meshBasicMaterial` so no scene lighting is needed.
 */
function VertexDot({
  vertex,
  highlighted,
  active,
  showLabel,
  colors,
}: {
  vertex: Vertex3D;
  highlighted: boolean;
  active: boolean;
  showLabel: boolean;
  colors: ThemeColors;
}) {
  const meshRef = useRef<THREE.Mesh>(null);
  const color = highlighted || active ? colors.accent : colors.ink;
  const radius = highlighted || active ? 0.11 : 0.075;

  useFrame((_, delta) => {
    if (!meshRef.current) return;
    if (highlighted || active) {
      meshRef.current.rotation.y += delta * 0.4;
    }
  });

  return (
    <group position={vertex.position}>
      {/* Filled tetrahedron — looks like a tiny diamond marker from any angle */}
      <mesh ref={meshRef}>
        <octahedronGeometry args={[radius, 0]} />
        <meshBasicMaterial color={color} />
      </mesh>
      {/* Hairline ring around highlighted vertices for emphasis */}
      {(highlighted || active) && (
        <mesh rotation={[Math.PI / 2, 0, 0]}>
          <ringGeometry args={[radius * 1.6, radius * 1.85, 32]} />
          <meshBasicMaterial
            color={color}
            transparent
            opacity={0.6}
            side={THREE.DoubleSide}
          />
        </mesh>
      )}
      {showLabel && (
        <Text
          position={[0, radius + 0.18, 0]}
          fontSize={0.16}
          color={highlighted ? colors.accent : colors.inkSoft}
          anchorX="center"
          anchorY="bottom"
          outlineWidth={0.012}
          outlineColor={colors.paper}
        >
          {vertex.code}
        </Text>
      )}
    </group>
  );
}

/** Single hairline edge segment. */
function EdgeLine({
  edge,
  highlighted,
  colors,
}: {
  edge: Edge3D;
  highlighted: boolean;
  colors: ThemeColors;
}) {
  const color = highlighted ? colors.accent : colors.rule;
  // memoize the buffer attribute so React Flow's reconciler doesn't churn
  const attrArgs = useMemo(
    () =>
      [
        new Float32Array([
          edge.fromPos.x,
          edge.fromPos.y,
          edge.fromPos.z,
          edge.toPos.x,
          edge.toPos.y,
          edge.toPos.z,
        ]),
        3,
      ] as [Float32Array, number],
    [edge.fromPos, edge.toPos],
  );

  return (
    <line>
      <bufferGeometry>
        <bufferAttribute
          attach="attributes-position"
          args={attrArgs}
          count={2}
          itemSize={3}
        />
      </bufferGeometry>
      <lineBasicMaterial color={color} linewidth={highlighted ? 2 : 1} />
    </line>
  );
}

/** Animated particle travelling along an edge — small accent dot. */
function TransitionParticle({
  particle,
  colors,
}: {
  particle: AnimParticle;
  colors: ThemeColors;
}) {
  const meshRef = useRef<THREE.Mesh>(null);
  const progressRef = useRef(particle.progress);

  useFrame((_, delta) => {
    progressRef.current = (progressRef.current + delta * particle.speed) % 1;
    if (meshRef.current) {
      meshRef.current.position.lerpVectors(
        particle.fromPos,
        particle.toPos,
        progressRef.current,
      );
    }
  });

  return (
    <mesh ref={meshRef}>
      <sphereGeometry args={[0.06, 12, 12]} />
      <meshBasicMaterial color={colors.accent} />
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
  colors,
}: {
  numBits: number;
  highlightedStates: Set<string>;
  transitions: Transition[];
  showLabels: boolean;
  animateTransitions: boolean;
  colors: ThemeColors;
}) {
  const vertices = useMemo(() => buildVertices(numBits), [numBits]);
  const edges = useMemo(
    () => buildEdges(vertices, numBits),
    [vertices, numBits],
  );

  const highlightedEdgeKeys = useMemo(() => {
    const keys = new Set<string>();
    for (const t of transitions) {
      keys.add(`${t.from_state}-${t.to_state}`);
      keys.add(`${t.to_state}-${t.from_state}`);
    }
    return keys;
  }, [transitions]);

  const particles = useMemo((): AnimParticle[] => {
    if (!animateTransitions) return [];
    const byCode = new Map(vertices.map((v) => [v.code, v]));
    return transitions.flatMap((t, i) => {
      const from = byCode.get(t.from_state);
      const to = byCode.get(t.to_state);
      if (!from || !to) return [];
      return [
        {
          id: `particle-${i}`,
          fromPos: from.position,
          toPos: to.position,
          progress: (i * 0.37) % 1,
          speed: 0.4 + (i % 3) * 0.15,
        },
      ];
    });
  }, [transitions, vertices, animateTransitions]);

  return (
    <>
      {/* Just enough ambient so the unlit basic materials show up — no
       *  shadows, no point/directional lights. */}
      <ambientLight intensity={1.0} />

      {/* Faint axis-plane grid in `--rule` so depth is legible without
       *  competing with the wireframe. */}
      <gridHelper
        args={[12, 12, colors.rule, colors.rule]}
        position={[0, -3, 0]}
      />

      {edges.map((e, i) => {
        const key = `${e.from}-${e.to}`;
        return (
          <EdgeLine
            key={`edge-${i}`}
            edge={e}
            highlighted={highlightedEdgeKeys.has(key)}
            colors={colors}
          />
        );
      })}

      {vertices.map((v) => (
        <VertexDot
          key={v.code}
          vertex={v}
          highlighted={highlightedStates.has(v.code)}
          active={transitions.some(
            (t) => t.from_state === v.code || t.to_state === v.code,
          )}
          showLabel={showLabels}
          colors={colors}
        />
      ))}

      {particles.map((p) => (
        <TransitionParticle key={p.id} particle={p} colors={colors} />
      ))}
    </>
  );
}

// ---------------------------------------------------------------------------
// HTML overlays — datasheet styling
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
      className="absolute top-3 left-3 z-10 bg-paper border border-ink p-4 space-y-4 min-w-[220px]"
      onPointerDown={(e) => e.stopPropagation()}
    >
      <div className="font-mono text-[0.7rem] font-semibold text-ink uppercase tracking-[0.18em] pb-1.5 border-b border-ink">
        Hypercube · Controls
      </div>

      <div className="space-y-1.5">
        <div className="flex justify-between items-center">
          <label className="font-mono text-[0.72rem] uppercase tracking-[0.1em] text-ink-soft">
            Bits
          </label>
          <span className="font-mono font-tabular text-[0.78rem] text-accent">
            {numBits}D · {1 << numBits} states
          </span>
        </div>
        <input
          type="range"
          min={2}
          max={5}
          step={1}
          value={numBits}
          onChange={(e) => onNumBitsChange(Number(e.target.value))}
          className="w-full accent-[var(--accent)]"
        />
        <div className="flex justify-between font-mono text-[0.6rem] text-ink-faint">
          <span>2</span>
          <span>3</span>
          <span>4</span>
          <span>5</span>
        </div>
      </div>

      <div className="space-y-2 pt-1">
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

      <div className="border-t border-rule pt-3 space-y-1">
        <div className="font-mono text-[0.6rem] font-semibold text-ink-faint uppercase tracking-[0.18em] mb-1.5">
          Legend
        </div>
        <LegendItem swatch="ink" label="Default vertex" />
        <LegendItem swatch="accent" label="Highlighted state" />
        <LegendItem swatch="rule" label="Hypercube edge" />
        <LegendItem swatch="accent" label="Transition particle" />
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
      type="button"
      onClick={onChange}
      className="flex items-center gap-2.5 w-full text-left focus-ring"
    >
      <span
        aria-hidden
        className={
          'inline-block w-4 h-4 border border-ink ' +
          (checked ? 'bg-accent' : 'bg-paper')
        }
      >
        {checked && (
          <svg viewBox="0 0 16 16" className="w-full h-full">
            <path
              d="M3 8 L7 12 L13 4"
              stroke="var(--paper)"
              strokeWidth="2"
              fill="none"
            />
          </svg>
        )}
      </span>
      <span className="font-mono text-[0.72rem] uppercase tracking-[0.1em] text-ink-soft">
        {label}
      </span>
    </button>
  );
}

function LegendItem({
  swatch,
  label,
}: {
  swatch: 'ink' | 'accent' | 'rule';
  label: string;
}) {
  const swatchStyle: React.CSSProperties = {
    backgroundColor:
      swatch === 'ink'
        ? 'var(--ink)'
        : swatch === 'accent'
          ? 'var(--accent)'
          : 'var(--rule)',
  };
  return (
    <div className="flex items-center gap-2">
      <span
        aria-hidden
        className="inline-block w-2.5 h-2.5 flex-shrink-0"
        style={swatchStyle}
      />
      <span className="font-mono text-[0.65rem] text-ink-soft">{label}</span>
    </div>
  );
}

function StatsOverlay({
  numBits,
  highlightedCount,
  transitionCount,
}: {
  numBits: number;
  highlightedCount: number;
  transitionCount: number;
}) {
  const stateCount = 1 << numBits;
  const edgeCount = (numBits * stateCount) / 2;

  return (
    <div className="absolute top-3 right-3 z-10 bg-paper border border-ink p-3 space-y-1 text-right min-w-[170px]">
      <div className="font-mono text-[0.6rem] font-semibold text-ink-faint uppercase tracking-[0.18em] pb-1 border-b border-rule mb-1">
        Stats
      </div>
      <StatRow label="Vertices" value={stateCount} />
      <StatRow label="Edges" value={edgeCount} />
      <StatRow label="Highlighted" value={highlightedCount} accent />
      <StatRow label="Transitions" value={transitionCount} />
    </div>
  );
}

function StatRow({
  label,
  value,
  accent,
}: {
  label: string;
  value: number;
  accent?: boolean;
}) {
  return (
    <div className="flex items-center gap-3 justify-between">
      <span className="font-mono text-[0.6rem] uppercase tracking-[0.1em] text-ink-faint">
        {label}
      </span>
      <span
        className={
          'font-mono font-tabular text-[0.82rem] ' +
          (accent ? 'text-accent font-semibold' : 'text-ink')
        }
      >
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
    Math.min(5, Math.max(2, numBitsProp)),
  );
  const [showLabels, setShowLabels] = useState(true);
  const [animateTransitions, setAnimateTransitions] = useState(true);
  const colors = useThemeColors();

  useEffect(() => {
    setNumBits(Math.min(5, Math.max(2, numBitsProp)));
  }, [numBitsProp]);

  const highlightedSet = useMemo(
    () => new Set(highlightedStatesProp),
    [highlightedStatesProp],
  );

  const handleNumBitsChange = useCallback((n: number) => setNumBits(n), []);
  const handleLabelsToggle = useCallback(
    () => setShowLabels((v) => !v),
    [],
  );
  const handleAnimateToggle = useCallback(
    () => setAnimateTransitions((v) => !v),
    [],
  );

  return (
    <div className="relative w-full h-full min-h-[280px] sm:min-h-[400px] bg-paper-shade border border-rule overflow-hidden select-none">
      <Canvas
        camera={{ position: [0, 0, 8], fov: 50, near: 0.1, far: 100 }}
        dpr={[1, 2]}
        gl={{ antialias: true, alpha: true }}
        style={{ background: 'transparent' }}
      >
        <HypercubeScene
          numBits={numBits}
          highlightedStates={highlightedSet}
          transitions={transitionsProp}
          showLabels={showLabels}
          animateTransitions={animateTransitions}
          colors={colors}
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

      <div className="absolute bottom-3 left-1/2 -translate-x-1/2 z-10 pointer-events-none">
        <div className="font-mono text-[0.6rem] uppercase tracking-[0.15em] text-ink-faint bg-paper/80 backdrop-blur-[1px] px-3 py-1 border border-rule">
          drag to rotate · scroll to zoom · right-drag to pan
        </div>
      </div>
    </div>
  );
}
