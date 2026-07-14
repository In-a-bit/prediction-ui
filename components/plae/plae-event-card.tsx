"use client";

import Link from "next/link";
import { cryptoUpdownDisplayTitle } from "@/lib/crypto-updown";
import {
  isCryptoUpdownEvent,
  parseOutcomePrices,
} from "@/lib/market/gamma-helpers";
import type { GammaEvent } from "@/lib/types/event";
import { formatCompactNumber } from "@/lib/utils";
import { useMarketSurface } from "@/components/providers/market-surface-provider";

export function PlaeEventCard({ event }: { event: GammaEvent }) {
  const { basePath } = useMarketSurface();
  const displayTitle =
    (isCryptoUpdownEvent(event) && cryptoUpdownDisplayTitle(event)) ||
    event.title;
  const { yes: yesPercent, no: noPercent, labels } = parseOutcomePrices(event);
  const [yesLabel, noLabel] = labels;

  return (
    <Link
      href={`${basePath}/${event.slug}`}
      className="group flex flex-col rounded-2xl border border-card-border bg-card transition-all hover:border-brand/30 hover:bg-card-hover"
    >
      {event.image && (
        <div className="relative h-28 w-full overflow-hidden rounded-t-2xl">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={event.image}
            alt={displayTitle}
            className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-105"
          />
          <div className="absolute inset-0 bg-gradient-to-t from-card/80 to-transparent" />
        </div>
      )}

      <div className="flex flex-1 flex-col p-4">
        <h3 className="mb-3 line-clamp-2 text-sm font-semibold leading-snug text-foreground">
          {displayTitle}
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
