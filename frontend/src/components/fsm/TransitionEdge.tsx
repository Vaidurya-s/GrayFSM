import { memo } from 'react';
import {
  type EdgeProps,
  getBezierPath,
  EdgeLabelRenderer,
  BaseEdge,
} from 'reactflow';
import { cn } from '../../utils/cn';

interface TransitionEdgeData {
  input?: string;
  output?: string;
  label?: string;
  fsmType?: 'moore' | 'mealy';
}

/**
 * TransitionEdge — datasheet-aesthetic React Flow edge.
 *
 * Bezier path in `--ink` (or `--accent` when selected). Edge label is a
 * square hairline-bordered tag with mono uppercase text:
 *   - Mealy: input | / | output  with the output in accent
 *   - Moore: just input
 *   - Falls back to `data.label` when the structured fields aren't set.
 */
function TransitionEdge({
  id,
  sourceX,
  sourceY,
  targetX,
  targetY,
  sourcePosition,
  targetPosition,
  data,
  selected,
  markerEnd,
}: EdgeProps<TransitionEdgeData>) {
  const [edgePath, labelX, labelY] = getBezierPath({
    sourceX,
    sourceY,
    sourcePosition,
    targetX,
    targetY,
    targetPosition,
  });

  const isMealy = data?.fsmType === 'mealy';
  const fallbackLabel =
    data?.label ||
    (data?.input
      ? `${data.input}${data.output ? `/${data.output}` : ''}`
      : '');
  const hasStructured =
    isMealy && typeof data?.input === 'string' && typeof data?.output === 'string';
  const showLabel = Boolean(hasStructured || fallbackLabel);

  return (
    <>
      <BaseEdge
        id={id}
        path={edgePath}
        markerEnd={markerEnd}
        style={{
          stroke: selected ? 'var(--accent)' : 'var(--ink-soft)',
          strokeWidth: selected ? 1.75 : 1.25,
        }}
      />
      {showLabel && (
        <EdgeLabelRenderer>
          <div
            data-testid={`transition-edge-${id}`}
            style={{
              position: 'absolute',
              transform: `translate(-50%, -50%) translate(${labelX}px,${labelY}px)`,
              pointerEvents: 'all',
            }}
            className={cn(
              'font-mono uppercase tracking-[0.05em] text-[0.7rem]',
              'px-1.5 py-[0.1rem] cursor-pointer',
              'border bg-paper text-ink',
              selected ? 'border-accent' : 'border-rule-strong',
            )}
          >
            {hasStructured ? (
              <>
                <span>{data!.input}</span>
                <span className="text-ink-faint mx-1">/</span>
                <span className="text-accent">{data!.output}</span>
              </>
            ) : (
              fallbackLabel
            )}
          </div>
        </EdgeLabelRenderer>
      )}
    </>
  );
}

export default memo(TransitionEdge);
