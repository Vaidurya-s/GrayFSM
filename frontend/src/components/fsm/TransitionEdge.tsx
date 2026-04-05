import { memo } from 'react';
import {
  EdgeProps,
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
  const label = data?.label || (data?.input ? `${data.input}${data.output ? `/${data.output}` : ''}` : '');

  // For Mealy FSMs, render input and output with different colors
  const renderMealyLabel = () => {
    if (!isMealy || !data?.input || !data?.output) {
      return label;
    }

    return (
      <span>
        <span className="text-gray-700">{data.input}</span>
        <span className="text-gray-500"> / </span>
        <span className="text-blue-600">{data.output}</span>
      </span>
    );
  };

  return (
    <>
      <BaseEdge
        id={id}
        path={edgePath}
        markerEnd={markerEnd}
        style={{
          stroke: selected ? '#3b82f6' : '#6b7280',
          strokeWidth: selected ? 2 : 1.5,
        }}
      />
      {label && (
        <EdgeLabelRenderer>
          <div
            data-testid={`transition-edge-${id}`}
            style={{
              position: 'absolute',
              transform: `translate(-50%, -50%) translate(${labelX}px,${labelY}px)`,
              pointerEvents: 'all',
            }}
            className={cn(
              'px-2 py-0.5 rounded text-xs font-medium',
              'bg-white border shadow-sm cursor-pointer',
              selected ? 'border-blue-500' : 'border-gray-300'
            )}
          >
            {isMealy ? renderMealyLabel() : label}
          </div>
        </EdgeLabelRenderer>
      )}
    </>
  );
}

export default memo(TransitionEdge);
