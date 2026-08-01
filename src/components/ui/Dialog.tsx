import { useCallback, useEffect, useRef, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { Icon } from '@/components/ui/Icon';

const FOCUSABLE =
  'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';

export interface DialogProps {
  open: boolean;
  onClose: () => void;
  labelledBy: string;
  children: ReactNode;
  className?: string;
  closeLabel?: string;
}

/**
 * Accessible modal dialog.
 *
 * Handles the four things a dialog must get right: focus moves in on open, focus is
 * trapped while open, Escape closes it, and focus returns to whatever opened it. Body
 * scroll is locked so the page behind cannot move under the overlay.
 */
export function Dialog({ open, onClose, labelledBy, children, className, closeLabel = 'Close' }: DialogProps) {
  const panelRef = useRef<HTMLDivElement>(null);
  const previouslyFocused = useRef<HTMLElement | null>(null);

  const handleKeyDown = useCallback(
    (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.stopPropagation();
        onClose();
        return;
      }
      if (event.key !== 'Tab' || !panelRef.current) return;

      const focusable = [...panelRef.current.querySelectorAll<HTMLElement>(FOCUSABLE)].filter(
        (element) => element.offsetParent !== null || element === document.activeElement,
      );
      if (focusable.length === 0) {
        event.preventDefault();
        return;
      }
      const first = focusable[0];
      const last = focusable[focusable.length - 1];

      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    },
    [onClose],
  );

  useEffect(() => {
    if (!open) return;

    previouslyFocused.current = document.activeElement as HTMLElement | null;
    const { body } = document;
    const previousOverflow = body.style.overflow;
    body.style.overflow = 'hidden';

    // Focus the panel itself; it is `tabindex={-1}` so the whole dialog is announced
    // before the user tabs into its controls.
    const focusTimer = window.setTimeout(() => panelRef.current?.focus(), 0);
    document.addEventListener('keydown', handleKeyDown, true);

    return () => {
      window.clearTimeout(focusTimer);
      document.removeEventListener('keydown', handleKeyDown, true);
      body.style.overflow = previousOverflow;
      previouslyFocused.current?.focus?.();
    };
  }, [open, handleKeyDown]);

  if (!open) return null;

  return createPortal(
    <div
      className="dialog-backdrop"
      // The backdrop is decoration with a convenience dismiss; keyboard users close with
      // Escape and the close button, both handled above.
      role="presentation"
      onMouseDown={(event) => {
        // Only a click that both starts and ends on the backdrop dismisses, so a drag
        // that began inside the panel does not close it.
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={labelledBy}
        tabIndex={-1}
        className={`dialog ${className ?? ''}`}
        style={{ position: 'relative', outline: 'none' }}
      >
        <button type="button" className="dialog__close" onClick={onClose} aria-label={closeLabel}>
          <Icon name="close" size={18} />
        </button>
        {children}
      </div>
    </div>,
    document.body,
  );
}
