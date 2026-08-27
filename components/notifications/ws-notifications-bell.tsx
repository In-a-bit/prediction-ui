"use client";

import { useEffect, useRef } from "react";

import { useWsNotifications } from "@/components/providers/ws-notifications-provider";
import { cn } from "@/lib/utils";

function formatTime(ts: number): string {
  return new Date(ts).toLocaleTimeString(undefined, {
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  });
}

export function WsNotificationsBell() {
  const { channels, unread, openItems, open, close } = useWsNotifications();
  const isOpen = openItems !== null;
  const unreadCount = unread.length;
  const flashing = unreadCount > 0 && !isOpen;
  const rootRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!isOpen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") close();
    };
    const onPointer = (e: MouseEvent) => {
      if (!rootRef.current?.contains(e.target as Node)) close();
    };
    window.addEventListener("keydown", onKey);
    window.addEventListener("mousedown", onPointer);
    return () => {
      window.removeEventListener("keydown", onKey);
      window.removeEventListener("mousedown", onPointer);
    };
  }, [isOpen, close]);

  if (channels.length === 0) return null;

  return (
    <div ref={rootRef} className="relative shrink-0">
      <button
        type="button"
        onClick={() => (isOpen ? close() : open())}
        aria-label={
          unreadCount > 0
            ? `${unreadCount} unread WebSocket notifications`
            : "WebSocket notifications"
        }
        aria-expanded={isOpen}
        className={cn(
          "relative rounded-xl border border-card-border bg-card p-2.5 text-muted transition-colors hover:border-foreground/20 hover:text-foreground",
          flashing && "notify-flash border-brand text-brand",
        )}
      >
        <svg
          className="h-5 w-5"
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
          strokeWidth={1.75}
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <path d="M18 8A6 6 0 006 8c0 7-3 9-3 9h18s-3-2-3-9" />
          <path d="M13.73 21a2 2 0 01-3.46 0" />
        </svg>
        {flashing ? (
          <span className="absolute -right-1 -top-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-brand px-1 text-[10px] font-bold text-white">
            {unreadCount > 99 ? "99+" : unreadCount}
          </span>
        ) : null}
      </button>

      {isOpen ? (
        <div
          role="dialog"
          aria-label="WebSocket notifications"
          className="absolute right-0 top-full z-50 mt-2 w-[28rem] max-w-[calc(100vw-2rem)] overflow-hidden rounded-xl border border-card-border bg-card shadow-xl"
        >
          <div className="flex items-center justify-between border-b border-card-border px-3 py-2">
            <span className="text-sm font-medium text-foreground">Notifications</span>
            <button
              type="button"
              onClick={close}
              aria-label="Close notifications"
              className="text-muted transition-colors hover:text-foreground"
            >
              ×
            </button>
          </div>
          <div className="max-h-96 overflow-auto">
            {openItems.length === 0 ? (
              <p className="px-3 py-6 text-center text-xs text-muted">
                No notifications since the last time this was opened.
              </p>
            ) : (
              <ul className="divide-y divide-card-border">
                {openItems.map((item) => (
                  <li key={item.id} className="px-3 py-2">
                    <div className="mb-1 flex items-center gap-2">
                      <span className="rounded bg-brand px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-white">
                        {item.channel}
                      </span>
                      <span className="text-[11px] font-medium text-foreground">{item.eventType}</span>
                      <span className="ml-auto text-[10px] text-muted">{formatTime(item.receivedAt)}</span>
                    </div>
                    <pre className="max-h-40 overflow-auto text-[11px] leading-snug text-muted">
                      {JSON.stringify(item.data, null, 2)}
                    </pre>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      ) : null}
    </div>
  );
}
