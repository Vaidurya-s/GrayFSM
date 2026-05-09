import { HTMLAttributes, ReactNode } from 'react';
import { cn } from '../../utils/cn';

export type CardVariant = 'default' | 'bordered' | 'elevated';

export interface CardProps extends HTMLAttributes<HTMLDivElement> {
  variant?: CardVariant;
  header?: ReactNode;
  footer?: ReactNode;
}

/* -------------------------------------------------------------------------- *
 * Card — legacy shell, retokenised in Phase 6.                               *
 * -------------------------------------------------------------------------- *
 * The aesthetic stays soft (light shadow / rounded) for the legacy pages     *
 * that haven't been redesigned yet, but the colours are now design tokens    *
 * so dark mode reads as a well-considered layer rather than a "lighter       *
 * grey on near-black" mistake.                                                *
 * -------------------------------------------------------------------------- */

const variantClasses: Record<CardVariant, string> = {
  default:  'bg-paper-shade rounded-lg border border-rule shadow-sm dark:shadow-none',
  bordered: 'bg-paper-shade rounded-lg border border-rule-strong',
  elevated: 'bg-paper-shade rounded-lg border border-rule shadow-md dark:shadow-none',
};

export function Card({
  variant = 'default',
  header,
  footer,
  children,
  className,
  ...props
}: CardProps) {
  return (
    <div className={cn(variantClasses[variant], 'overflow-hidden text-ink', className)} {...props}>
      {header && (
        <div className="px-6 py-4 border-b border-rule">
          {header}
        </div>
      )}
      {children && (
        <div className="px-6 py-4">
          {children}
        </div>
      )}
      {footer && (
        <div className="px-6 py-4 border-t border-rule bg-paper-deep/60">
          {footer}
        </div>
      )}
    </div>
  );
}

/** Convenience sub-components for composing Card without the slots API */
export function CardHeader({ className, ...props }: HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn('px-6 py-4 border-b border-rule', className)}
      {...props}
    />
  );
}

export function CardBody({ className, ...props }: HTMLAttributes<HTMLDivElement>) {
  return <div className={cn('px-6 py-4', className)} {...props} />;
}

export function CardFooter({ className, ...props }: HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn('px-6 py-4 border-t border-rule bg-paper-deep/60', className)}
      {...props}
    />
  );
}
