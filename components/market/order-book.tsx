"use client";

import { useMemo } from "react";
import { useOrderBook } from "@/lib/hooks/use-orderbook";

export function OrderBookView({ tokenId }: { tokenId: string | undefined }) {
  const { data: book, isLoading } = useOrderBook(tokenId);

  // Parse and compute cumulative totals
  const { asks, bids, spread, lastPrice, volume } = useMemo(() => {
    const rawBids = (book?.bids ?? []).slice(0, 8);
    const rawAsks = (book?.asks ?? []).slice(0, 8);

    // Bids: sorted high→low (API usually returns this way)
    const parsedBids = rawBids
      .map((b) => ({
        price: parseFloat(b.price),
        size: parseFloat(b.size),
      }))
      .sort((a, b) => b.price - a.price);

    // Asks: sorted low→high, then reversed so highest ask is on top
    const parsedAsks = rawAsks
      .map((a) => ({
        price: parseFloat(a.price),
        size: parseFloat(a.size),
      }))
      .sort((a, b) => a.price - b.price);

    // Cumulative totals: for asks cumulate from bottom (lowest ask) up,
    // for bids cumulate from top (highest bid) down
    let askCumulative = 0;
    const asksWithTotal = parsedAsks.map((a) => {
      askCumulative += a.price * a.size;
      return { ...a, total: askCumulative };
    });
    // Reverse so highest ask appears at top
    asksWithTotal.reverse();

    let bidCumulative = 0;
    const bidsWithTotal = parsedBids.map((b) => {
      bidCumulative += b.price * b.size;
      return { ...b, total: bidCumulative };
    });

    // Spread = lowest ask - highest bid
    const bestBid = parsedBids[0]?.price ?? 0;
    const bestAsk = parsedAsks[0]?.price ?? 0;
    const spread = bestAsk > 0 && bestBid > 0 ? bestAsk - bestBid : 0;

    // Volume = sum of all order sizes * prices
    const vol = askCumulative + bidCumulative;

    return {
      asks: asksWithTotal,
      bids: bidsWithTotal,
      spread,
      lastPrice: bestBid, // last traded ≈ best bid
      volume: vol,
    };
  }, [book]);

  const maxAskTotal = asks.length > 0 ? Math.max(...asks.map((a) => a.total)) : 1;
  const maxBidTotal = bids.length > 0 ? Math.max(...bids.map((b) => b.total)) : 1;

  if (!tokenId) {
    return <p className="text-sm text-muted">No order book data available</p>;
  }

  if (isLoading) {
    return (
      <div className="flex h-48 items-center justify-center">
        <div className="h-5 w-5 animate-spin rounded-full border-2 border-brand border-t-transparent" />
      </div>
    );
  }

  const formatVolume = (v: number) => {
    if (v >= 1_000_000) return `$${(v / 1_000_000).toFixed(1)}M`;
    if (v >= 1_000) return `$${(v / 1_000).toFixed(1)}K`;
    return `$${v.toFixed(2)}`;
  };

  return (
    <div>
      {/* Header with volume */}
      <div className="mb-3 flex items-center justify-between">
        <span className="text-xs font-medium text-muted">
          {formatVolume(volume)} Vol.
        </span>
      </div>

      {/* Column headers */}
      <div className="mb-1 grid grid-cols-[1fr_auto_auto_auto] gap-x-4 px-2 text-[11px] font-medium uppercase tracking-wider text-muted">
        <span></span>
        <span className="w-16 text-center">Price</span>
        <span className="w-20 text-right">Shares</span>
        <span className="w-20 text-right">Total</span>
      </div>

      {/* Asks (highest at top, lowest near spread) */}
      <div className="space-y-0">
        {asks.length === 0 ? (
          <p className="py-4 text-center text-xs text-muted">No asks</p>
        ) : (
          asks.map((ask, i) => {
            const depthPct = (ask.total / maxAskTotal) * 100;
            return (
              <div
                key={i}
                className="relative grid grid-cols-[1fr_auto_auto_auto] items-center gap-x-4 px-2 py-[3px]"
              >
                {/* Depth bar from left */}
                <div className="relative h-5">
                  <div
                    className="absolute inset-y-0 left-0 rounded-sm bg-red-dim"
                    style={{ width: `${depthPct}%` }}
                  />
                  {i === asks.length - 1 && (
                    <span className="relative flex h-full items-center text-[10px] font-medium text-red">
                      Asks
                    </span>
                  )}
                </div>
                <span className="w-16 text-center text-xs font-medium text-red">
                  {(ask.price * 100).toFixed(0)}¢
                </span>
                <span className="w-20 text-right text-xs text-foreground/70">
                  {ask.size.toFixed(2)}
                </span>
                <span className="w-20 text-right text-xs text-foreground/70">
                  ${ask.total.toFixed(2)}
                </span>
              </div>
            );
          })
        )}
      </div>

      {/* Spread / Last price separator */}
      <div className="my-1 flex items-center justify-between border-y border-card-border px-2 py-1.5 text-xs text-muted">
        <span>
          Last: <span className="text-foreground">{(lastPrice * 100).toFixed(0)}¢</span>
        </span>
        <span>
          Spread: <span className="text-foreground">{(spread * 100).toFixed(0)}¢</span>
        </span>
      </div>

      {/* Bids (highest at top, lowest at bottom) */}
      <div className="space-y-0">
        {bids.length === 0 ? (
          <p className="py-4 text-center text-xs text-muted">No bids</p>
        ) : (
          bids.map((bid, i) => {
            const depthPct = (bid.total / maxBidTotal) * 100;
            return (
              <div
                key={i}
                className="relative grid grid-cols-[1fr_auto_auto_auto] items-center gap-x-4 px-2 py-[3px]"
              >
                {/* Depth bar from left */}
                <div className="relative h-5">
                  <div
                    className="absolute inset-y-0 left-0 rounded-sm bg-green-dim"
                    style={{ width: `${depthPct}%` }}
                  />
                  {i === 0 && (
                    <span className="relative flex h-full items-center text-[10px] font-medium text-green">
                      Bids
                    </span>
                  )}
                </div>
                <span className="w-16 text-center text-xs font-medium text-green">
                  {(bid.price * 100).toFixed(0)}¢
                </span>
                <span className="w-20 text-right text-xs text-foreground/70">
                  {bid.size.toFixed(2)}
                </span>
                <span className="w-20 text-right text-xs text-foreground/70">
                  ${bid.total.toFixed(2)}
                </span>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
