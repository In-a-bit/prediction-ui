import { fetchEventBySlug } from "@/lib/api/gamma";
import { PriceChart } from "@/components/market/price-chart";
import { OrderBookView } from "@/components/market/order-book";
import { TradePanel } from "@/components/market/trade-panel";
import { TradeTicker } from "@/components/market/trade-ticker";
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
    title: event ? `${event.title} | Polymarket` : "Market | Polymarket",
  };
}

export default async function EventPage({ params }: EventPageProps) {
  const { slug } = await params;
  const event = await fetchEventBySlug(slug);

  if (!event) notFound();

  // Find the first active, non-closed, non-resolved sub-market
  const market = event.markets.find((m) => {
    if (m.closed || !m.active) return false;
    if (m.outcomePrices) {
      try {
        const prices = JSON.parse(m.outcomePrices) as string[];
        // Skip fully resolved markets (any price >= 0.99 or <= 0.01)
        if (prices.some((p) => parseFloat(p) >= 0.99 || parseFloat(p) <= 0.01)) {
          return false;
        }
      } catch {}
    }
    return true;
  }) ?? event.markets[0]; // fallback to first if all resolved

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
    <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
      {/* Left column: Event info, chart, order book */}
      <div className="space-y-6 lg:col-span-2">
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
            <div className="flex items-center gap-2">
              <span className="text-2xl font-bold text-green">{yesPrice}¢</span>
              <span className="text-sm text-muted">Yes</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-2xl font-bold text-red">{noPrice}¢</span>
              <span className="text-sm text-muted">No</span>
            </div>
            <div className="ml-auto text-sm text-muted">
              Vol. ${((event.volume || 0) / 1e6).toFixed(1)}M
            </div>
          </div>
        </div>

        {/* Price Chart */}
        <div className="rounded-2xl border border-card-border bg-card p-6">
          <h2 className="mb-4 text-sm font-semibold text-muted">
            Price History
          </h2>
          <PriceChart tokenId={yesTokenId} />
        </div>

        {/* Order Book */}
        <div className="rounded-2xl border border-card-border bg-card p-6">
          <h2 className="mb-4 text-sm font-semibold text-muted">Order Book</h2>
          <OrderBookView tokenId={yesTokenId} />
        </div>

        {/* Recent Activity */}
        <div className="rounded-2xl border border-card-border bg-card p-6">
          <h2 className="mb-4 text-sm font-semibold text-muted">
            Recent Activity
          </h2>
          <TradeTicker conditionId={market?.conditionId} />
        </div>
      </div>

      {/* Right column: Trade panel */}
      <div className="lg:sticky lg:top-4 lg:self-start">
        <TradePanel
          yesTokenId={yesTokenId}
          noTokenId={noTokenId}
          initialYesPrice={yesPrice}
          initialNoPrice={noPrice}
        />
      </div>
    </div>
  );
}
