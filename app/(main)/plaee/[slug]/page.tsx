"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";

import { MarketTradingSection } from "@/components/market/market-trading-section";
import Link from "next/link";
import type { GammaEvent } from "@/lib/types/event";

const PLAE_GAMMA_BASE =
  process.env.NEXT_PUBLIC_GAMMA_API_URL ?? "http://localhost:8084";

export default function PlaeEventPage() {
  const { slug } = useParams<{ slug: string }>();
  const [event, setEvent] = useState<GammaEvent | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      try {
        const res = await fetch(`${PLAE_GAMMA_BASE}/events/slug/${slug}`);
        if (!res.ok) {
          setEvent(null);
          return;
        }
        setEvent(await res.json());
      } catch {
        setEvent(null);
      } finally {
        setLoading(false);
      }
    }
    load();
  }, [slug]);

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="h-8 w-48 animate-pulse rounded-lg bg-card" />
        <div className="h-64 animate-pulse rounded-2xl border border-card-border bg-card" />
      </div>
    );
  }

  if (!event) {
    return (
      <div className="flex flex-col items-center justify-center rounded-2xl border border-card-border bg-card px-8 py-16">
        <p className="text-sm text-muted">Event not found</p>
        <Link href="/plaee" className="mt-4 text-sm text-brand hover:text-brand-hover">
          Back to Plaee
        </Link>
      </div>
    );
  }

  // Find first active, non-closed, non-resolved market
  const market =
    event.markets?.find((m) => {
      if (m.closed || !m.active) return false;
      if (m.outcomePrices) {
        try {
          const prices = JSON.parse(m.outcomePrices) as string[];
          if (
            prices.some(
              (p) => parseFloat(p) >= 0.99 || parseFloat(p) <= 0.01,
            )
          )
            return false;
        } catch {}
      }
      return true;
    }) ?? event.markets?.[0];

  const tokenIds = market?.clobTokenIds
    ? JSON.parse(market.clobTokenIds)
    : [];
  const yesTokenId = tokenIds[0] as string | undefined;
  const noTokenId = tokenIds[1] as string | undefined;

  let yesPrice = 50;
  let noPrice = 50;
  if (market?.outcomePrices) {
    try {
      const prices = JSON.parse(market.outcomePrices);
      yesPrice = Math.round(parseFloat(prices[0]) * 100);
      noPrice = Math.round(parseFloat(prices[1]) * 100);
    } catch {}
  }

  return (
    <div>
      {/* Breadcrumb */}
      <div className="mb-4 flex items-center gap-2 text-sm text-muted">
        <Link href="/plaee" className="transition-colors hover:text-foreground">
          Plaee
        </Link>
        <span>/</span>
        <span className="truncate text-foreground">{event.title}</span>
      </div>

      <MarketTradingSection
        yesTokenId={yesTokenId}
        noTokenId={noTokenId}
        initialYesPrice={yesPrice}
        initialNoPrice={noPrice}
        tickSize={market?.orderPriceMinTickSize ?? 0.01}
        minOrderSize={market?.orderMinSize ?? 1}
        conditionId={market?.conditionId}
        tokenIds={tokenIds.length > 0 ? tokenIds : undefined}
      >
        {/* Event header */}
        <div className="rounded-2xl border border-card-border bg-card p-6">
          <div className="mb-4 flex items-start gap-4">
            {event.image && (
              <div className="relative h-16 w-16 shrink-0 overflow-hidden rounded-xl">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={event.image}
                  alt={event.title}
                  className="h-full w-full object-cover"
                />
              </div>
            )}
            <div>
              <h1 className="text-xl font-bold text-foreground lg:text-2xl">
                {event.title}
              </h1>
              {event.description && (
                <p className="mt-2 line-clamp-3 text-sm text-muted">
                  {event.description}
                </p>
              )}
            </div>
          </div>

          {/* Quick stats */}
          <div className="flex flex-wrap items-center gap-4 border-t border-card-border pt-4">
            <div className="flex items-center gap-2">
              <span className="text-2xl font-bold text-green">
                {yesPrice}¢
              </span>
              <span className="text-sm text-muted">Yes</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-2xl font-bold text-red">
                {noPrice}¢
              </span>
              <span className="text-sm text-muted">No</span>
            </div>
            {event.markets?.length > 1 && (
              <span className="rounded-md bg-brand/10 px-2 py-0.5 text-xs font-medium text-brand">
                {event.markets.length} markets
              </span>
            )}
            <div className="ml-auto text-sm text-muted">
              Vol. ${((event.volume || 0) / 1e6).toFixed(1)}M
            </div>
          </div>
        </div>

        {/* All markets list (if multi-market event) */}
        {event.markets?.length > 1 && (
          <div className="rounded-2xl border border-card-border bg-card p-6">
            <h2 className="mb-4 text-sm font-semibold text-muted">
              Markets
            </h2>
            <div className="space-y-3">
              {event.markets.map((m) => {
                let mYes = 50;
                let mNo = 50;
                if (m.outcomePrices) {
                  try {
                    const p = JSON.parse(m.outcomePrices);
                    mYes = Math.round(parseFloat(p[0]) * 100);
                    mNo = Math.round(parseFloat(p[1]) * 100);
                  } catch {}
                }
                const isSelected = m.id === market?.id;
                return (
                  <div
                    key={m.id}
                    className={`flex items-center justify-between rounded-xl border px-4 py-3 ${
                      isSelected
                        ? "border-brand/40 bg-brand/5"
                        : "border-card-border"
                    }`}
                  >
                    <span className="text-sm font-medium text-foreground">
                      {m.question}
                    </span>
                    <div className="flex gap-3">
                      <span className="text-sm font-bold text-green">
                        {mYes}¢
                      </span>
                      <span className="text-sm font-bold text-red">
                        {mNo}¢
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

      </MarketTradingSection>
    </div>
  );
}
