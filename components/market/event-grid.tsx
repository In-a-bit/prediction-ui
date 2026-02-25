"use client";

import { useEvents } from "@/lib/hooks/use-events";
import { EventCard } from "@/components/market/event-card";
import type { GammaEvent } from "@/lib/types/event";

export function EventGrid({
  initialEvents,
  tag,
}: {
  initialEvents: GammaEvent[];
  tag?: string;
}) {
  const { data: events } = useEvents({
    active: true,
    closed: false,
    limit: 20,
    order: "volume24hr",
    ascending: false,
    tag,
  });

  const displayEvents = events ?? initialEvents;

  if (!displayEvents.length) {
    return (
      <div className="flex flex-col items-center justify-center rounded-2xl border border-card-border bg-card px-8 py-16">
        <p className="text-sm text-muted">No markets found</p>
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
      {displayEvents.map((event) => (
        <EventCard key={event.id} event={event} />
      ))}
    </div>
  );
}
