"use client";

import { createContext, useCallback, useContext, useEffect, useRef, useState } from "react";

type ToastKind = "success" | "error" | "info";

interface Toast {
  id: number;
  message: string;
  kind: ToastKind;
}

interface ToastContextValue {
  toast: (message: string, kind?: ToastKind) => void;
}

const ToastContext = createContext<ToastContextValue>({ toast: () => {} });

let counter = 0;

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);
  const timers = useRef<Map<number, ReturnType<typeof setTimeout>>>(new Map());

  const dismiss = useCallback((id: number) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
    const t = timers.current.get(id);
    if (t) { clearTimeout(t); timers.current.delete(id); }
  }, []);

  const toast = useCallback((message: string, kind: ToastKind = "success") => {
    const id = ++counter;
    setToasts((prev) => [...prev, { id, message, kind }]);
    const timer = setTimeout(() => dismiss(id), 4000);
    timers.current.set(id, timer);
  }, [dismiss]);

  // Cleanup on unmount
  useEffect(() => () => { timers.current.forEach(clearTimeout); }, []);

  return (
    <ToastContext.Provider value={{ toast }}>
      {children}
      <div className="toastContainer" aria-live="polite" aria-atomic="false">
        {toasts.map((t) => (
          <div
            key={t.id}
            className={`toastItem toastItem--${t.kind}`}
            role="alert"
          >
            <span className="toastIcon">
              {t.kind === "success" ? "✓" : t.kind === "error" ? "✕" : "i"}
            </span>
            <span className="toastMsg">{t.message}</span>
            <button
              className="toastDismiss"
              onClick={() => dismiss(t.id)}
              aria-label="Dismiss"
            >
              ×
            </button>
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
}

export function useToast() {
  return useContext(ToastContext);
}
