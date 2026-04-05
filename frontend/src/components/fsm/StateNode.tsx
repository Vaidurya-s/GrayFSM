import { memo } from 'react';
import { Handle, Position, NodeProps } from 'reactflow';
import { cn } from '../../utils/cn';

interface StateNodeData {
  label: string;
  output?: string;
  isInitial?: boolean;
  isDummy?: boolean;
  isSelected?: boolean;
  fsmType?: 'moore' | 'mealy';
}

function StateNode({ data, selected }: NodeProps<StateNodeData>) {
  const isMoore = data.fsmType === 'moore';

  return (
    <div
      data-testid={`state-node-${data.label}`}
      className={cn(
        'relative flex items-center justify-center',
        'w-24 h-24 rounded-full border-2 shadow-md transition-all',
        'bg-white text-gray-900',
        selected && 'ring-2 ring-blue-500 ring-offset-2',
        data.isInitial && 'border-green-500',
        data.isDummy && 'border-dashed border-orange-400 bg-orange-50',
        !data.isInitial && !data.isDummy && 'border-gray-300'
      )}
    >
      {/* Initial state arrow indicator */}
      {data.isInitial && (
        <div className="absolute -left-6 top-1/2 -translate-y-1/2">
          <svg width="20" height="20" viewBox="0 0 20 20" className="text-green-500">
            <path d="M2 10 L16 10 L12 6 M16 10 L12 14" fill="none" stroke="currentColor" strokeWidth="2" />
          </svg>
        </div>
      )}

      <Handle
        type="target"
        position={Position.Left}
        className="w-3 h-3 bg-blue-500 border-2 border-white"
      />

      <div className="text-center px-1">
        <div className="font-semibold text-sm truncate max-w-[80px]">{data.label}</div>
        {isMoore && data.output && (
          <div className="text-xs text-gray-500 mt-0.5 truncate max-w-[80px]">
            out: {data.output}
          </div>
        )}
        {data.isDummy && (
          <div className="text-xs text-orange-600 mt-0.5">dummy</div>
        )}
      </div>

      <Handle
        type="source"
        position={Position.Right}
        className="w-3 h-3 bg-blue-500 border-2 border-white"
      />
    </div>
  );
}

export default memo(StateNode);
