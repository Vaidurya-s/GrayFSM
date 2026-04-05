import { HTMLAttributes, ReactNode } from 'react';
import { cn } from '../../utils/cn';

export type CardVariant = 'default' | 'bordered' | 'elevated';

export interface CardProps extends HTMLAttributes<HTMLDivElement> {
  variant?: CardVariant;
  header?: ReactNode;
  footer?: ReactNode;
}

const variantClasses: Record<CardVariant, string> = {
  default: 'bg-white shadow rounded-lg dark:bg-gray-800 dark:shadow-gray-900/40',
  bordered: 'bg-white border border-gray-200 rounded-lg dark:bg-gray-800 dark:border-gray-700',
  elevated: 'bg-white shadow-md rounded-lg dark:bg-gray-800 dark:shadow-gray-900/40',
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
    <div className={cn(variantClasses[variant], 'overflow-hidden', className)} {...props}>
      {header && (
        <div className="px-6 py-4 border-b border-gray-200 dark:border-gray-700">
          {header}
        </div>
      )}
      {children && (
        <div className="px-6 py-4">
          {children}
        </div>
      )}
      {footer && (
        <div className="px-6 py-4 border-t border-gray-200 bg-gray-50 dark:border-gray-700 dark:bg-gray-700/50">
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
      className={cn('px-6 py-4 border-b border-gray-200 dark:border-gray-700', className)}
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
      className={cn('px-6 py-4 border-t border-gray-200 bg-gray-50 dark:border-gray-700 dark:bg-gray-700/50', className)}
      {...props}
    />
  );
}
