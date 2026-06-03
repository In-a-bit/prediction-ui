"use client";

import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";

import { CryptoSpotChartSection } from "@/components/crypto/crypto-spot-chart-section";
import { cryptoSpotHistoryKey } from "@/lib/hooks/use-crypto-spot-chart";
import {
  SeriesSlotPicker,
  type SlotSelectSource,
} from "@/components/crypto/series-slot-picker";
import { LivePrices } from "@/components/market/live-prices";
import { MarketTradingSection } from "@/components/market/market-trading-section";
import { fetchPlaeEventBySlug } from "@/lib/api/plae-gamma";
import { fetchSeriesBySlug } from "@/lib/api/plae-gamma-series";
import {
  adjustBarAfterSelect,
  buildDefaultBarSlugs,
  findLiveEvent,
  parseCryptoMetadata,
  cryptoUpdownDisplayImage,
  cryptoUpdownDisplayTitle,
  cryptoUpdownSlotHeader,
  slotEndAfterForLookback,
  spotChartEvent,
} from "@/lib/crypto-updown";
import {
  formatVolume,
  getDeployedMarkets,
  parseOutcomes,
  parsePrices,
  parseTokenIds,
} from "@/lib/market/gamma-helpers";
import type { GammaEvent, GammaSeries } from "@/lib/types/event";

interface CryptoUpdownEventPageProps {
  initialEvent: GammaEvent;
  seriesSlug: string;
  urlSlug: string;
}

export function CryptoUpdownEventPage({
  initialEvent,
  seriesSlug,
  urlSlug,
}: CryptoUpdownEventPageProps) {
  const router = useRouter();
  const [series, setSeries] = useState<GammaSeries | null>(null);
  const [seriesLoading, setSeriesLoading] = useState(true);
  const [selectedSlug, setSelectedSlug] = useState<string | null>(null);
  const [barSlugs, setBarSlugs] = useState<string[]>([]);
  const [tradeEvent, setTradeEvent] = useState<GammaEvent>(initialEvent);
  const [tradeLoading, setTradeLoading] = useState(false);
  const [descriptionExpanded, setDescriptionExpanded] = useState(false);

  const seriesInitKey = useRef<string | null>(null);
  const intervalMinutes =
    parseCryptoMetadata(initialEvent)?.interval_minutes ?? 5;

  useEffect(() => {
    let cancelled = false;
    async function loadSeries() {
      setSeriesLoading(true);
      const lookback = slotEndAfterForLookback(intervalMinutes);
      const data = await fetchSeriesBySlug(seriesSlug, {
        slotEndAfter: lookback,
      });
      if (cancelled) return;
      setSeries(data);
      const events = data?.events ?? [];
      const initKey = `${seriesSlug}:${intervalMinutes}`;
      if (seriesInitKey.current !== initKey) {
        seriesInitKey.current = initKey;
        setBarSlugs(buildDefaultBarSlugs(events));
        const fromUrl = events.find((e) => e.slug === urlSlug);
        const live = findLiveEvent(events);
        setSelectedSlug(
          fromUrl?.slug ?? live?.slug ?? events[0]?.slug ?? urlSlug,
        );
      }
      setSeriesLoading(false);
    }
    loadSeries();
    return () => {
      cancelled = true;
    };
  }, [seriesSlug, intervalMinutes, urlSlug]);

  useEffect(() => {
    if (!selectedSlug) return;
    let cancelled = false;

    async function loadTradeEvent() {
      setTradeLoading(true);
      const full = await fetchPlaeEventBySlug(selectedSlug!);
      if (cancelled) return;
      if (full) setTradeEvent(full);
      setTradeLoading(false);
    }

    loadTradeEvent();
    return () => {
      cancelled = true;
    };
  }, [selectedSlug]);

  const seriesEvents = series?.events ?? [];

  const liveEvent = useMemo(
    () => findLiveEvent(seriesEvents),
    [seriesEvents],
  );

  const chartEvent = useMemo(
    () => spotChartEvent(tradeEvent, liveEvent),
    [tradeEvent, liveEvent],
  );

  const deployedMarkets = useMemo(
    () => getDeployedMarkets(tradeEvent),
    [tradeEvent],
  );

  const chartMarkets = useMemo(
    () => getDeployedMarkets(chartEvent),
    [chartEvent],
  );

  const selectedMarket = deployedMarkets[0];
  const chartMarket = chartMarkets[0];
  const tokenIds = selectedMarket ? parseTokenIds(selectedMarket) : [];
  const yesTokenId = tokenIds[0] as string | undefined;
  const noTokenId = tokenIds[1] as string | undefined;
  const { yes: yesPrice, no: noPrice } = selectedMarket
    ? parsePrices(selectedMarket)
    : { yes: 50, no: 50 };
  const outcomeLabels = parseOutcomes(selectedMarket);

  const handleSelectSlot = useCallback(
    (slug: string, source: SlotSelectSource = "bar") => {
      setSelectedSlug(slug);
      if (source === "bar") {
        setBarSlugs((prev) => {
          const base =
            prev.length > 0 ? prev : buildDefaultBarSlugs(seriesEvents);
          return adjustBarAfterSelect(seriesEvents, base, slug);
        });
      }
      if (slug !== urlSlug) {
        router.replace(`/plaee/${slug}`, { scroll: false });
      }
    },
    [router, seriesEvents, urlSlug],
  );

  const displayTitle =
    cryptoUpdownDisplayTitle(initialEvent, tradeEvent) ?? initialEvent.title;
  const displayImage =
    cryptoUpdownDisplayImage(initialEvent, tradeEvent) ??
    initialEvent.image ??
    initialEvent.icon;
  const { timeLabel } = cryptoUpdownSlotHeader(tradeEvent, selectedMarket);

  const slotPicker =
    seriesEvents.length > 0 && selectedSlug ? (
      <SeriesSlotPicker
        events={seriesEvents}
        barSlugs={
          barSlugs.length > 0
            ? barSlugs
            : buildDefaultBarSlugs(seriesEvents)
        }
        selectedSlug={selectedSlug}
        onSelect={handleSelectSlot}
      />
    ) : null;

  if (seriesLoading) {
    return (
      <div className="space-y-6">
        <div className="h-8 w-48 animate-pulse rounded-lg bg-card" />
        <div className="h-10 w-full max-w-xl animate-pulse rounded-full bg-card" />
        <div className="h-64 animate-pulse rounded-2xl border border-card-border bg-card" />
      </div>
    );
  }

  const canTrade = deployedMarkets.length > 0;

  const cardContentProps = {
    displayTitle,
    timeLabel,
    displayImage,
    tradeEvent,
    descriptionExpanded,
    onToggleDescription: () =>
      setDescriptionExpanded((prev) => !prev),
    slotPicker,
    chartEvent,
    chartMarket,
    selectedMarket,
    yesTokenId,
    noTokenId,
    yesPrice,
    noPrice,
    outcomeLabels,
  };

  return (
    <div>
      <Breadcrumb title={displayTitle} />

      {canTrade ? (
        <MarketTradingSection
          yesTokenId={yesTokenId}
          noTokenId={noTokenId}
          initialYesPrice={yesPrice}
          initialNoPrice={noPrice}
          outcomeLabels={outcomeLabels}
          tickSize={selectedMarket?.orderPriceMinTickSize ?? 0.01}
          minOrderSize={selectedMarket?.orderMinSize ?? 1}
          conditionId={selectedMarket?.conditionId}
          tokenIds={tokenIds.length > 0 ? tokenIds : undefined}
          hidePriceChart
        >
          <EventHeaderCard>
            <EventCardContent {...cardContentProps} />
          </EventHeaderCard>
        </MarketTradingSection>
      ) : (
        <div className="space-y-6">
          <EventHeaderCard>
            <EventCardContent {...cardContentProps} />
          </EventHeaderCard>
          <div className="flex flex-col items-center justify-center rounded-2xl border border-card-border bg-card px-8 py-16">
            {tradeLoading ? (
              <p className="text-sm text-muted">Loading market…</p>
            ) : (
              <>
                <p className="text-sm text-muted">No tradeable markets yet</p>
                <Link
                  href="/plaee"
                  className="mt-4 text-sm text-brand hover:text-brand-hover"
                >
                  Back to Plaee
                </Link>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

function EventHeaderCard({ children }: { children: ReactNode }) {
  return (
    <div className="rounded-2xl border border-card-border bg-card p-6">
      {children}
    </div>
  );
}

function EventCardContent({
  displayTitle,
  timeLabel,
  displayImage,
  tradeEvent,
  descriptionExpanded,
  onToggleDescription,
  slotPicker,
  chartEvent,
  chartMarket,
  yesTokenId,
  noTokenId,
  yesPrice,
  noPrice,
  outcomeLabels = ["Yes", "No"],
  selectedMarket,
}: {
  displayTitle: string;
  timeLabel?: string | null;
  displayImage?: string;
  tradeEvent: GammaEvent;
  descriptionExpanded: boolean;
  onToggleDescription: () => void;
  slotPicker: ReactNode;
  chartEvent: GammaEvent;
  chartMarket?: ReturnType<typeof getDeployedMarkets>[0];
  yesTokenId?: string;
  noTokenId?: string;
  yesPrice?: number;
  noPrice?: number;
  outcomeLabels?: [string, string];
  selectedMarket?: ReturnType<typeof getDeployedMarkets>[0];
}) {
  return (
    <>
      <EventHeader
        displayTitle={displayTitle}
        timeLabel={timeLabel}
        displayImage={displayImage}
        selectedEvent={tradeEvent}
        descriptionExpanded={descriptionExpanded}
        onToggleDescription={onToggleDescription}
      />

      <CryptoSpotChartSection
        key={cryptoSpotHistoryKey(chartEvent)}
        tradeEvent={tradeEvent}
        chartEvent={chartEvent}
        market={selectedMarket}
        chartMarket={chartMarket}
      />

      {slotPicker && (
        <div className="relative z-20 mt-4 overflow-visible">{slotPicker}</div>
      )}

      {yesTokenId && noTokenId && (
        <div className="mt-4 flex flex-wrap items-center gap-4 border-t border-card-border pt-4">
          <LivePrices
            yesTokenId={yesTokenId}
            noTokenId={noTokenId}
            initialYesPrice={yesPrice ?? 50}
            initialNoPrice={noPrice ?? 50}
            outcomeLabels={outcomeLabels}
          />
          <div className="ml-auto text-sm text-muted">
            Vol.{" "}
            {formatVolume(
              tradeEvent.volume ||
                selectedMarket?.volume_num ||
                parseFloat(selectedMarket?.volume ?? "0") ||
                0,
            )}
          </div>
        </div>
      )}
    </>
  );
}

function EventHeader({
  displayTitle,
  timeLabel,
  displayImage,
  selectedEvent,
  descriptionExpanded,
  onToggleDescription,
}: {
  displayTitle: string;
  timeLabel?: string | null;
  displayImage?: string;
  selectedEvent: GammaEvent;
  descriptionExpanded: boolean;
  onToggleDescription: () => void;
}) {
  return (
    <div className="mb-4 flex items-start gap-4">
      {displayImage && (
        <div className="relative h-16 w-16 shrink-0 overflow-hidden rounded-xl">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={displayImage}
            alt={displayTitle}
            className="h-full w-full object-cover"
          />
        </div>
      )}
      <div className="min-w-0 flex-1">
        <h1 className="text-xl font-bold text-foreground lg:text-2xl">
          {displayTitle}
        </h1>
        {timeLabel && (
          <p className="mt-1 text-sm font-medium text-foreground">
            {timeLabel}
          </p>
        )}
        {selectedEvent.description && (
          <>
            <p
              className={`mt-2 text-sm text-muted ${
                descriptionExpanded ? "" : "line-clamp-3"
              }`}
            >
              {selectedEvent.description}
            </p>
            <button
              type="button"
              onClick={onToggleDescription}
              className="mt-1 text-xs font-medium text-brand transition-colors hover:text-brand-hover"
            >
              {descriptionExpanded ? "Show less" : "Show more"}
            </button>
          </>
        )}
      </div>
    </div>
  );
}

function Breadcrumb({ title }: { title: string }) {
  return (
    <div className="mb-4 flex items-center gap-2 text-sm text-muted">
      <Link href="/plaee" className="transition-colors hover:text-foreground">
        Plaee
      </Link>
      <span>/</span>
      <span className="truncate text-foreground">{title}</span>
    </div>
  );
}
