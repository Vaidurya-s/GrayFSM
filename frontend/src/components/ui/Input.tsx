import { InputHTMLAttributes, ReactNode, forwardRef } from 'react';
import { cn } from '../../utils/cn';

export interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  error?: string;
  hint?: string;
  leftIcon?: ReactNode;
  rightIcon?: ReactNode;
  wrapperClassName?: string;
}

export const Input = forwardRef<HTMLInputElement, InputProps>(
  (
    {
      label,
      error,
      hint,
      leftIcon,
      rightIcon,
      className,
      wrapperClassName,
      id,
      disabled,
      ...props
    },
    ref
  ) => {
    const inputId = id ?? (label ? label.toLowerCase().replace(/\s+/g, '-') : undefined);

    return (
      <div className={cn('flex flex-col gap-1', wrapperClassName)}>
        {label && (
          <label
            htmlFor={inputId}
            className="text-sm font-medium text-ink-soft"
          >
            {label}
          </label>
        )}

        <div className="relative">
          {leftIcon && (
            <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3 text-ink-faint">
              {leftIcon}
            </div>
          )}

          <input
            ref={ref}
            id={inputId}
            disabled={disabled}
            className={cn(
              'block w-full rounded-md border border-rule-strong bg-paper py-2 text-base sm:text-sm text-ink',
              'placeholder:text-ink-faint',
              'focus:outline-none focus:ring-2 focus:ring-accent focus:border-accent',
              'disabled:bg-paper-shade disabled:text-ink-faint disabled:cursor-not-allowed',
              'transition-colors',
              error && 'border-err focus:ring-err focus:border-err',
              leftIcon ? 'pl-9' : 'pl-3',
              rightIcon ? 'pr-9' : 'pr-3',
              className
            )}
            {...props}
          />

          {rightIcon && (
            <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center pr-3 text-ink-faint">
              {rightIcon}
            </div>
          )}
        </div>

        {error && (
          <p className="text-xs text-err" role="alert">
            {error}
          </p>
        )}
        {!error && hint && (
          <p className="text-xs text-ink-faint">{hint}</p>
        )}
      </div>
    );
  }
);

Input.displayName = 'Input';
