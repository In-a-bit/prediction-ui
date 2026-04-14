import { fetchEventBySlug } from "@/lib/api/gamma";
import { LivePrices } from "@/components/market/live-prices";
import { MarketTradingSection } from "@/components/market/market-trading-section";
import { notFound } from "next/navigation";
import Image from "next/image";
import type { Metadata } from "next";

interface EventPageProps {
  params: Promise<{ slug: string }>;
}

export async function generateMetadata({
  params,
}: EventPageProps): Promise<Metadata> {
  const { slug } = await params;
  const event = await fetchEventBySlug(slug);
  return {
    title: event ? `${event.title} | DPM` : "Market | DPM",
  };
}

function formatVolume(v: number): string {
  if (v >= 1_000_000) return `$${(v / 1_000_000).toFixed(1)}M`;
  if (v >= 1_000) return `$${(v / 1_000).toFixed(1)}K`;
  if (v > 0) return `$${v.toFixed(0)}`;
  return "$0";
}

export default async function EventPage({ params }: EventPageProps) {
  const { slug } = await params;
  const event = await fetchEventBySlug(slug);

  if (!event) notFound();

  // Only consider deployed markets (conditionId set and 2 clob token IDs present)
  const market = event.markets.find((m) => {
    if (m.closed || !m.active) return false;
    if (!m.conditionId || m.conditionId === "PENDING") return false;
    try {
      const ids = m.clobTokenIds ? JSON.parse(m.clobTokenIds) : [];
      if (!Array.isArray(ids) || ids.length < 2) return false;
    } catch {
      return false;
    }
    if (m.outcomePrices) {
      try {
        const prices = JSON.parse(m.outcomePrices) as string[];
        if (prices.some((p) => parseFloat(p) >= 0.99 || parseFloat(p) <= 0.01)) {
          return false;
        }
      } catch {}
    }
    return true;
  }) ?? event.markets[0];

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
              <Image
                src={event.image}
                alt={event.title}
                fill
                className="object-cover"
                sizes="64px"
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
          <LivePrices
            yesTokenId={yesTokenId}
            noTokenId={noTokenId}
            initialYesPrice={yesPrice}
            initialNoPrice={noPrice}
          />
          <div className="ml-auto text-sm text-muted">
            Vol. {formatVolume(event.volume || market?.volume_num || parseFloat(market?.volume ?? "0") || 0)}
          </div>
        </div>
      </div>

    </MarketTradingSection>
  );
}
