import { useCallback, useEffect, useRef, useState, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { X, CheckCircle, AlertTriangle, XCircle, Info } from 'lucide-react';
import { cn } from '../../utils/cn';
import { ToastContext, type Toast, type ToastType } from './toast-context';

// `useToast` and the `Toast` / `ToastType` types live in `./toast-context`
// (importers should go through the `./index` barrel or that file directly).
// Re-exporting them from this .tsx file would re-introduce the
// react-refresh/only-export-components warning.

// ─── Config ───────────────────────────────────────────────────────────────────

const typeConfig: Record<
  ToastType,
  { wrapper: string; icon: ReactNode; iconColor: string }
> = {
  success: {
    wrapper: 'bg-white border-green-200',
    iconColor: 'text-green-500',
    icon: <CheckCircle className="h-5 w-5" />,
  },
  error: {
    wrapper: 'bg-white border-red-200',
    iconColor: 'text-red-500',
    icon: <XCircle className="h-5 w-5" />,
  },
  warning: {
    wrapper: 'bg-white border-yellow-200',
    iconColor: 'text-yellow-500',
    icon: <AlertTriangle className="h-5 w-5" />,
  },
  info: {
    wrapper: 'bg-white border-blue-200',
    iconColor: 'text-blue-500',
    icon: <Info className="h-5 w-5" />,
  },
};

// ─── Single Toast Item ────────────────────────────────────────────────────────

function ToastItem({
  toast,
  onRemove,
}: {
  toast: Toast;
  onRemove: (id: string) => void;
}) {
  const config = typeConfig[toast.type];
  const duration = toast.duration ?? 4000;
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (duration === 0) return;
    timerRef.current = setTimeout(() => onRemove(toast.id), duration);
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, [toast.id, duration, onRemove]);

  const isAssertive = toast.type === 'error' || toast.type === 'warning';

  return (
    <div
      role={isAssertive ? 'alert' : 'status'}
      aria-live={isAssertive ? 'assertive' : 'polite'}
      aria-atomic="true"
      className={cn(
        'flex items-start gap-3 w-80 rounded-lg border shadow-lg p-4',
        'animate-in slide-in-from-right-5 fade-in-0 duration-200',
        config.wrapper,
      )}
    >
      <span className={cn('shrink-0 mt-0.5', config.iconColor)}>{config.icon}</span>

      <div className="flex-1 min-w-0">
        {toast.title && (
          <p className="text-sm font-semibold text-gray-900">{toast.title}</p>
        )}
        <p className="text-sm text-gray-700">{toast.message}</p>
      </div>

      <button
        type="button"
        onClick={() => onRemove(toast.id)}
        aria-label="Dismiss notification"
        className="shrink-0 rounded p-0.5 text-gray-400 hover:text-gray-600 hover:bg-gray-100 transition-colors focus:outline-none focus:ring-2 focus:ring-gray-400"
      >
        <X className="h-4 w-4" />
      </button>
    </div>
  );
}

// ─── Provider ─────────────────────────────────────────────────────────────────

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);

  const addToast = useCallback((toast: Omit<Toast, 'id'>): string => {
    const id = `toast-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
    setToasts((prev) => [...prev, { ...toast, id }]);
    return id;
  }, []);

  const removeToast = useCallback((id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  return (
    <ToastContext.Provider value={{ addToast, removeToast }}>
      {children}
      {createPortal(
        <div
          aria-label="Notifications"
          className="fixed bottom-4 right-4 z-50 flex flex-col gap-2 pointer-events-none"
        >
          {toasts.map((toast) => (
            <div key={toast.id} className="pointer-events-auto">
              <ToastItem toast={toast} onRemove={removeToast} />
            </div>
          ))}
        </div>,
        document.body,
      )}
    </ToastContext.Provider>
  );
}
