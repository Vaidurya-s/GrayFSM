import { useMemo, useState } from 'react';
import { useThemeColors } from './use-theme-colors';
import ReactFlow, {
  Controls,
  MiniMap,
  Background,
  BackgroundVariant,
  useNodesState,
  useEdgesState,
  Node,
  Edge,
  MarkerType,
} from 'reactflow';
import { ReactFlowProvider } from 'reactflow';
import 'reactflow/dist/style.css';
import StateNode from '../fsm/StateNode';
import TransitionEdge from '../fsm/TransitionEdge';
import type { FSM, OptimizationResponse, State, Transition } from '../../types/fsm';

const nodeTypes = { stateNode: StateNode };
const edgeTypes = { transitionEdge: TransitionEdge };

function statesToNodes(states: State[], initialState: string): Node[] {
  return states.map((s, i) => ({
    id: s.id,
    type: 'stateNode',
    position: s.position || {
      x: 150 + (i % 4) * 220,
      y: 100 + Math.floor(i / 4) * 180,
    },
    data: {
      label: s.name,
      output: s.output,
      isInitial: s.id === initialState || s.name === initialState,
      isDummy: s.is_dummy,
    },
  }));
}

function transitionsToEdges(transitions: Transition[]): Edge[] {
  return transitions.map((t, i) => ({
    id: t.id || `e-${t.from_state}-${t.to_state}-${i}`,
    source: t.from_state,
    target: t.to_state,
    type: 'transitionEdge',
    markerEnd: { type: MarkerType.ArrowClosed, width: 16, height: 16 },
    data: {
      input: t.input,
      output: t.output,
      label: t.label,
    },
  }));
}

interface StaticCanvasProps {
  fsm: FSM;
  label: string;
  badge?: React.ReactNode;
}

function StaticCanvas({ fsm, label, badge }: StaticCanvasProps) {
  const states: State[] =
    fsm.definition?.states ||
    (fsm.states ?? []).map((name, i) => ({
      id: name,
      name,
      position: { x: 150 + (i % 4) * 200, y: 100 + Math.floor(i / 4) * 150 },
    }));

  const transitions: Transition[] = fsm.transitions ?? [];

  const initialNodes = useMemo(
    () => statesToNodes(states, fsm.initial_state),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [fsm.id]
  );
  const initialEdges = useMemo(
    () => transitionsToEdges(transitions),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [fsm.id]
  );

  const [nodes] = useNodesState(initialNodes);
  const [edges] = useEdgesState(initialEdges);

  return (
    <div className="flex flex-col h-full border border-rule">
      <div className="flex items-center justify-between px-3 py-2 bg-paper-shade border-b border-rule shrink-0">
        <span className="font-mono text-[0.7rem] uppercase tracking-[0.15em] text-ink">
          {label}
        </span>
        {badge}
      </div>
      <div className="flex-1 min-h-0">
        <ComparisonCanvas
          nodes={nodes}
          edges={edges}
        />
      </div>
    </div>
  );
}

/** Inner React Flow canvas — extracted so the MiniMap node colours can
 *  be theme-aware via useThemeColors without re-keying the whole panel. */
function ComparisonCanvas({ nodes, edges }: { nodes: Node[]; edges: Edge[] }) {
  const colors = useThemeColors();
  return (
    <ReactFlow
      nodes={nodes}
      edges={edges}
      nodeTypes={nodeTypes}
      edgeTypes={edgeTypes}
      fitView
      nodesDraggable={false}
      nodesConnectable={false}
      elementsSelectable={false}
      proOptions={{ hideAttribution: true }}
    >
      <Controls showInteractive={false} />
      <MiniMap
        nodeColor={(node) => {
          if (node.data?.isInitial) return colors.ok;
          if (node.data?.isDummy) return colors.warn;
          return colors.rule;
        }}
        maskColor={`${colors.ink}1a`}
      />
      <Background variant={BackgroundVariant.Dots} gap={20} size={1} color={colors.rule} />
    </ReactFlow>
  );
}

interface ComparisonViewProps {
  originalFSM: FSM;
  optimizedFSM: FSM;
  metrics: OptimizationResponse;
}

type ViewMode = 'side-by-side' | 'overlay';

export default function ComparisonView({
  originalFSM,
  optimizedFSM,
  metrics,
}: ComparisonViewProps) {
  const [viewMode, setViewMode] = useState<ViewMode>('side-by-side');

  const statesAdded = metrics.dummy_states_added;
  const transitionsChanged =
    (optimizedFSM.transition_count ?? 0) - (originalFSM.transition_count ?? 0);
  const improvementPct = metrics.improvement_percentage;

  const statsBadgeOriginal = (
    <span className="font-mono text-[0.62rem] uppercase tracking-[0.1em] border border-rule-strong text-ink-soft px-1.5 py-[0.05rem]">
      <span className="font-tabular text-ink mr-1">
        {originalFSM.state_count}
      </span>
      states
    </span>
  );

  const statsBadgeOptimized = (
    <span className="font-mono text-[0.62rem] uppercase tracking-[0.1em] border border-ok text-ok px-1.5 py-[0.05rem]">
      <span className="font-tabular mr-1">{optimizedFSM.state_count}</span>
      states
    </span>
  );

  return (
    <div className="flex flex-col gap-3 h-full" data-testid="comparison-view">
      {/* Controls bar */}
      <div className="flex items-center justify-between shrink-0">
        <h3 className="font-mono text-[0.7rem] uppercase tracking-[0.15em] text-ink">
          FSM · Comparison
        </h3>
        <div className="flex border border-ink">
          <button
            type="button"
            onClick={() => setViewMode('side-by-side')}
            className={`px-3 py-1 font-mono text-[0.7rem] uppercase tracking-[0.1em] border-r border-ink transition-colors ${
              viewMode === 'side-by-side'
                ? 'bg-accent text-paper'
                : 'bg-paper text-ink-soft hover:text-ink hover:bg-paper-shade'
            }`}
          >
            Side · by · Side
          </button>
          <button
            type="button"
            onClick={() => setViewMode('overlay')}
            className={`px-3 py-1 font-mono text-[0.7rem] uppercase tracking-[0.1em] transition-colors ${
              viewMode === 'overlay'
                ? 'bg-accent text-paper'
                : 'bg-paper text-ink-soft hover:text-ink hover:bg-paper-shade'
            }`}
          >
            Overlay
          </button>
        </div>
      </div>

      {/* Stats summary bar — datasheet field tiles */}
      <div className="grid grid-cols-3 gap-px bg-rule border border-ink shrink-0">
        <StatTile
          label="Dummy states added"
          value={statesAdded >= 0 ? `+${statesAdded}` : `${statesAdded}`}
          tone="warn"
        />
        <StatTile
          label="Transitions changed"
          value={
            transitionsChanged >= 0 ? `+${transitionsChanged}` : `${transitionsChanged}`
          }
          tone={transitionsChanged >= 0 ? 'accent' : 'err'}
        />
        <StatTile
          label="Improvement"
          value={`${(improvementPct ?? 0).toFixed(1)}%`}
          tone="ok"
        />
      </div>

      {/* Legend */}
      <div className="flex flex-wrap items-center gap-4 font-mono text-[0.62rem] uppercase tracking-[0.12em] text-ink-faint shrink-0">
        <span className="flex items-center gap-1.5">
          <span className="w-2.5 h-2.5 inline-block bg-ok" />
          Initial state
        </span>
        <span className="flex items-center gap-1.5">
          <span className="w-2.5 h-2.5 inline-block border-2 border-dashed border-warn" />
          Dummy state
        </span>
        <span className="flex items-center gap-1.5">
          <span className="w-2.5 h-2.5 inline-block bg-rule-strong" />
          Regular state
        </span>
      </div>

      {/* Canvas area */}
      {viewMode === 'side-by-side' ? (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3 flex-1 min-h-0">
          <ReactFlowProvider>
            <StaticCanvas
              fsm={originalFSM}
              label="Original · before optimisation"
              badge={statsBadgeOriginal}
            />
          </ReactFlowProvider>
          <ReactFlowProvider>
            <StaticCanvas
              fsm={optimizedFSM}
              label="Optimised · after Gray-coding"
              badge={statsBadgeOptimized}
            />
          </ReactFlowProvider>
        </div>
      ) : (
        /* Overlay mode: show optimized FSM full-width with a note */
        <div className="flex-1 min-h-0 border border-rule overflow-hidden relative">
          <ReactFlowProvider>
            <StaticCanvas
              fsm={optimizedFSM}
              label="Optimised · overlay (dummy states marked in warn)"
              badge={statsBadgeOptimized}
            />
          </ReactFlowProvider>
          <div className="absolute bottom-3 right-3 font-mono text-[0.65rem] uppercase tracking-[0.1em] text-ink-soft bg-paper/90 border border-rule px-2 py-1">
            Original{' '}
            <span className="font-tabular text-ink">{originalFSM.state_count}</span>{' '}
            ›{' '}
            <span className="font-tabular text-ok">{optimizedFSM.state_count}</span>{' '}
            states
          </div>
        </div>
      )}
    </div>
  );
}

/** StatTile — datasheet field tile used in the ComparisonView stats bar. */
function StatTile({
  label,
  value,
  tone,
}: {
  label: string;
  value: string;
  tone: 'accent' | 'ok' | 'warn' | 'err';
}) {
  const toneClass = {
    accent: 'text-accent',
    ok: 'text-ok',
    warn: 'text-warn',
    err: 'text-err',
  }[tone];
  return (
    <div className="bg-paper p-2 text-center">
      <div className={`font-mono font-tabular text-lg leading-none mb-1 ${toneClass}`}>
        {value}
      </div>
      <div className="font-mono text-[0.6rem] uppercase tracking-[0.12em] text-ink-faint">
        {label}
      </div>
    </div>
  );
}
