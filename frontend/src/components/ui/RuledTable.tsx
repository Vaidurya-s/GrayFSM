import { cn } from '../../utils/cn';

export type RuledColumnAlign = 'left' | 'right' | 'center';

export interface RuledColumn<T> {
  /** Header text (rendered uppercase). */
  header: string;
  /** Cell renderer. */
  cell: (row: T, index: number) => React.ReactNode;
  /** Tailwind width class (e.g. `'w-12'`, `'w-[5rem]'`). */
  width?: string;
  /** Cell alignment (default: left). */
  align?: RuledColumnAlign;
  /** Make this column's content monospace (default: true). */
  mono?: boolean;
  /** Apply tabular figures to this column (default: false; opt-in for numeric cols). */
  tabular?: boolean;
  /** Cell-level className override. */
  className?: string;
  /** Optional explicit key — defaults to `header`. */
  key?: string;
}

export interface RuledTableProps<T> {
  rows: T[];
  columns: RuledColumn<T>[];
  /** Resolves a stable key per row. */
  rowKey: (row: T, index: number) => string | number;
  /** Whether a given row should render as selected (left accent bar). */
  isSelected?: (row: T, index: number) => boolean;
  /** Click handler — when provided, rows become focusable buttons. */
  onRowClick?: (row: T, index: number) => void;
  /** Empty-state element when rows.length === 0. */
  empty?: React.ReactNode;
  /** Outer className passthrough. */
  className?: string;
  /** ARIA caption for screen readers. */
  ariaLabel?: string;
}

const alignClass: Record<RuledColumnAlign, string> = {
  left: 'text-left',
  right: 'text-right',
  center: 'text-center',
};

/**
 * RuledTable — generic catalog-style table for the datasheet aesthetic.
 *
 * Visual rules:
 *   - Heavy single-line top + bottom border on the header row.
 *   - Hairline rules between body rows.
 *   - No row hover unless `onRowClick` is provided; then accent-tint hover
 *     and an accent left-bar on selected rows.
 *   - Tabular figures opt-in per column (typical for state-counts etc.).
 *
 * @example
 *   <RuledTable
 *     rows={fsms}
 *     rowKey={(f) => f.id}
 *     isSelected={(f) => f.id === selectedId}
 *     onRowClick={setSelected}
 *     columns={[
 *       { header: 'no.', width: 'w-12', align: 'right', tabular: true,
 *         cell: (_, i) => String(i + 1).padStart(3, '0') },
 *       { header: 'Name', mono: false, cell: (f) => f.name },
 *       { header: 'states', tabular: true, align: 'right',
 *         cell: (f) => f.state_count },
 *     ]}
 *   />
 */
export function RuledTable<T>({
  rows,
  columns,
  rowKey,
  isSelected,
  onRowClick,
  empty,
  className,
  ariaLabel,
}: RuledTableProps<T>) {
  if (rows.length === 0 && empty) {
    return <>{empty}</>;
  }

  return (
    <div className="overflow-x-auto -mx-3 sm:mx-0">
    <table
      aria-label={ariaLabel}
      className={cn(
        'w-full border-collapse font-mono text-[0.88rem] min-w-[36rem]',
        className,
      )}
    >
      <thead>
        <tr>
          {columns.map((c) => (
            <th
              key={c.key ?? c.header}
              scope="col"
              className={cn(
                'font-mono text-[0.68rem] font-semibold uppercase tracking-[0.15em]',
                'text-ink-faint',
                'px-3 py-2.5',
                'border-t border-b border-ink',
                'bg-paper',
                c.width,
                alignClass[c.align ?? 'left'],
              )}
            >
              {c.header}
            </th>
          ))}
        </tr>
      </thead>
      <tbody>
        {rows.map((row, i) => {
          const selected = isSelected?.(row, i) ?? false;
          const clickable = !!onRowClick;
          return (
            <tr
              key={rowKey(row, i)}
              onClick={clickable ? () => onRowClick(row, i) : undefined}
              onKeyDown={
                clickable
                  ? (e) => {
                      if (e.key === 'Enter' || e.key === ' ') {
                        e.preventDefault();
                        onRowClick(row, i);
                      }
                    }
                  : undefined
              }
              tabIndex={clickable ? 0 : undefined}
              role={clickable ? 'button' : undefined}
              aria-pressed={clickable ? selected : undefined}
              className={cn(
                'border-b border-rule transition-colors',
                clickable && 'cursor-pointer hover:bg-accent-tint',
                selected && 'bg-accent-tint shadow-[inset_3px_0_0_var(--accent)]',
                'focus-ring',
              )}
              data-selected={selected || undefined}
            >
              {columns.map((c) => (
                <td
                  key={c.key ?? c.header}
                  className={cn(
                    'px-3 py-3 align-top',
                    (c.mono ?? true) ? 'font-mono' : 'font-serif',
                    c.tabular && 'font-tabular',
                    alignClass[c.align ?? 'left'],
                    c.className,
                  )}
                >
                  {c.cell(row, i)}
                </td>
              ))}
            </tr>
          );
        })}
      </tbody>
    </table>
    </div>
  );
}
