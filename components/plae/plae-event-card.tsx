"use client";

import Link from "next/link";
import type { GammaEvent } from "@/lib/types/event";
import { formatCompactNumber } from "@/lib/utils";

function parseOutcomePrices(event: GammaEvent): { yes: number; no: number } {
  const market = event.markets?.find((m) => {
    if (m.closed || !m.active) return false;
    if (m.outcomePrices) {
      try {
        const prices = JSON.parse(m.outcomePrices) as string[];
        if (prices.some((p) => parseFloat(p) >= 0.99 || parseFloat(p) <= 0.01))
          return false;
      } catch {}
    }
    return true;
  }) ?? event.markets?.[0];

  if (!market?.outcomePrices) return { yes: 0.5, no: 0.5 };
  try {
    const prices = JSON.parse(market.outcomePrices);
    return {
      yes: parseFloat(prices[0]) || 0.5,
      no: parseFloat(prices[1]) || 0.5,
    };
  } catch {
    return { yes: 0.5, no: 0.5 };
  }
}

export function PlaeEventCard({ event }: { event: GammaEvent }) {
  const prices = parseOutcomePrices(event);
  const yesPercent = Math.round(prices.yes * 100);
  const noPercent = Math.round(prices.no * 100);

  return (
    <Link
      href={`/plaee/${event.slug}`}
      className="group flex flex-col rounded-2xl border border-card-border bg-card transition-all hover:border-brand/30 hover:bg-card-hover"
    >
      {event.image && (
        <div className="relative h-28 w-full overflow-hidden rounded-t-2xl">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={event.image}
            alt={event.title}
            className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-105"
          />
          <div className="absolute inset-0 bg-gradient-to-t from-card/80 to-transparent" />
        </div>
      )}

      <div className="flex flex-1 flex-col p-4">
        <h3 className="mb-3 line-clamp-2 text-sm font-semibold leading-snug text-foreground">
          {event.title}
        </h3>

        <div className="mb-3 flex items-center gap-2">
          <span className="rounded-md bg-card-border/50 px-2 py-0.5 text-[11px] font-medium text-muted">
            Vol. {formatCompactNumber(event.volume || 0)}
          </span>
          {event.markets?.length > 1 && (
            <span className="rounded-md bg-brand/10 px-2 py-0.5 text-[11px] font-medium text-brand">
              {event.markets.length} markets
            </span>
          )}
        </div>

        <div className="mt-auto" />

        <div className="flex gap-2">
          <div className="flex flex-1 items-center justify-between rounded-xl bg-green-dim px-3 py-2">
            <span className="text-xs font-medium text-green">Yes</span>
            <span className="text-sm font-bold text-green">{yesPercent}¢</span>
          </div>
          <div className="flex flex-1 items-center justify-between rounded-xl bg-red-dim px-3 py-2">
            <span className="text-xs font-medium text-red">No</span>
            <span className="text-sm font-bold text-red">{noPercent}¢</span>
          </div>
        </div>
      </div>
    </Link>
  );
}
