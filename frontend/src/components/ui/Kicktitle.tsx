import { cn } from '../../utils/cn';

export interface KicktitleProps {
  /** Section number (e.g. "0.1", "II", "A.3"). Optional. */
  number?: string;
  /** Override the section sigil (default: §). */
  sigil?: string;
  /** Element to render on (default: div). */
  as?: 'div' | 'span' | 'p';
  /** Additional className passthrough. */
  className?: string;
  children: React.ReactNode;
}

/**
 * Kicktitle — small uppercase section kicker that precedes a heading.
 *
 * @example
 *   <Kicktitle number="0.1">Held in catalog</Kicktitle>
 *   // → §  0.1  HELD IN CATALOG  (number in accent, sigil in faint ink)
 *
 * Used at the top of TypedSection or directly above a Sans heading.
 */
export function Kicktitle({
  number,
  sigil = '§',
  as: Tag = 'div',
  className,
  children,
}: KicktitleProps) {
  return (
    <Tag
      className={cn(
        'font-mono text-xs font-semibold uppercase tracking-[0.18em]',
        'text-accent',
        className,
      )}
    >
      <span className="text-ink-faint mr-1">{sigil}</span>
      {number && <span className="mr-2">{number}</span>}
      {children}
    </Tag>
  );
}
