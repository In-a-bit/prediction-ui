"use client";

import { useMemo, useRef, useLayoutEffect } from "react";
import { useOrderBook } from "@/lib/hooks/use-orderbook";

const ROW_HEIGHT = 26; // px per level row
const VISIBLE_ROWS = 8;
const SECTION_HEIGHT = ROW_HEIGHT * VISIBLE_ROWS; // each half gets equal space

export function OrderBookView({ tokenId }: { tokenId: string | undefined }) {
  const { data: book, isLoading } = useOrderBook(tokenId);
  const asksRef = useRef<HTMLDivElement>(null);
  const prevAsksLen = useRef(0);

  const { asks, bids, spread, midPrice, bestAsk, bestBid, volume } =
    useMemo(() => {
      const rawBids = book?.bids ?? [];
      const rawAsks = book?.asks ?? [];

      // Bids: highest (best) first
      const parsedBids = rawBids
        .map((b) => ({
          price: parseFloat(b.price),
          size: parseFloat(b.size),
        }))
        .sort((a, b) => b.price - a.price);

      // Asks: lowest (best) first
      const parsedAsks = rawAsks
        .map((a) => ({
          price: parseFloat(a.price),
          size: parseFloat(a.size),
        }))
        .sort((a, b) => a.price - b.price);

      // Cumulative from best outward — size in shares, total in dollars
      let askCumShares = 0;
      let askCumDollars = 0;
      const asksWithTotal = parsedAsks.map((a) => {
        askCumShares += a.size;
        askCumDollars += a.size * a.price;
        return { ...a, cumShares: askCumShares, cumDollars: askCumDollars };
      });

      let bidCumShares = 0;
      let bidCumDollars = 0;
      const bidsWithTotal = parsedBids.map((b) => {
        bidCumShares += b.size;
        bidCumDollars += b.size * b.price;
        return { ...b, cumShares: bidCumShares, cumDollars: bidCumDollars };
      });

      const bestBid = parsedBids[0]?.price ?? 0;
      const bestAsk = parsedAsks[0]?.price ?? 0;
      const spread = bestAsk > 0 && bestBid > 0 ? bestAsk - bestBid : 0;
      const midPrice =
        bestAsk > 0 && bestBid > 0 ? (bestAsk + bestBid) / 2 : bestBid || bestAsk;
      const vol = askCumShares + bidCumShares;

      return {
        // Reversed so worst ask is at top, best ask at bottom (near spread)
        asks: asksWithTotal.reverse(),
        bids: bidsWithTotal,
        spread,
        midPrice,
        bestAsk,
        bestBid,
        volume: vol,
      };
    }, [book]);

  // Scroll asks container to bottom (best ask) on mount and when data changes
  useLayoutEffect(() => {
    const el = asksRef.current;
    if (!el) return;
    // If new rows were added, keep the view pinned to the bottom (best ask)
    if (asks.length !== prevAsksLen.current) {
      el.scrollTop = el.scrollHeight;
      prevAsksLen.current = asks.length;
    }
  }, [asks.length]);

  // Also pin asks to bottom on first paint
  useLayoutEffect(() => {
    const el = asksRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [tokenId]);

  const maxDepth = Math.max(
    ...asks.map((a) => a.cumShares),
    ...bids.map((b) => b.cumShares),
    1
  );

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

  const fmt = (v: number) => {
    if (v >= 1_000_000) return `${(v / 1_000_000).toFixed(1)}M`;
    if (v >= 1_000) return `${(v / 1_000).toFixed(1)}K`;
    return v.toFixed(1);
  };

  return (
    <div className="flex flex-col">
      {/* Header */}
      <div className="mb-2 flex items-center justify-between">
        <span className="text-[11px] font-medium uppercase tracking-wider text-muted">
          Order Book
        </span>
        <span className="text-[11px] text-muted">
          {fmt(volume)} shares
        </span>
      </div>

      {/* Column labels */}
      <div className="mb-0.5 grid grid-cols-[1fr_auto_auto_auto] gap-x-3 px-2 text-[10px] font-medium uppercase tracking-wider text-muted/60">
        <span></span>
        <span className="w-14 text-right">Price</span>
        <span className="w-14 text-right">Size</span>
        <span className="w-16 text-right">Total</span>
      </div>

      {/* ── ASKS — scrolls up to reveal worse asks, best ask pinned at bottom ── */}
      <div className="relative">
        {/* Fade overlay when more asks are above */}
        {asks.length > VISIBLE_ROWS && (
          <div className="pointer-events-none absolute inset-x-0 top-0 z-10 h-6 bg-gradient-to-b from-card to-transparent" />
        )}
        <div
          ref={asksRef}
          className="overflow-y-auto scrollbar-thin scrollbar-track-transparent scrollbar-thumb-card-border"
          style={{ maxHeight: SECTION_HEIGHT }}
        >
          {asks.length === 0 ? (
            <div className="flex items-center justify-center py-6 text-xs text-muted/50">
              No asks
            </div>
          ) : (
            asks.map((ask, i) => {
              const depthPct = (ask.cumShares / maxDepth) * 100;
              const isBest = i === asks.length - 1;
              return (
                <div
                  key={ask.price}
                  className={`relative grid grid-cols-[1fr_auto_auto_auto] items-center gap-x-3 px-2 ${
                    isBest ? "bg-red/[0.06]" : ""
                  }`}
                  style={{ height: ROW_HEIGHT }}
                >
                  {/* Depth bar — fills from right */}
                  <div
                    className="absolute inset-y-0 left-0 bg-red/10"
                    style={{ width: `${depthPct}%` }}
                  />
                  <span className="relative" />
                  <span
                    className={`relative w-14 text-right text-xs tabular-nums ${
                      isBest ? "font-semibold text-red" : "font-medium text-red/80"
                    }`}
                  >
                    {(ask.price * 100).toFixed(1)}¢
                  </span>
                  <span className="relative w-14 text-right text-xs tabular-nums text-foreground/60">
                    {ask.size}
                  </span>
                  <span className="relative w-16 text-right text-xs tabular-nums text-foreground/40">
                    ${ask.cumDollars.toFixed(2)}
                  </span>
                </div>
              );
            })
          )}
        </div>
      </div>

      {/* ── SPREAD BAR — always visible, never scrolls ── */}
      <div className="flex items-center justify-center gap-4 border-y border-card-border bg-card px-2 py-1.5">
        <span className="text-[10px] text-green">
          {(bestBid * 100).toFixed(1)}¢
        </span>
        <span className="text-[10px] text-muted">
          Spread{" "}
          <span className="font-semibold text-foreground/70">
            {(spread * 100).toFixed(1)}¢
          </span>
        </span>
        <span className="text-[10px] text-red">
          {(bestAsk * 100).toFixed(1)}¢
        </span>
      </div>

      {/* ── BIDS — best bid at top, scrolls down to reveal worse bids ── */}
      <div className="relative">
        {/* Fade overlay when more bids are below */}
        {bids.length > VISIBLE_ROWS && (
          <div className="pointer-events-none absolute inset-x-0 bottom-0 z-10 h-6 bg-gradient-to-t from-card to-transparent" />
        )}
        <div
          className="overflow-y-auto scrollbar-thin scrollbar-track-transparent scrollbar-thumb-card-border"
          style={{ maxHeight: SECTION_HEIGHT }}
        >
          {bids.length === 0 ? (
            <div className="flex items-center justify-center py-6 text-xs text-muted/50">
              No bids
            </div>
          ) : (
            bids.map((bid, i) => {
              const depthPct = (bid.cumShares / maxDepth) * 100;
              const isBest = i === 0;
              return (
                <div
                  key={bid.price}
                  className={`relative grid grid-cols-[1fr_auto_auto_auto] items-center gap-x-3 px-2 ${
                    isBest ? "bg-green/[0.06]" : ""
                  }`}
                  style={{ height: ROW_HEIGHT }}
                >
                  {/* Depth bar — fills from right */}
                  <div
                    className="absolute inset-y-0 left-0 bg-green/10"
                    style={{ width: `${depthPct}%` }}
                  />
                  <span className="relative" />
                  <span
                    className={`relative w-14 text-right text-xs tabular-nums ${
                      isBest
                        ? "font-semibold text-green"
                        : "font-medium text-green/80"
                    }`}
                  >
                    {(bid.price * 100).toFixed(1)}¢
                  </span>
                  <span className="relative w-14 text-right text-xs tabular-nums text-foreground/60">
                    {bid.size}
                  </span>
                  <span className="relative w-16 text-right text-xs tabular-nums text-foreground/40">
                    ${bid.cumDollars.toFixed(2)}
                  </span>
                </div>
              );
            })
          )}
        </div>
      </div>
    </div>
  );
}
