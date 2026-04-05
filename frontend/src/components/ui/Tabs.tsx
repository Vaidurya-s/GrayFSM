import { HTMLAttributes, ReactNode } from 'react';
import { cn } from '../../utils/cn';

// ─── Types ────────────────────────────────────────────────────────────────────

export interface Tab {
  value: string;
  label: ReactNode;
  disabled?: boolean;
}

export interface TabsProps {
  tabs: Tab[];
  value: string;
  onChange: (value: string) => void;
  children?: ReactNode;
  className?: string;
  /** Style of the tab strip */
  variant?: 'underline' | 'pills';
}

export interface TabPanelProps extends HTMLAttributes<HTMLDivElement> {
  value: string;
  activeValue: string;
  children: ReactNode;
}

// ─── Tabs component ───────────────────────────────────────────────────────────

export function Tabs({
  tabs,
  value,
  onChange,
  children,
  className,
  variant = 'underline',
}: TabsProps) {
  return (
    <div className={cn('flex flex-col', className)}>
      {/* Tab strip */}
      <div
        role="tablist"
        className={cn(
          variant === 'underline'
            ? 'flex border-b border-gray-200 gap-0'
            : 'flex gap-1 bg-gray-100 p-1 rounded-lg'
        )}
      >
        {tabs.map((tab) => {
          const isActive = tab.value === value;

          if (variant === 'underline') {
            return (
              <button
                key={tab.value}
                role="tab"
                type="button"
                aria-selected={isActive}
                aria-controls={`tabpanel-${tab.value}`}
                disabled={tab.disabled}
                onClick={() => !tab.disabled && onChange(tab.value)}
                className={cn(
                  'px-4 py-2 text-sm font-medium border-b-2 -mb-px transition-colors',
                  'focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-inset',
                  'disabled:opacity-40 disabled:cursor-not-allowed',
                  isActive
                    ? 'border-blue-600 text-blue-600'
                    : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                )}
              >
                {tab.label}
              </button>
            );
          }

          return (
            <button
              key={tab.value}
              role="tab"
              type="button"
              aria-selected={isActive}
              aria-controls={`tabpanel-${tab.value}`}
              disabled={tab.disabled}
              onClick={() => !tab.disabled && onChange(tab.value)}
              className={cn(
                'flex-1 px-3 py-1.5 text-sm font-medium rounded-md transition-colors',
                'focus:outline-none focus:ring-2 focus:ring-blue-500',
                'disabled:opacity-40 disabled:cursor-not-allowed',
                isActive
                  ? 'bg-white text-gray-900 shadow-sm'
                  : 'text-gray-500 hover:text-gray-700'
              )}
            >
              {tab.label}
            </button>
          );
        })}
      </div>

      {/* Content */}
      {children && <div className="mt-4">{children}</div>}
    </div>
  );
}

// ─── Tab panel ────────────────────────────────────────────────────────────────

export function TabPanel({
  value,
  activeValue,
  children,
  className,
  ...props
}: TabPanelProps) {
  if (value !== activeValue) return null;

  return (
    <div
      role="tabpanel"
      id={`tabpanel-${value}`}
      className={className}
      {...props}
    >
      {children}
    </div>
  );
}
