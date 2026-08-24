import { createContext, useCallback, useContext, useRef, useState, type ReactNode } from 'react';
import './Toast.css';

export interface ToastOptions {
  actionLabel?: string;
  onAction?: () => void;
}

interface ToastContextValue {
  showToast: (message: string, opts?: ToastOptions) => void;
}

const ToastContext = createContext<ToastContextValue | null>(null);

export function useToast(): ToastContextValue {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error('useToast must be used within a ToastProvider');
  return ctx;
}

interface ToastState {
  id: number;
  message: string;
  actionLabel?: string;
  onAction?: () => void;
}

const DURATION_MS = 5000;

/** One transient toast at a time, with a draining hairline and an optional action — see Toast.css. */
export function ToastProvider({ children }: { children: ReactNode }) {
  const [toast, setToast] = useState<ToastState | null>(null);
  const [visible, setVisible] = useState(false);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const idRef = useRef(0);

  const showToast = useCallback((message: string, opts?: ToastOptions) => {
    if (timerRef.current) clearTimeout(timerRef.current);
    idRef.current += 1;
    const id = idRef.current;
    setVisible(false);
    requestAnimationFrame(() => {
      setToast({ id, message, actionLabel: opts?.actionLabel, onAction: opts?.onAction });
      requestAnimationFrame(() => setVisible(true));
    });
    timerRef.current = setTimeout(() => setVisible(false), DURATION_MS);
  }, []);

  return (
    <ToastContext.Provider value={{ showToast }}>
      {children}
      <div className="toast-host" aria-live="polite">
        {toast && (
          <div className={`toast${visible ? ' show' : ''}`} key={toast.id}>
            <span className="tick">
              <svg viewBox="0 0 12 12">
                <path d="M2 6.2l2.6 2.6L10 3.4" />
              </svg>
            </span>
            <span className="toast-msg">{toast.message}</span>
            {toast.actionLabel && (
              <button
                type="button"
                className="toast-action"
                onClick={() => {
                  toast.onAction?.();
                  setVisible(false);
                }}
              >
                {toast.actionLabel}
              </button>
            )}
            <span className="toast-bar draining" />
          </div>
        )}
      </div>
    </ToastContext.Provider>
  );
}
