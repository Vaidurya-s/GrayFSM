import { cn } from '../../utils/cn';

export interface TypedSectionProps {
  /** Section number passed to the inline kicker (e.g. "0.1"). */
  number?: string;
  /** Section title (rendered in Plex Sans). */
  title: React.ReactNode;
  /** Right-aligned metadata next to the title (e.g. "N = 7"). */
  meta?: React.ReactNode;
  /** Heading level 2-4 (default: 2). */
  level?: 2 | 3 | 4;
  /** Additional className for the outer <section>. */
  className?: string;
  /** Body content. */
  children: React.ReactNode;
}

/**
 * TypedSection — a numbered section header with hairline divider plus body.
 *
 * @example
 *   <TypedSection number="0.1" title="Held in catalog" meta="N = 7">
 *     ...table...
 *   </TypedSection>
 *
 * The title is sans-serif; the section number is in mono accent. A strong
 * hairline rule sits under the heading row. Used as the basic page-section
 * container throughout the redesigned app.
 */
export function TypedSection({
  number,
  title,
  meta,
  level = 2,
  className,
  children,
}: TypedSectionProps) {
  const headingClass = cn(
    'font-sans font-semibold tracking-tight text-ink',
    'flex items-baseline gap-3',
    'pb-2 border-b border-rule-strong',
    'mb-5',
    level === 2 ? 'text-xl' : level === 3 ? 'text-lg' : 'text-base',
  );
  const inner = (
    <>
      {number && (
        <span className="font-mono text-sm font-medium text-accent">
          {number}
        </span>
      )}
      <span className="flex-1">{title}</span>
      {meta && (
        <span className="font-mono text-[0.7rem] font-normal uppercase tracking-[0.15em] text-ink-faint">
          {meta}
        </span>
      )}
    </>
  );

  return (
    <section className={cn('mt-12', className)}>
      {level === 2 && <h2 className={headingClass}>{inner}</h2>}
      {level === 3 && <h3 className={headingClass}>{inner}</h3>}
      {level === 4 && <h4 className={headingClass}>{inner}</h4>}
      {children}
    </section>
  );
}
