"use client";

import { useState } from "react";
import { OrderBookView } from "@/components/market/order-book";
import { MarketOpenOrders } from "@/components/market/market-open-orders";
import { PriceChart } from "@/components/market/price-chart";
import { MarketSidePanel } from "@/components/market/market-side-panel";
import { TradeTicker } from "@/components/market/trade-ticker";
import type { GammaEvent, GammaMarket } from "@/lib/types/event";

/**
 * Client component that renders the orderbook, recent activity, and trade panel
 * with shared outcome state. Accepts children (event header, chart) so all left
 * content lives in a single scrollable column while the trade panel stays sticky.
 */
export function MarketTradingSection({
  children,
  yesTokenId,
  noTokenId,
  initialYesPrice,
  initialNoPrice,
  tickSize,
  minOrderSize,
  conditionId,
  tokenIds,
  outcomeLabels = ["Yes", "No"],
  selectedMarket,
  resolutionEvent,
  hidePriceChart = false,
}: {
  children: React.ReactNode;
  yesTokenId: string | undefined;
  noTokenId: string | undefined;
  initialYesPrice: number;
  initialNoPrice: number;
  outcomeLabels?: [string, string];
  selectedMarket?: GammaMarket;
  /** Event context for crypto slot end → pending resolution. */
  resolutionEvent?: GammaEvent;
  tickSize: number;
  minOrderSize: number;
  conditionId?: string;
  tokenIds?: string[];
  hidePriceChart?: boolean;
}) {
  const [outcome, setOutcome] = useState<"yes" | "no">("yes");

  const orderbookTokenId = outcome === "yes" ? yesTokenId : noTokenId;

  return (
    <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
      {/* Left column: all scrollable content */}
      <div className="space-y-6 lg:col-span-2">
        {children}

        {/* Order Book */}
        <div className="rounded-2xl border border-card-border bg-card p-4">
          <OrderBookView tokenId={orderbookTokenId} />
        </div>

        {/* My Open Orders */}
        <MarketOpenOrders
          yesTokenId={yesTokenId}
          noTokenId={noTokenId}
        />

        {!hidePriceChart && (
          <div className="rounded-2xl border border-card-border bg-card p-6">
            <h2 className="mb-4 text-sm font-semibold text-muted">
              Price History
            </h2>
            <PriceChart tokenId={yesTokenId} />
          </div>
        )}

        {/* Recent Activity */}
        <div className="rounded-2xl border border-card-border bg-card p-6">
          <h2 className="mb-4 text-sm font-semibold text-muted">
            Recent Activity
          </h2>
          <TradeTicker conditionId={conditionId} tokenIds={tokenIds} />
        </div>
      </div>

      {/* Right column: trade or resolution (UMA / WS) */}
      <div className="lg:sticky lg:top-36 lg:self-start">
        <MarketSidePanel
          market={selectedMarket}
          event={resolutionEvent}
          yesTokenId={yesTokenId}
          noTokenId={noTokenId}
          initialYesPrice={initialYesPrice}
          initialNoPrice={initialNoPrice}
          outcomeLabels={outcomeLabels}
          tickSize={tickSize}
          minOrderSize={minOrderSize}
          onOutcomeChange={setOutcome}
        />
      </div>
    </div>
  );
}
