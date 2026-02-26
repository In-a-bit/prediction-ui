"use client";

import { useMemo } from "react";
import { useSearchParams } from "next/navigation";
import { useEvents } from "@/lib/hooks/use-events";
import { EventCard } from "@/components/market/event-card";
import type { GammaEvent } from "@/lib/types/event";

export function EventGrid({
  initialEvents,
}: {
  initialEvents: GammaEvent[];
  tag?: string;
  searchQuery?: string;
}) {
  const searchParams = useSearchParams();
  const tag = searchParams.get("tag") ?? undefined;
  const q = searchParams.get("q") ?? undefined;

  const { data: events } = useEvents({
    active: true,
    closed: false,
    limit: q ? 100 : 20,
    order: "volume24hr",
    ascending: false,
    tag_slug: tag,
  });

  const displayEvents = useMemo(() => {
    const source = events ?? initialEvents;
    if (!q) return source;
    const lower = q.toLowerCase();
    return source.filter((e) => e.title.toLowerCase().includes(lower));
  }, [events, initialEvents, q]);

  if (!displayEvents.length) {
    return (
      <div className="flex flex-col items-center justify-center rounded-2xl border border-card-border bg-card px-8 py-16">
        <p className="text-sm text-muted">No markets found</p>
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
      {displayEvents.map((event) => (
        <EventCard key={event.id} event={event} />
      ))}
    </div>
  );
}
