"use client";

import Link from "next/link";
import Image from "next/image";
import type { GammaEvent } from "@/lib/types/event";
import { formatCompactNumber } from "@/lib/utils";

function parseYesPrice(event: GammaEvent): number {
  // Find first active, non-resolved sub-market
  const market = event.markets?.find((m) => {
    if (m.closed || !m.active) return false;
    if (m.outcomePrices) {
      try {
        const prices = JSON.parse(m.outcomePrices) as string[];
        if (prices.some((p) => parseFloat(p) >= 0.99 || parseFloat(p) <= 0.01)) {
          return false;
        }
      } catch {}
    }
    return true;
  }) ?? event.markets?.[0];

  if (!market?.outcomePrices) return 50;
  try {
    const prices = JSON.parse(market.outcomePrices);
    return Math.round(parseFloat(prices[0]) * 100);
  } catch {
    return 50;
  }
}

export function TrendingCarousel({ events }: { events: GammaEvent[] }) {
  if (!events.length) return null;

  return (
    <div className="flex gap-4 overflow-x-auto pb-2 scrollbar-hide">
      {events.map((event) => {
        const yesPrice = parseYesPrice(event);
        const isHigh = yesPrice >= 50;

        return (
          <Link
            key={event.id}
            href={`/event/${event.slug}`}
            className="group flex min-w-[280px] shrink-0 gap-3 rounded-2xl border border-card-border bg-card p-4 transition-all hover:border-brand/30 hover:bg-card-hover"
          >
            {/* Thumbnail */}
            <div className="relative h-14 w-14 shrink-0 overflow-hidden rounded-xl">
              {event.image ? (
                <Image
                  src={event.image}
                  alt={event.title}
                  fill
                  className="object-cover"
                  sizes="56px"
                />
              ) : (
                <div className="flex h-full w-full items-center justify-center bg-card-border text-xs text-muted">
                  ?
                </div>
              )}
            </div>

            <div className="flex flex-1 flex-col justify-between overflow-hidden">
              <h4 className="line-clamp-2 text-sm font-semibold leading-tight text-foreground">
                {event.title}
              </h4>
              <div className="flex items-center gap-2">
                <span
                  className={`text-lg font-bold ${isHigh ? "text-green" : "text-red"}`}
                >
                  {yesPrice}¢
                </span>
                <span className="text-[11px] text-muted">
                  {formatCompactNumber(event.volume || 0)} Vol
                </span>
              </div>
            </div>
          </Link>
        );
      })}
    </div>
  );
}
