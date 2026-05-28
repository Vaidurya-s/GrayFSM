import { memo } from 'react';
import { Handle, Position, type NodeProps } from 'reactflow';
import { cn } from '../../utils/cn';

interface StateNodeData {
  label: string;
  output?: string;
  isInitial?: boolean;
  isDummy?: boolean;
  isSelected?: boolean;
  fsmType?: 'moore' | 'mealy';
  /** Optional state-encoding code (e.g. "0b011"). Renders as accent
   *  subtitle when present. Reserved for the future when the editor
   *  store carries the encoding map. */
  encoding?: string;
}

/**
 * StateNode — datasheet-aesthetic React Flow node.
 *
 * Square (32 × auto) hairline-bordered card with mono uppercase label,
 * accent subtitle (encoding code or Moore output), and a tiny status
 * footer for the initial / dummy badge. No rounded corners, no shadows.
 * Selection rings use the accent token. Initial-state arrow rendered as
 * an accent-colored hairline pointer.
 */
function StateNode({ data, selected }: NodeProps<StateNodeData>) {
  const isMoore = data.fsmType === 'moore';
  const subtitle =
    data.encoding ?? (isMoore && data.output ? data.output : undefined);
  const status = data.isDummy
    ? 'DUMMY'
    : data.isInitial
      ? 'INITIAL'
      : undefined;

  return (
    <div
      data-testid={`state-node-${data.label}`}
      className={cn(
        // shape: square corners, hairline ink border, paper background
        'relative w-32 min-h-[5rem] flex flex-col items-stretch',
        'border-2 bg-paper text-ink transition-colors',
        // rules per state type
        data.isDummy
          ? 'border-dashed border-warn'
          : data.isInitial
            ? 'border-ok'
            : 'border-ink',
        // selection — accent inset shadow + outer outline
        selected &&
          'shadow-[inset_0_0_0_2px_var(--accent)] outline outline-1 outline-accent outline-offset-[3px]',
      )}
    >
      {/* Initial-state arrow (renders to the LEFT of the node) */}
      {data.isInitial && (
        <div
          aria-hidden
          className="absolute -left-7 top-1/2 -translate-y-1/2 text-accent"
        >
          <svg
            width="22"
            height="14"
            viewBox="0 0 22 14"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.5"
          >
            <path d="M2 7 L18 7 M14 3 L18 7 L14 11" />
          </svg>
        </div>
      )}

      {/* React Flow target handle */}
      <Handle
        type="target"
        position={Position.Left}
        className="!w-2 !h-2 !bg-accent !border !border-ink !rounded-none"
      />

      {/* main label area */}
      <div className="flex-1 px-3 py-2 flex flex-col items-center justify-center min-w-0">
        {/* tabular figures so digits in state names ("S0", "S10") line
         *  up vertically with the encoding subtitle below. */}
        {/* Wrap long names instead of ellipsising ("S2_renamed" -> "S2_RENAME…").
         *  break-all on the unlikely all-caps long-token case keeps the node
         *  from blowing out horizontally. */}
        <div className="font-mono font-tabular font-semibold uppercase tracking-[0.06em] text-[0.95rem] text-ink text-center break-all leading-tight">
          {data.label}
        </div>
        {subtitle && (
          <div className="font-mono text-[0.72rem] text-accent font-tabular text-center break-all leading-tight mt-0.5">
            {subtitle}
          </div>
        )}
      </div>

      {/* status footer (initial / dummy) */}
      {status && (
        <div
          className={cn(
            'border-t font-mono text-[0.6rem] uppercase tracking-[0.18em] text-center py-0.5',
            data.isDummy
              ? 'border-warn text-warn'
              : 'border-ok text-ok',
          )}
        >
          {status}
        </div>
      )}

      {/* React Flow source handle */}
      <Handle
        type="source"
        position={Position.Right}
        className="!w-2 !h-2 !bg-accent !border !border-ink !rounded-none"
      />
    </div>
  );
}

export default memo(StateNode);
