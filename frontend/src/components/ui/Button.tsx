import { ButtonHTMLAttributes, forwardRef } from 'react';
import { cn } from '../../utils/cn';
import { Spinner } from './Spinner';

export type ButtonVariant = 'primary' | 'secondary' | 'outline' | 'ghost' | 'danger';
export type ButtonSize = 'sm' | 'md' | 'lg';

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  size?: ButtonSize;
  loading?: boolean;
  leftIcon?: React.ReactNode;
  rightIcon?: React.ReactNode;
}

// Phase 6: retokenised. Each variant follows the design system —
// `--accent` for primary, `--paper-shade` for secondary, hairline outline
// for outline, transparent for ghost, `--err` for danger. Light + dark
// inherit automatically via the CSS variables.
const variantClasses: Record<ButtonVariant, string> = {
  primary:
    'bg-accent text-paper hover:bg-ink focus:ring-accent border border-transparent',
  secondary:
    'bg-paper-shade text-ink hover:bg-paper-deep focus:ring-rule-strong border border-rule',
  outline:
    'bg-transparent text-ink border border-rule-strong hover:bg-paper-shade focus:ring-accent',
  ghost:
    'bg-transparent text-ink-soft border border-transparent hover:bg-paper-shade hover:text-ink focus:ring-accent',
  danger:
    'bg-err text-paper hover:bg-ink focus:ring-err border border-transparent',
};

const sizeClasses: Record<ButtonSize, string> = {
  // Mobile gets ~32-36px tall (touch-comfortable); desktop unchanged.
  sm: 'px-3 py-2 sm:py-1.5 text-xs gap-1.5',
  md: 'px-4 py-2.5 sm:py-2 text-sm gap-2',
  lg: 'px-5 py-2.5 text-base gap-2',
};

const spinnerSizeMap: Record<ButtonSize, 'sm' | 'md' | 'lg'> = {
  sm: 'sm',
  md: 'sm',
  lg: 'md',
};

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  (
    {
      variant = 'primary',
      size = 'md',
      loading = false,
      disabled,
      className,
      children,
      leftIcon,
      rightIcon,
      ...props
    },
    ref
  ) => {
    const isDisabled = disabled || loading;

    return (
      <button
        ref={ref}
        disabled={isDisabled}
        className={cn(
          'inline-flex items-center justify-center font-medium rounded-md',
          'transition-colors focus:outline-none focus:ring-2 focus:ring-offset-2',
          'disabled:opacity-50 disabled:cursor-not-allowed',
          variantClasses[variant],
          sizeClasses[size],
          className
        )}
        {...props}
      >
        {loading ? (
          <Spinner size={spinnerSizeMap[size]} className="text-current opacity-70" />
        ) : (
          leftIcon
        )}
        {children}
        {!loading && rightIcon}
      </button>
    );
  }
);

Button.displayName = 'Button';
