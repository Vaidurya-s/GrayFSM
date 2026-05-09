import { cn } from '../../utils/cn';

export type DataTone = 'default' | 'accent' | 'ok' | 'warn' | 'err' | 'faint';

export interface DataItem {
  /** Short label (will be uppercased). */
  label: string;
  /** Value cell. ReactNode so callers can put icons/badges inline. */
  value: React.ReactNode;
  /** Tone for the value cell — colors via the design tokens. */
  tone?: DataTone;
  /** Optional key when consumers can't rely on label uniqueness. */
  key?: string;
}

export interface DataBlockProps {
  items: DataItem[];
  /** Override the wrapper className (rare). */
  className?: string;
  /** Show tabular figures on values (default: true). */
  tabular?: boolean;
}

const toneClass: Record<DataTone, string> = {
  default: 'text-ink',
  accent: 'text-accent',
  ok: 'text-ok',
  warn: 'text-warn',
  err: 'text-err',
  faint: 'text-ink-faint',
};

/**
 * DataBlock — a definition-list of label / value pairs in datasheet style.
 *
 * Two-column grid: small uppercase labels on the left, mono values on the
 * right. Use inside MarginalNote or as a standalone status/metadata panel.
 *
 * @example
 *   <DataBlock items={[
 *     { label: 'API',     value: '● online', tone: 'ok' },
 *     { label: 'Latency', value: '34 ms' },
 *     { label: 'Build',   value: '38f2a49',  tone: 'accent' },
 *   ]} />
 */
export function DataBlock({ items, className, tabular = true }: DataBlockProps) {
  return (
    <dl
      className={cn(
        'grid grid-cols-[auto_1fr] gap-x-5 gap-y-1.5',
        tabular && 'font-tabular',
        className,
      )}
    >
      {items.map((it) => (
        <div key={it.key ?? it.label} className="contents">
          <dt
            className={cn(
              'font-mono text-[0.68rem] uppercase tracking-[0.1em]',
              'text-ink-faint whitespace-nowrap',
            )}
          >
            {it.label}
          </dt>
          <dd className={cn('font-mono', toneClass[it.tone ?? 'default'])}>
            {it.value}
          </dd>
        </div>
      ))}
    </dl>
  );
}
