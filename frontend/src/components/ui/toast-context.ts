import { createContext, useContext } from 'react';

export type ToastType = 'success' | 'error' | 'warning' | 'info';

export interface Toast {
  id: string;
  type: ToastType;
  message: string;
  title?: string;
  duration?: number; // ms; 0 = persistent
}

export interface ToastContextValue {
  addToast: (toast: Omit<Toast, 'id'>) => string;
  removeToast: (id: string) => void;
}

/**
 * Toast context — split out of `Toast.tsx` so React Refresh can fast-refresh
 * the ToastProvider component without a full reload. Files that export both
 * a component AND a non-component value (context, hook) confuse Fast Refresh.
 */
export const ToastContext = createContext<ToastContextValue | null>(null);

export function useToast() {
  const ctx = useContext(ToastContext);
  if (!ctx) {
    throw new Error('useToast must be used within a <ToastProvider>');
  }

  const { addToast, removeToast } = ctx;

  return {
    toast: addToast,
    dismiss: removeToast,
    success: (
      message: string,
      opts?: Partial<Omit<Toast, 'id' | 'type' | 'message'>>,
    ) => addToast({ type: 'success', message, ...opts }),
    error: (
      message: string,
      opts?: Partial<Omit<Toast, 'id' | 'type' | 'message'>>,
    ) => addToast({ type: 'error', message, ...opts }),
    warning: (
      message: string,
      opts?: Partial<Omit<Toast, 'id' | 'type' | 'message'>>,
    ) => addToast({ type: 'warning', message, ...opts }),
    info: (
      message: string,
      opts?: Partial<Omit<Toast, 'id' | 'type' | 'message'>>,
    ) => addToast({ type: 'info', message, ...opts }),
  };
}
