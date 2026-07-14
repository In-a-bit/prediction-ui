"use client";

import { useEffect, useState, useMemo } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";

import { CryptoUpdownEventPage } from "@/components/crypto/crypto-updown-event-page";
import { SoccerFixtureEventPage } from "@/components/plae/soccer-fixture-event-page";
import { LivePrices } from "@/components/market/live-prices";
import { MarketTradingSection } from "@/components/market/market-trading-section";
import { useMarketSurface } from "@/components/providers/market-surface-provider";
import { fetchPlaeEventBySlug } from "@/lib/api/plae-gamma";
import type { GammaEvent } from "@/lib/types/event";
import {
  formatVolume,
  getDeployedMarkets,
  isCryptoUpdownEvent,
  parseOutcomes,
  parsePrices,
  parseTokenIds,
} from "@/lib/market/gamma-helpers";
import { isSportsSoccerFixtureEvent } from "@/lib/sports-soccer";

/** Shared event detail page for Plaee and LP (basePath / gamma from MarketSurface). */
export function SharedEventPage() {
  const { slug } = useParams<{ slug: string }>();
  const { basePath, label, serviceBase } = useMarketSurface();
  const gammaBase = serviceBase("gamma");
  const [event, setEvent] = useState<GammaEvent | null>(null);
  const [loading, setLoading] = useState(true);
  const [descriptionExpanded, setDescriptionExpanded] = useState(false);
  const [selectedMarketId, setSelectedMarketId] = useState<string | null>(null);

  useEffect(() => {
    const controller = new AbortController();

    async function load() {
      setLoading(true);
      const loaded = await fetchPlaeEventBySlug(
        slug,
        controller.signal,
        gammaBase,
      );
      if (controller.signal.aborted) {
        return;
      }
      setEvent(loaded);
      setLoading(false);
    }

    void load();
    return () => controller.abort();
  }, [slug, gammaBase]);

  const deployedMarkets = useMemo(
    () => (event ? getDeployedMarkets(event) : []),
    [event],
  );

  useEffect(() => {
    if (deployedMarkets.length > 0 && selectedMarketId === null) {
      setSelectedMarketId(String(deployedMarkets[0].id));
    }
  }, [deployedMarkets, selectedMarketId]);

  const selectedMarket = useMemo(
    () =>
      deployedMarkets.find((m) => String(m.id) === selectedMarketId) ??
      deployedMarkets[0],
    [deployedMarkets, selectedMarketId],
  );

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
        <Link
          href={basePath}
          className="mt-4 text-sm text-brand hover:text-brand-hover"
        >
          Back to {label}
        </Link>
      </div>
    );
  }

  const seriesSlug = event.series?.[0]?.slug;
  if (isCryptoUpdownEvent(event) && seriesSlug) {
    return (
      <CryptoUpdownEventPage
        key={seriesSlug}
        initialEvent={event}
        seriesSlug={seriesSlug}
        urlSlug={slug}
      />
    );
  }

  if (isSportsSoccerFixtureEvent(event)) {
    return <SoccerFixtureEventPage event={event} />;
  }

  if (deployedMarkets.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center rounded-2xl border border-card-border bg-card px-8 py-16">
        <p className="text-sm text-muted">No tradeable markets yet</p>
        <Link
          href={basePath}
          className="mt-4 text-sm text-brand hover:text-brand-hover"
        >
          Back to {label}
        </Link>
      </div>
    );
  }

  const tokenIds = selectedMarket ? parseTokenIds(selectedMarket) : [];
  const yesTokenId = tokenIds[0] as string | undefined;
  const noTokenId = tokenIds[1] as string | undefined;
  const { yes: yesPrice, no: noPrice } = selectedMarket
    ? parsePrices(selectedMarket)
    : { yes: 50, no: 50 };
  const outcomeLabels = parseOutcomes(selectedMarket);

  return (
    <div>
      <div className="mb-4 flex items-center gap-2 text-sm text-muted">
        <Link
          href={basePath}
          className="transition-colors hover:text-foreground"
        >
          {label}
        </Link>
        <span>/</span>
        <span className="truncate text-foreground">{event.title}</span>
      </div>

      <MarketTradingSection
        yesTokenId={yesTokenId}
        noTokenId={noTokenId}
        initialYesPrice={yesPrice}
        initialNoPrice={noPrice}
        outcomeLabels={outcomeLabels}
        selectedMarket={selectedMarket}
        resolutionEvent={event}
        tickSize={selectedMarket?.orderPriceMinTickSize ?? 0.01}
        minOrderSize={selectedMarket?.orderMinSize ?? 1}
        conditionId={selectedMarket?.conditionId}
        tokenIds={tokenIds.length > 0 ? tokenIds : undefined}
      >
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
                <>
                  <p
                    className={`mt-2 text-sm text-muted ${
                      descriptionExpanded ? "" : "line-clamp-3"
                    }`}
                  >
                    {event.description}
                  </p>
                  <button
                    type="button"
                    onClick={() => setDescriptionExpanded((prev) => !prev)}
                    className="mt-1 text-xs font-medium text-brand transition-colors hover:text-brand-hover"
                  >
                    {descriptionExpanded ? "Show less" : "Show more"}
                  </button>
                </>
              )}
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-4 border-t border-card-border pt-4">
            <LivePrices
              yesTokenId={yesTokenId}
              noTokenId={noTokenId}
              initialYesPrice={yesPrice}
              initialNoPrice={noPrice}
              outcomeLabels={outcomeLabels}
            />
            {deployedMarkets.length > 1 && (
              <span className="rounded-md bg-brand/10 px-2 py-0.5 text-xs font-medium text-brand">
                {deployedMarkets.length} markets
              </span>
            )}
            <div className="ml-auto text-sm text-muted">
              Vol.{" "}
              {formatVolume(
                event.volume ||
                  selectedMarket?.volume_num ||
                  parseFloat(selectedMarket?.volume ?? "0") ||
                  0,
              )}
            </div>
          </div>
        </div>

        {deployedMarkets.length > 1 && (
          <div className="rounded-2xl border border-card-border bg-card p-6">
            <h2 className="mb-4 text-sm font-semibold text-muted">Markets</h2>
            <div className="space-y-2">
              {deployedMarkets.map((m) => {
                const { yes: mYes, no: mNo } = parsePrices(m);
                const [mYesLabel, mNoLabel] = parseOutcomes(m);
                const isSelected = String(m.id) === selectedMarketId;
                return (
                  <button
                    key={m.id}
                    type="button"
                    onClick={() => setSelectedMarketId(String(m.id))}
                    className={`flex w-full items-center justify-between rounded-xl border px-4 py-3 text-left transition-colors ${
                      isSelected
                        ? "border-brand/50 bg-brand/10"
                        : "border-card-border hover:border-card-border/80 hover:bg-card-hover"
                    }`}
                  >
                    <span
                      className={`text-sm font-medium ${isSelected ? "text-brand" : "text-foreground"}`}
                    >
                      {m.question}
                    </span>
                    <div className="ml-4 flex shrink-0 gap-4 text-xs">
                      <span className="font-bold text-green">
                        {mYesLabel} {mYes}¢
                      </span>
                      <span className="font-bold text-red">
                        {mNoLabel} {mNo}¢
                      </span>
                    </div>
                  </button>
                );
              })}
            </div>
          </div>
        )}
      </MarketTradingSection>
    </div>
  );
}
