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

// Phase 6: retokenised. Each variant is a tinted-paper background with a
// status-tone border + heading. Reads cleanly in both themes.
const variantConfig: Record<
  AlertVariant,
  { wrapper: string; icon: ReactNode; iconColor: string }
> = {
  info: {
    wrapper:   'bg-accent-tint border-accent text-ink',
    iconColor: 'text-accent',
    icon: <Info className="h-5 w-5" />,
  },
  success: {
    wrapper:   'bg-paper-shade border-ok text-ink',
    iconColor: 'text-ok',
    icon: <CheckCircle className="h-5 w-5" />,
  },
  warning: {
    wrapper:   'bg-paper-shade border-warn text-ink',
    iconColor: 'text-warn',
    icon: <AlertTriangle className="h-5 w-5" />,
  },
  error: {
    wrapper:   'bg-paper-shade border-err text-ink',
    iconColor: 'text-err',
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
