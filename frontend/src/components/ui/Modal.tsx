import { ReactNode, useCallback, useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { X } from 'lucide-react';
import { cn } from '../../utils/cn';

export type ModalSize = 'sm' | 'md' | 'lg';
export type ModalPosition = 'center' | 'bottom-sheet' | 'side-sheet';

export interface ModalProps {
  isOpen: boolean;
  onClose: () => void;
  title?: string;
  description?: string;
  children: ReactNode;
  size?: ModalSize;
  /** Geometry / animation variant. Default `center`. */
  position?: ModalPosition;
  /** Prevent closing when clicking the backdrop */
  disableBackdropClose?: boolean;
  className?: string;
  'data-testid'?: string;
}

const sizeClasses: Record<ModalSize, string> = {
  sm: 'max-w-sm',
  md: 'max-w-lg',
  lg: 'max-w-2xl',
};

// ─── Ref-counted body scroll lock ─────────────────────────────────────────────
// Module-level counter so nested modals/drawers compose without prematurely
// releasing the lock. Capture the pre-lock value on first acquire.
let lockCount = 0;
let savedOverflow: string | null = null;

function lockBodyScroll() {
  if (lockCount === 0) {
    savedOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
  }
  lockCount += 1;
}

function unlockBodyScroll() {
  lockCount = Math.max(0, lockCount - 1);
  if (lockCount === 0) {
    document.body.style.overflow = savedOverflow ?? '';
    savedOverflow = null;
  }
}

// ─── Panel geometry per variant ───────────────────────────────────────────────
function panelClassesFor(position: ModalPosition, size: ModalSize, isOpen: boolean) {
  if (position === 'bottom-sheet') {
    return cn(
      'fixed inset-x-0 bottom-0 w-full',
      'max-h-[85vh]',
      'rounded-t-lg border-t border-rule-strong bg-paper text-ink',
      'shadow-xl flex flex-col',
      'transition-transform duration-200 ease-out',
      isOpen ? 'translate-y-0' : 'translate-y-full',
    );
  }
  if (position === 'side-sheet') {
    return cn(
      'fixed inset-y-0 right-0',
      'w-[min(20rem,90vw)] max-h-[100vh]',
      'border-l border-rule-strong bg-paper text-ink',
      'shadow-xl flex flex-col',
      'transition-transform duration-200 ease-out',
      isOpen ? 'translate-x-0' : 'translate-x-full',
    );
  }
  // center (default) — near-fullscreen on mobile, card on sm+
  return cn(
    'relative z-10 w-full bg-paper rounded-none sm:rounded-lg shadow-xl',
    'border-0 sm:border sm:border-rule-strong text-ink',
    'flex flex-col mx-0 sm:mx-4',
    // Keep older Safari fallback first, then progressively enhance with dvh.
    'max-h-screen sm:max-h-[90vh]',
    'max-h-[100vh] sm:max-h-[90vh]',
    '[@supports(height:100dvh)]:max-h-[100dvh] sm:[@supports(height:100dvh)]:max-h-[90vh]',
    sizeClasses[size],
  );
}

export function Modal({
  isOpen,
  onClose,
  title,
  description,
  children,
  size = 'md',
  position = 'center',
  disableBackdropClose = false,
  className,
  'data-testid': dataTestId,
}: ModalProps) {
  const [mounted, setMounted] = useState(isOpen);
  const panelRef = useRef<HTMLDivElement | null>(null);
  const previouslyFocused = useRef<Element | null>(null);

  const handleEscape = useCallback(
    (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    },
    [onClose]
  );

  // Mount on open; unmount one render after close for exit transition.
  useEffect(() => {
    if (isOpen) {
      setMounted(true);
      return;
    }
    const t = setTimeout(() => setMounted(false), 200);
    return () => clearTimeout(t);
  }, [isOpen]);

  // Body scroll lock + Escape key
  useEffect(() => {
    if (!isOpen) return;
    lockBodyScroll();
    document.addEventListener('keydown', handleEscape);
    return () => {
      document.removeEventListener('keydown', handleEscape);
      unlockBodyScroll();
    };
  }, [isOpen, handleEscape]);

  // Focus management — save on open, restore on close.
  useEffect(() => {
    if (isOpen) {
      previouslyFocused.current = document.activeElement;
      // Defer until the panel is in the DOM and translate has settled.
      const id = window.setTimeout(() => panelRef.current?.focus(), 0);
      return () => window.clearTimeout(id);
    }
    // Restore focus when closing.
    const saved = previouslyFocused.current as HTMLElement | null;
    if (saved && document.contains(saved)) {
      saved.focus();
    } else {
      document.body.focus();
    }
  }, [isOpen]);

  if (!mounted && !isOpen) return null;

  const isSheet = position === 'bottom-sheet' || position === 'side-sheet';
  const dataState = isOpen ? 'open' : 'closed';

  return createPortal(
    <div
      className={cn(
        'fixed inset-0 z-50',
        position === 'center' && 'flex items-center justify-center p-0 sm:p-4',
      )}
      role="dialog"
      aria-modal="true"
      aria-labelledby={title ? 'modal-title' : undefined}
      aria-describedby={description ? 'modal-description' : undefined}
      data-testid={dataTestId}
      data-state={dataState}
    >
      {/* Backdrop — semitransparent ink, no blur to keep the datasheet feel */}
      <div
        className={cn(
          'absolute inset-0 bg-ink/60 transition-opacity duration-200',
          isOpen ? 'opacity-100' : 'opacity-0',
        )}
        onClick={disableBackdropClose ? undefined : onClose}
        aria-hidden="true"
      />

      {/* Panel */}
      <div
        ref={panelRef}
        tabIndex={-1}
        data-state={dataState}
        className={cn(panelClassesFor(position, size, isOpen), className)}
      >
        {/* Drag-handle decoration on bottom-sheet */}
        {position === 'bottom-sheet' && (
          <div
            aria-hidden="true"
            className="h-1 w-10 bg-rule-strong rounded-full mx-auto mt-2"
          />
        )}

        {/* Header */}
        <div
          className={cn(
            'flex items-start justify-between px-4 sm:px-6 py-3 sm:py-4 border-b border-rule shrink-0',
            isSheet && 'pt-3',
          )}
        >
          <div className="flex flex-col gap-1 min-w-0">
            {title ? (
              <h2 id="modal-title" className="text-lg font-semibold text-ink truncate">
                {title}
              </h2>
            ) : (
              <span />
            )}
            {description && (
              <p id="modal-description" className="text-xs text-ink-soft">
                {description}
              </p>
            )}
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-md p-2 sm:p-1 -mr-2 sm:mr-0 text-ink-faint hover:text-ink hover:bg-paper-shade transition-colors focus:outline-none focus:ring-2 focus:ring-accent"
            aria-label="Close modal"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Content */}
        <div className="overflow-y-auto px-4 sm:px-6 py-4 flex-1">{children}</div>
      </div>
    </div>,
    document.body
  );
}
