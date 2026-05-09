import { cn } from '../../utils/cn';

export interface MarginalNoteProps {
  /** Heading shown atop the note (rendered as the small uppercase kicker). */
  heading?: string;
  /** Make the note stick to the top while its container scrolls (default: true at md+). */
  sticky?: boolean;
  /** Override layout — useful for in-line marginalia not in a side column. */
  className?: string;
  children: React.ReactNode;
}

/**
 * MarginalNote — a sidebar/sidenote container.
 *
 * Designed for the right-rail "marginalia" pattern: hairline left border,
 * monospace small body, optional uppercase heading. By default it becomes
 * sticky at md+ widths so it stays visible as the main column scrolls.
 *
 * @example
 *   <MarginalNote heading="System">
 *     <DataBlock items={[...]} />
 *   </MarginalNote>
 */
export function MarginalNote({
  heading,
  sticky = true,
  className,
  children,
}: MarginalNoteProps) {
  return (
    <aside
      className={cn(
        'border-l border-rule pl-6',
        'font-mono text-[0.78rem] leading-relaxed text-ink-soft',
        sticky && 'md:sticky md:top-4 md:self-start',
        className,
      )}
    >
      {heading && (
        <h4
          className={cn(
            'font-mono text-[0.7rem] font-semibold uppercase tracking-[0.15em] text-ink',
            'pb-1.5 border-b border-ink mb-3',
          )}
        >
          {heading}
        </h4>
      )}
      {children}
    </aside>
  );
}
