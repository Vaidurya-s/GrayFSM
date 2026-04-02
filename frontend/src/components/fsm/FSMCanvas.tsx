import { useCallback, useMemo } from 'react';
import ReactFlow, {
  Controls,
  MiniMap,
  Background,
  BackgroundVariant,
  useNodesState,
  useEdgesState,
  addEdge,
  Connection,
  Node,
  Edge,
  MarkerType,
  NodeChange,
  EdgeChange,
} from 'reactflow';
import 'reactflow/dist/style.css';
import StateNode from './StateNode';
import TransitionEdge from './TransitionEdge';
import { useFSMStore } from '../../store/fsmStore';
import type { State, Transition } from '../../types/fsm';

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

interface FSMCanvasProps {
  readOnly?: boolean;
}

export default function FSMCanvas({ readOnly = false }: FSMCanvasProps) {
  const {
    draftStates,
    draftTransitions,
    draftInitialState,
    setSelectedNode,
    setSelectedEdge,
    updateState,
    addTransition,
  } = useFSMStore();

  const initialNodes = useMemo(
    () => statesToNodes(draftStates, draftInitialState),
    [draftStates, draftInitialState]
  );
  const initialEdges = useMemo(
    () => transitionsToEdges(draftTransitions),
    [draftTransitions]
  );

  const [nodes, , onNodesChange] = useNodesState(initialNodes);
  const [edges, setEdges, onEdgesChange] = useEdgesState(initialEdges);

  const handleNodesChange = useCallback(
    (changes: NodeChange[]) => {
      if (readOnly) return;
      onNodesChange(changes);
      // Sync position changes back to store
      changes.forEach((change) => {
        if (change.type === 'position' && change.position && change.id) {
          updateState(change.id, { position: change.position });
        }
      });
    },
    [readOnly, onNodesChange, updateState]
  );

  const handleEdgesChange = useCallback(
    (changes: EdgeChange[]) => {
      if (readOnly) return;
      onEdgesChange(changes);
    },
    [readOnly, onEdgesChange]
  );

  const onConnect = useCallback(
    (connection: Connection) => {
      if (readOnly) return;
      if (connection.source && connection.target) {
        addTransition({
          from_state: connection.source,
          to_state: connection.target,
          input: '',
          output: '',
        });
        setEdges((eds) =>
          addEdge(
            {
              ...connection,
              type: 'transitionEdge',
              markerEnd: { type: MarkerType.ArrowClosed, width: 16, height: 16 },
              data: { input: '', output: '' },
            },
            eds
          )
        );
      }
    },
    [readOnly, addTransition, setEdges]
  );

  const onNodeClick = useCallback(
    (_event: React.MouseEvent, node: Node) => {
      setSelectedNode(node.id);
    },
    [setSelectedNode]
  );

  const onEdgeClick = useCallback(
    (_event: React.MouseEvent, edge: Edge) => {
      setSelectedEdge(edge.id);
    },
    [setSelectedEdge]
  );

  const onPaneClick = useCallback(() => {
    setSelectedNode(null);
    setSelectedEdge(null);
  }, [setSelectedNode, setSelectedEdge]);

  return (
    <div className="w-full h-full" data-testid="fsm-canvas">
      <ReactFlow
        nodes={nodes}
        edges={edges}
        onNodesChange={handleNodesChange}
        onEdgesChange={handleEdgesChange}
        onConnect={onConnect}
        onNodeClick={onNodeClick}
        onEdgeClick={onEdgeClick}
        onPaneClick={onPaneClick}
        nodeTypes={nodeTypes}
        edgeTypes={edgeTypes}
        fitView
        nodesDraggable={!readOnly}
        nodesConnectable={!readOnly}
        elementsSelectable={true}
        proOptions={{ hideAttribution: true }}
      >
        <Controls />
        <MiniMap
          nodeColor={(node) => {
            if (node.data?.isInitial) return '#22c55e';
            if (node.data?.isDummy) return '#f97316';
            return '#e5e7eb';
          }}
          maskColor="rgba(0,0,0,0.1)"
        />
        <Background variant={BackgroundVariant.Dots} gap={20} size={1} />
      </ReactFlow>
    </div>
  );
}
