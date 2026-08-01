import { useToast } from '@/state/toast';
import { Icon } from '@/components/ui/Icon';

/** Renders queued toasts in a polite live region so they are announced, not interrupting. */
export function Toaster() {
  const { toasts, dismiss } = useToast();

  return (
    <div className="toast-region" role="status" aria-live="polite" aria-atomic="false">
      {toasts.map((toast) => (
        <div key={toast.id} className={`toast toast--${toast.tone}`}>
          <span className="toast__dot" aria-hidden="true" />
          <span>{toast.text}</span>
          <button
            type="button"
            className="toast__dismiss"
            onClick={() => dismiss(toast.id)}
            aria-label="Dismiss notification"
          >
            <Icon name="close" size={14} />
          </button>
        </div>
      ))}
    </div>
  );
}
