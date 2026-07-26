"use client";

import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useRef,
  useState,
} from "react";

import type { ActivityEvent } from "@/lib/hooks/use-activity-ws";

const AUTO_DISMISS_MS = 8_000;

type Toast = {
  id: number;
  event: ActivityEvent;
};

type ActivityToasterContextValue = {
  /** Enqueue an activity event as a side toast. */
  push: (event: ActivityEvent) => void;
};

const ActivityToasterContext = createContext<ActivityToasterContextValue | null>(null);

/** Access the toaster's push function. Must be used inside ActivityToasterProvider. */
export function useActivityToaster(): ActivityToasterContextValue {
  const ctx = useContext(ActivityToasterContext);
  if (!ctx) {
    throw new Error("useActivityToaster must be used within ActivityToasterProvider");
  }
  return ctx;
}

/**
 * Provides a minimal, dependency-free toast stack (bottom-right). Each toast
 * shows the event_type badge and the pretty-printed JSON payload, auto-dismisses
 * after ~8s, and can be closed manually.
 */
export function ActivityToasterProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);
  const nextId = useRef(1);

  const dismiss = useCallback((id: number) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  const push = useCallback(
    (event: ActivityEvent) => {
      const id = nextId.current++;
      setToasts((prev) => [...prev, { id, event }]);
      setTimeout(() => dismiss(id), AUTO_DISMISS_MS);
    },
    [dismiss],
  );

  const value = useMemo(() => ({ push }), [push]);

  return (
    <ActivityToasterContext.Provider value={value}>
      {children}
      <div className="pointer-events-none fixed bottom-4 right-4 z-50 flex w-96 max-w-[calc(100vw-2rem)] flex-col gap-2">
        {toasts.map((toast) => (
          <ActivityToastCard key={toast.id} toast={toast} onClose={() => dismiss(toast.id)} />
        ))}
      </div>
    </ActivityToasterContext.Provider>
  );
}

function ActivityToastCard({ toast, onClose }: { toast: Toast; onClose: () => void }) {
  const { event } = toast;
  const status = typeof event.data?.status === "string" ? event.data.status : undefined;

  return (
    <div className="pointer-events-auto overflow-hidden rounded-lg border border-border bg-card text-card-foreground shadow-lg">
      <div className="flex items-center justify-between gap-2 border-b border-border px-3 py-2">
        <div className="flex items-center gap-2">
          <span className="rounded bg-primary px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-primary-foreground">
            {event.event_type}
          </span>
          {status ? (
            <span className="text-xs font-medium text-muted-foreground">{status}</span>
          ) : null}
        </div>
        <button
          type="button"
          onClick={onClose}
          aria-label="Dismiss"
          className="text-muted-foreground transition-colors hover:text-foreground"
        >
          ×
        </button>
      </div>
      <pre className="max-h-64 overflow-auto px-3 py-2 text-[11px] leading-snug">
        {JSON.stringify(event.data, null, 2)}
      </pre>
    </div>
  );
}
