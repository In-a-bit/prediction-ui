"use client";

import Link from "next/link";
import Image from "next/image";
import { parseOutcomePrices } from "@/lib/market/gamma-helpers";
import type { GammaEvent } from "@/lib/types/event";
import { formatCompactNumber } from "@/lib/utils";

export function EventCard({ event }: { event: GammaEvent }) {
  const { yes: yesPercent, no: noPercent, labels } = parseOutcomePrices(event);
  const [yesLabel, noLabel] = labels;

  return (
    <Link
      href={`/event/${event.slug}`}
      className="group flex flex-col rounded-2xl border border-card-border bg-card transition-all hover:border-brand/30 hover:bg-card-hover"
    >
      {/* Image */}
      {event.image && (
        <div className="relative h-28 w-full overflow-hidden rounded-t-2xl">
          <Image
            src={event.image}
            alt={event.title}
            fill
            className="object-cover transition-transform duration-300 group-hover:scale-105"
            sizes="(max-width: 768px) 100vw, (max-width: 1024px) 50vw, (max-width: 1280px) 33vw, 25vw"
          />
          <div className="absolute inset-0 bg-gradient-to-t from-card/80 to-transparent" />
        </div>
      )}

      <div className="flex flex-1 flex-col p-4">
        {/* Title */}
        <h3 className="mb-3 line-clamp-2 text-sm font-semibold leading-snug text-foreground">
          {event.title}
        </h3>

        {/* Volume badge */}
        <div className="mb-3 flex items-center gap-2">
          <span className="rounded-md bg-card-border/50 px-2 py-0.5 text-[11px] font-medium text-muted">
            Vol. {formatCompactNumber(event.volume || 0)}
          </span>
          {event.markets?.length > 1 && (
            <span className="rounded-md bg-brand/10 px-2 py-0.5 text-[11px] font-medium text-brand">
              {event.markets.length} outcomes
            </span>
          )}
        </div>

        {/* Spacer */}
        <div className="mt-auto" />

        {/* YES/NO prices */}
        <div className="flex gap-2">
          <div className="flex flex-1 items-center justify-between rounded-xl bg-green-dim px-3 py-2">
            <span className="text-xs font-medium text-green">{yesLabel}</span>
            <span className="text-sm font-bold text-green">{yesPercent}¢</span>
          </div>
          <div className="flex flex-1 items-center justify-between rounded-xl bg-red-dim px-3 py-2">
            <span className="text-xs font-medium text-red">{noLabel}</span>
            <span className="text-sm font-bold text-red">{noPercent}¢</span>
          </div>
        </div>
      </div>
    </Link>
  );
}
