import {
  createContext,
  useContext,
  useState,
  ReactNode,
  HTMLAttributes,
  ButtonHTMLAttributes,
} from 'react';
import { cn } from '../../utils/cn';

interface TabsContextValue {
  activeTab: string;
  setActiveTab: (id: string) => void;
}

const TabsContext = createContext<TabsContextValue | null>(null);

function useTabsContext() {
  const ctx = useContext(TabsContext);
  if (!ctx) throw new Error('Tabs sub-components must be used inside <Tabs>');
  return ctx;
}

// ------------------------------------------------------------------
// Tabs (root)
// ------------------------------------------------------------------
interface TabsProps {
  defaultTab: string;
  onChange?: (tab: string) => void;
  children: ReactNode;
  className?: string;
}

export function Tabs({ defaultTab, onChange, children, className }: TabsProps) {
  const [activeTab, setActiveTab] = useState(defaultTab);

  const handleChange = (id: string) => {
    setActiveTab(id);
    onChange?.(id);
  };

  return (
    <TabsContext.Provider value={{ activeTab, setActiveTab: handleChange }}>
      <div className={className}>{children}</div>
    </TabsContext.Provider>
  );
}

// ------------------------------------------------------------------
// TabList — the row of tab buttons
// ------------------------------------------------------------------
interface TabListProps extends HTMLAttributes<HTMLDivElement> {
  children: ReactNode;
}

export function TabList({ children, className, ...props }: TabListProps) {
  return (
    <div
      role="tablist"
      className={cn(
        'flex gap-1 border-b border-gray-200 overflow-x-auto',
        className
      )}
      {...props}
    >
      {children}
    </div>
  );
}

// ------------------------------------------------------------------
// Tab — a single tab button
// ------------------------------------------------------------------
interface TabProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  id: string;
  children: ReactNode;
}

export function Tab({ id, children, className, ...props }: TabProps) {
  const { activeTab, setActiveTab } = useTabsContext();
  const isActive = activeTab === id;

  return (
    <button
      role="tab"
      aria-selected={isActive}
      aria-controls={`tabpanel-${id}`}
      onClick={() => setActiveTab(id)}
      className={cn(
        'px-4 py-2.5 text-sm font-medium whitespace-nowrap border-b-2 transition-colors',
        'focus:outline-none focus:ring-2 focus:ring-inset focus:ring-blue-500',
        isActive
          ? 'border-blue-600 text-blue-600'
          : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300',
        className
      )}
      {...props}
    >
      {children}
    </button>
  );
}

// ------------------------------------------------------------------
// TabPanel — the content area for a tab
// ------------------------------------------------------------------
interface TabPanelProps extends HTMLAttributes<HTMLDivElement> {
  id: string;
  children: ReactNode;
}

export function TabPanel({ id, children, className, ...props }: TabPanelProps) {
  const { activeTab } = useTabsContext();
  const isActive = activeTab === id;

  if (!isActive) return null;

  return (
    <div
      role="tabpanel"
      id={`tabpanel-${id}`}
      aria-labelledby={id}
      className={className}
      {...props}
    >
      {children}
    </div>
  );
}
