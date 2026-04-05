import { HTMLAttributes, ReactNode } from 'react';
import { X, CheckCircle, AlertTriangle, XCircle, Info } from 'lucide-react';
import { cn } from '../../utils/cn';

export type AlertVariant = 'info' | 'success' | 'warning' | 'error';

export interface AlertProps extends Omit<HTMLAttributes<HTMLDivElement>, 'title'> {
  variant?: AlertVariant;
  title?: string;
  children: ReactNode;
  onDismiss?: () => void;
}

const variantConfig: Record<
  AlertVariant,
  { wrapper: string; icon: ReactNode; iconColor: string }
> = {
  info: {
    wrapper: 'bg-blue-50 border-blue-200 text-blue-800 dark:bg-blue-900/30 dark:border-blue-700 dark:text-blue-300',
    iconColor: 'text-blue-500 dark:text-blue-400',
    icon: <Info className="h-5 w-5" />,
  },
  success: {
    wrapper: 'bg-green-50 border-green-200 text-green-800 dark:bg-green-900/30 dark:border-green-700 dark:text-green-300',
    iconColor: 'text-green-500 dark:text-green-400',
    icon: <CheckCircle className="h-5 w-5" />,
  },
  warning: {
    wrapper: 'bg-yellow-50 border-yellow-200 text-yellow-800 dark:bg-yellow-900/30 dark:border-yellow-700 dark:text-yellow-300',
    iconColor: 'text-yellow-500 dark:text-yellow-400',
    icon: <AlertTriangle className="h-5 w-5" />,
  },
  error: {
    wrapper: 'bg-red-50 border-red-200 text-red-800 dark:bg-red-900/30 dark:border-red-700 dark:text-red-300',
    iconColor: 'text-red-500 dark:text-red-400',
    icon: <XCircle className="h-5 w-5" />,
  },
};

export function Alert({
  variant = 'info',
  title,
  children,
  onDismiss,
  className,
  ...props
}: AlertProps) {
  const config = variantConfig[variant];

  return (
    <div
      role="alert"
      className={cn(
        'flex gap-3 rounded-md border p-4',
        config.wrapper,
        className
      )}
      {...props}
    >
      <span className={cn('shrink-0 mt-0.5', config.iconColor)}>{config.icon}</span>

      <div className="flex-1 min-w-0">
        {title && <p className="text-sm font-semibold mb-1">{title}</p>}
        <div className="text-sm">{children}</div>
      </div>

      {onDismiss && (
        <button
          type="button"
          onClick={onDismiss}
          aria-label="Dismiss"
          className={cn(
            'shrink-0 rounded p-0.5 hover:bg-black/10 transition-colors focus:outline-none focus:ring-2 focus:ring-current',
            config.iconColor
          )}
        >
          <X className="h-4 w-4" />
        </button>
      )}
    </div>
  );
}
