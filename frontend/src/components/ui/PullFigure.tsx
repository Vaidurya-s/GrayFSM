import { cn } from '../../utils/cn';

export interface PullFigureProps {
  /** The big number / claim (rendered very large, mono, tabular figures). */
  figure: React.ReactNode;
  /** Italic serif unit/explanation that runs alongside the figure. */
  unit?: React.ReactNode;
  /** Italic serif body caption underneath. */
  caption?: React.ReactNode;
  /** All-caps mono attribution line. */
  source?: React.ReactNode;
  /** Render the figure in accent color (default: true). */
  accent?: boolean;
  className?: string;
}

/**
 * PullFigure — a hero numerical claim, datasheet-style.
 *
 * Bordered top + bottom by a 3px double rule; the figure dominates while
 * the unit + caption run as quieter italic prose. Use sparingly — once
 * per page at most.
 *
 * @example
 *   <PullFigure
 *     figure="73%"
 *     unit="reduction in adjacent-state Hamming distance"
 *     caption="across the seven specifications presently held."
 *     source="catalog summary, computed at load"
 *   />
 */
export function PullFigure({
  figure,
  unit,
  caption,
  source,
  accent = true,
  className,
}: PullFigureProps) {
  return (
    <figure
      className={cn(
        'mx-auto my-12 max-w-[60rem] py-8 text-center',
        'border-t-[3px] border-b-[3px] border-double border-ink',
        className,
      )}
    >
      <div
        className={cn(
          'font-mono font-light leading-[0.95] tracking-tight font-tabular',
          'text-[clamp(3rem,8vw,6rem)]',
          'text-ink',
        )}
      >
        <span className={accent ? 'text-accent' : undefined}>{figure}</span>
        {unit && (
          <span className="ml-3 font-serif italic font-normal text-[0.4em] text-ink-soft">
            {unit}
          </span>
        )}
      </div>
      {caption && (
        <figcaption className="mx-auto mt-4 max-w-[36rem] font-serif italic text-base leading-relaxed text-ink-soft">
          {caption}
          {source && (
            <span className="block mt-2 font-mono not-italic text-[0.7rem] uppercase tracking-[0.18em] text-ink-faint">
              — {source}
            </span>
          )}
        </figcaption>
      )}
    </figure>
  );
}
