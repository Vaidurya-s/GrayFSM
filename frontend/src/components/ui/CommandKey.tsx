import { forwardRef } from 'react';
import { Link } from 'react-router-dom';
import { cn } from '../../utils/cn';

interface CommandKeyBaseProps {
  /** Key glyph rendered in accent before the label (e.g. "↳", "⌃", "∅"). */
  keyGlyph: React.ReactNode;
  /** Promote to filled-accent treatment. */
  primary?: boolean;
  /** Small variant for inline action rows. */
  size?: 'normal' | 'sm';
  className?: string;
  children: React.ReactNode;
}

export interface CommandKeyButtonProps
  extends CommandKeyBaseProps,
    Omit<React.ButtonHTMLAttributes<HTMLButtonElement>, 'children' | 'className'> {
  to?: never;
}

export interface CommandKeyLinkProps extends CommandKeyBaseProps {
  /** When set, renders as a react-router Link instead of a button. */
  to: string;
}

export type CommandKeyProps = CommandKeyButtonProps | CommandKeyLinkProps;

const baseClass = cn(
  // datasheet aesthetic — square, hairline, no shadow
  'inline-flex items-center font-mono font-medium uppercase',
  'tracking-[0.08em] no-underline',
  'border border-ink bg-paper text-ink',
  'transition-colors duration-150',
  'hover:bg-ink hover:text-paper',
  'focus-ring',
);

const primaryClass =
  'bg-accent text-paper border-ink hover:bg-ink hover:text-paper';

const sizeClass = {
  normal: 'text-[0.82rem] px-5 py-2.5',
  sm: 'text-[0.72rem] px-3 py-1.5',
};

const keyClass = 'mr-1.5 text-accent';
const keyClassPrimary = 'mr-1.5 text-paper';

/**
 * CommandKey — a datasheet-styled action button.
 *
 * Renders a square, hairline-bordered button with a key-glyph prefix in
 * the accent color. Hover inverts to ink/paper. The `primary` variant
 * fills with the accent. `to` prop swaps button → react-router Link.
 *
 * Usually wrapped in <CommandKeyRow> to share borders cleanly.
 *
 * @example
 *   <CommandKeyRow>
 *     <CommandKey primary keyGlyph="↳" to="/editor/new">New FSM</CommandKey>
 *     <CommandKey keyGlyph="⌃" onClick={onImport}>Import</CommandKey>
 *     <CommandKey keyGlyph="∅" to="/examples">From example</CommandKey>
 *   </CommandKeyRow>
 */
export const CommandKey = forwardRef<
  HTMLButtonElement | HTMLAnchorElement,
  CommandKeyProps
>(function CommandKey(props, ref) {
  const {
    keyGlyph,
    primary = false,
    size = 'normal',
    className,
    children,
  } = props;

  const cls = cn(
    baseClass,
    sizeClass[size],
    primary && primaryClass,
    className,
  );

  const inner = (
    <>
      <span className={primary ? keyClassPrimary : keyClass}>{keyGlyph}</span>
      <span>{children}</span>
    </>
  );

  if ('to' in props && props.to !== undefined) {
    return (
      <Link
        ref={ref as React.Ref<HTMLAnchorElement>}
        to={props.to}
        className={cls}
      >
        {inner}
      </Link>
    );
  }

  const { keyGlyph: _kg, primary: _p, size: _s, className: _c, children: _ch, to: _to, ...rest } =
    props as CommandKeyButtonProps & { to?: undefined };
  void _kg; void _p; void _s; void _c; void _ch; void _to;
  return (
    <button
      ref={ref as React.Ref<HTMLButtonElement>}
      type="button"
      className={cls}
      {...rest}
    >
      {inner}
    </button>
  );
});

export interface CommandKeyRowProps {
  className?: string;
  children: React.ReactNode;
}

/**
 * CommandKeyRow — flush row of CommandKey buttons sharing borders.
 * Removes inner double-borders by collapsing the box outline.
 */
export function CommandKeyRow({ className, children }: CommandKeyRowProps) {
  return (
    <div
      className={cn(
        'inline-flex items-stretch [&>*]:border-l-0 [&>*:first-child]:border-l',
        '[&>*]:rounded-none',
        className,
      )}
    >
      {children}
    </div>
  );
}
