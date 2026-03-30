"use client";

import { useState } from "react";
import { OrderBookView } from "@/components/market/order-book";
import { PriceChart } from "@/components/market/price-chart";
import { TradePanel } from "@/components/market/trade-panel";
import { TradeTicker } from "@/components/market/trade-ticker";

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
}: {
  children: React.ReactNode;
  yesTokenId: string | undefined;
  noTokenId: string | undefined;
  initialYesPrice: number;
  initialNoPrice: number;
  tickSize: number;
  minOrderSize: number;
  conditionId?: string;
  tokenIds?: string[];
}) {
  const [outcome, setOutcome] = useState<"yes" | "no">("yes");

  const orderbookTokenId = outcome === "yes" ? yesTokenId : noTokenId;

  return (
    <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
      {/* Left column: all scrollable content */}
      <div className="space-y-6 lg:col-span-2">
        {children}

        {/* Order Book */}
        <div className="rounded-2xl border border-card-border bg-card p-6">
          <h2 className="mb-2 text-sm font-semibold text-muted">
            Order Book
            <span className="ml-2 text-xs font-normal text-foreground/60">
              {outcome === "yes" ? "Yes" : "No"}
            </span>
          </h2>
          <OrderBookView tokenId={orderbookTokenId} />
        </div>

        {/* Price Chart */}
        <div className="rounded-2xl border border-card-border bg-card p-6">
          <h2 className="mb-4 text-sm font-semibold text-muted">
            Price History
          </h2>
          <PriceChart tokenId={yesTokenId} />
        </div>

        {/* Recent Activity */}
        <div className="rounded-2xl border border-card-border bg-card p-6">
          <h2 className="mb-4 text-sm font-semibold text-muted">
            Recent Activity
          </h2>
          <TradeTicker conditionId={conditionId} tokenIds={tokenIds} />
        </div>
      </div>

      {/* Right column: sticky trade panel */}
      <div className="lg:sticky lg:top-36 lg:self-start">
        <TradePanel
          yesTokenId={yesTokenId}
          noTokenId={noTokenId}
          initialYesPrice={initialYesPrice}
          initialNoPrice={initialNoPrice}
          tickSize={tickSize}
          minOrderSize={minOrderSize}
          onOutcomeChange={setOutcome}
        />
      </div>
    </div>
  );
}
