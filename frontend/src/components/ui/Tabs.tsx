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
      {/* Tab strip — retokenised in Phase 6/7 follow-up. Underline
       *  variant gets the datasheet bottom-rule treatment; pill variant
       *  becomes a hairline-bordered group. */}
      <div
        role="tablist"
        className={cn(
          'overflow-x-auto',
          variant === 'underline'
            ? 'flex border-b border-rule gap-0'
            : 'flex gap-1 bg-paper-shade p-1 border border-rule'
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
                  'px-4 py-2 font-mono text-[0.78rem] font-medium uppercase tracking-[0.1em] border-b-2 -mb-px transition-colors',
                  'flex-shrink-0 whitespace-nowrap',
                  'focus:outline-none focus:ring-2 focus:ring-accent focus:ring-inset',
                  'disabled:opacity-40 disabled:cursor-not-allowed',
                  isActive
                    ? 'border-accent text-ink'
                    : 'border-transparent text-ink-soft hover:text-ink hover:border-rule-strong'
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
                'flex-1 px-3 py-1.5 font-mono text-[0.78rem] font-medium uppercase tracking-[0.08em] transition-colors',
                'flex-shrink-0 whitespace-nowrap',
                'focus:outline-none focus:ring-2 focus:ring-accent',
                'disabled:opacity-40 disabled:cursor-not-allowed',
                isActive
                  ? 'bg-paper text-ink border border-ink'
                  : 'text-ink-soft hover:text-ink'
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
