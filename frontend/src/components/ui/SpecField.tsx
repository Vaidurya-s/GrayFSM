import { cn } from '../../utils/cn';

export interface SpecFieldProps {
  /** Small uppercase label (kicker). */
  label: string;
  /** Primary value (rendered in mono, oversized). */
  value: React.ReactNode;
  /** Italic serif qualifier under the value (optional). */
  qual?: React.ReactNode;
  /** Render the value in accent color. */
  accent?: boolean;
  /** Override value font size (e.g. for shorter text values). */
  valueSize?: 'normal' | 'compact';
  /** Drop the left hairline rule (used for the first field in a row). */
  noLeftRule?: boolean;
  /** className passthrough. */
  className?: string;
}

/**
 * SpecField — a single labeled metric in a datasheet row.
 *
 * Typically grouped 3-up under a TypedSection — see the spec-entry detail
 * pattern. Each field has:
 *   - a tiny uppercase label (mono kicker)
 *   - an oversized mono value (with tabular figures)
 *   - an optional italic serif qualifier line
 *
 * @example
 *   <div className="grid grid-cols-3 gap-8">
 *     <SpecField noLeftRule label="States" value="7"
 *       qual="Three traffic phases plus pedestrian-walk." />
 *     <SpecField label="Encoding bits" value="3" />
 *     <SpecField accent label="Avg Hamming" value="1.00"
 *       qual="Optimised; every transition flips exactly one bit." />
 *   </div>
 */
export function SpecField({
  label,
  value,
  qual,
  accent = false,
  valueSize = 'normal',
  noLeftRule = false,
  className,
}: SpecFieldProps) {
  return (
    <div
      className={cn(
        !noLeftRule && 'border-l border-rule pl-4',
        className,
      )}
    >
      <div className="font-mono text-[0.65rem] font-medium uppercase tracking-[0.18em] text-ink-faint mb-1.5">
        {label}
      </div>
      <div
        className={cn(
          'font-mono font-tabular leading-none mb-1.5',
          valueSize === 'normal' ? 'text-[1.7rem]' : 'text-lg',
          accent ? 'text-accent' : 'text-ink',
        )}
      >
        {value}
      </div>
      {qual && (
        <div className="font-serif italic text-[0.82rem] leading-snug text-ink-soft">
          {qual}
        </div>
      )}
    </div>
  );
}
