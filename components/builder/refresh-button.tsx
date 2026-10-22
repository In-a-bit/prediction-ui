"use client";

import { useState } from "react";

/**
 * Re-reads a balance on demand.
 *
 * Balances change when a transaction mines, not when the page asks, so a figure can be a block or
 * two behind the chain. This lets staff and customers ask again rather than reloading the page.
 */
export function RefreshButton({
  onRefresh,
  label,
}: {
  onRefresh: () => Promise<unknown>;
  label: string;
}) {
  const [busy, setBusy] = useState(false);

  const refresh = async () => {
    setBusy(true);
    try {
      await onRefresh();
    } finally {
      setBusy(false);
    }
  };

  return (
    <button
      type="button"
      onClick={() => void refresh()}
      disabled={busy}
      aria-label={label}
      title={label}
      className="rounded p-1 text-muted hover:bg-card-hover hover:text-foreground disabled:opacity-50"
    >
      <svg
        viewBox="0 0 24 24"
        className={`h-3.5 w-3.5 ${busy ? "animate-spin" : ""}`}
        fill="none"
        stroke="currentColor"
        strokeWidth={2}
        strokeLinecap="round"
        strokeLinejoin="round"
        aria-hidden="true"
      >
        <path d="M21 12a9 9 0 1 1-2.64-6.36" />
        <path d="M21 3v6h-6" />
      </svg>
    </button>
  );
}
