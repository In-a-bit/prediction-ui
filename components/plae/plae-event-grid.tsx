"use client";

import { useState } from "react";
import { usePlaeEvents } from "@/lib/hooks/use-plae-events";
import { PlaeEventCard } from "./plae-event-card";

const PAGE_SIZE = 12;

export function PlaeEventGrid() {
  const [page, setPage] = useState(0);

  const { data, isLoading } = usePlaeEvents({
    active: true,
    closed: false,
    limit: PAGE_SIZE,
    offset: page * PAGE_SIZE,
  });

  const events = data?.events ?? [];
  const hasMore = data?.hasMore ?? false;

  if (!events.length && !isLoading) {
    return (
      <div className="flex flex-col items-center justify-center rounded-2xl border border-card-border bg-card px-8 py-16">
        <p className="text-sm text-muted">No events found</p>
      </div>
    );
  }

  return (
    <div>
      {isLoading ? (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {Array.from({ length: PAGE_SIZE }).map((_, i) => (
            <div
              key={i}
              className="h-64 animate-pulse rounded-2xl border border-card-border bg-card"
            />
          ))}
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {events.map((event) => (
            <PlaeEventCard key={event.id} event={event} />
          ))}
        </div>
      )}

      {/* Pagination controls */}
      <div className="mt-6 flex items-center justify-center gap-3">
        <button
          onClick={() => setPage((p) => Math.max(0, p - 1))}
          disabled={page === 0}
          className="rounded-xl border border-card-border px-4 py-2 text-sm font-medium text-foreground transition-colors hover:bg-card-hover disabled:cursor-not-allowed disabled:opacity-40"
        >
          Previous
        </button>
        <span className="text-sm text-muted">Page {page + 1}</span>
        <button
          onClick={() => setPage((p) => p + 1)}
          disabled={!hasMore}
          className="rounded-xl border border-card-border px-4 py-2 text-sm font-medium text-foreground transition-colors hover:bg-card-hover disabled:cursor-not-allowed disabled:opacity-40"
        >
          Next
        </button>
      </div>
    </div>
  );
}
