import { HTMLAttributes } from 'react';
import { cn } from '../../utils/cn';

export type SpinnerSize = 'xs' | 'sm' | 'md' | 'lg' | 'xl';

interface SpinnerProps extends HTMLAttributes<HTMLDivElement> {
  size?: SpinnerSize;
  label?: string;
  color?: 'blue' | 'white' | 'gray';
}

const sizeStyles: Record<SpinnerSize, string> = {
  xs: 'h-3 w-3 border',
  sm: 'h-4 w-4 border',
  md: 'h-6 w-6 border-2',
  lg: 'h-8 w-8 border-2',
  xl: 'h-12 w-12 border-2',
};

const colorStyles: Record<string, string> = {
  blue: 'border-blue-600 border-t-transparent',
  white: 'border-white border-t-transparent',
  gray: 'border-gray-400 border-t-transparent',
};

export function Spinner({
  size = 'md',
  label = 'Loading...',
  color = 'blue',
  className,
  ...props
}: SpinnerProps) {
  return (
    <div
      className={cn('inline-flex flex-col items-center justify-center gap-2', className)}
      {...props}
    >
      <div
        className={cn(
          'animate-spin rounded-full',
          sizeStyles[size],
          colorStyles[color]
        )}
        role="status"
        aria-label={label}
      />
      {label && size === 'xl' && (
        <p className="text-sm text-gray-500">{label}</p>
      )}
    </div>
  );
}

export function FullPageSpinner({ label = 'Loading...' }: { label?: string }) {
  return (
    <div className="flex items-center justify-center h-64">
      <Spinner size="xl" label={label} />
    </div>
  );
}
