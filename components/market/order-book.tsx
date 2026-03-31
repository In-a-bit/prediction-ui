"use client";

import { useMemo, useRef, useState, useEffect, useCallback, useLayoutEffect } from "react";
import { useOrderBook } from "@/lib/hooks/use-orderbook";

const INITIAL_LEVELS = 8;
const LOAD_MORE = 8;
const SCROLL_THRESHOLD = 40;

export function OrderBookView({ tokenId }: { tokenId: string | undefined }) {
  const { data: book, isLoading } = useOrderBook(tokenId);
  const scrollRef = useRef<HTMLDivElement>(null);
  const spreadRef = useRef<HTMLDivElement>(null);
  const hasScrolled = useRef(false);
  const prevScrollHeight = useRef(0);

  const [visibleAsks, setVisibleAsks] = useState(INITIAL_LEVELS);
  const [visibleBids, setVisibleBids] = useState(INITIAL_LEVELS);

  // Reset visible window when token changes
  useEffect(() => {
    setVisibleAsks(INITIAL_LEVELS);
    setVisibleBids(INITIAL_LEVELS);
    hasScrolled.current = false;
  }, [tokenId]);

  const { asks, bids, spread, lastPrice, volume } = useMemo(() => {
    const rawBids = book?.bids ?? [];
    const rawAsks = book?.asks ?? [];

    const parsedBids = rawBids
      .map((b) => ({
        price: parseFloat(b.price),
        size: parseFloat(b.size),
      }))
      .sort((a, b) => b.price - a.price);

    const parsedAsks = rawAsks
      .map((a) => ({
        price: parseFloat(a.price),
        size: parseFloat(a.size),
      }))
      .sort((a, b) => a.price - b.price);

    let askCumulative = 0;
    const asksWithTotal = parsedAsks.map((a) => {
      askCumulative += a.price * a.size;
      return { ...a, total: askCumulative };
    });
    asksWithTotal.reverse();

    let bidCumulative = 0;
    const bidsWithTotal = parsedBids.map((b) => {
      bidCumulative += b.price * b.size;
      return { ...b, total: bidCumulative };
    });

    const bestBid = parsedBids[0]?.price ?? 0;
    const bestAsk = parsedAsks[0]?.price ?? 0;
    const spread = bestAsk > 0 && bestBid > 0 ? bestAsk - bestBid : 0;
    const vol = askCumulative + bidCumulative;

    return {
      asks: asksWithTotal,
      bids: bidsWithTotal,
      spread,
      lastPrice: bestBid,
      volume: vol,
    };
  }, [book]);

  // Slice to visible window: asks closest to spread are at the END of the array,
  // bids closest to spread are at the START.
  const displayedAsks = asks.length <= visibleAsks ? asks : asks.slice(asks.length - visibleAsks);
  const displayedBids = bids.length <= visibleBids ? bids : bids.slice(0, visibleBids);

  const maxAskTotal = displayedAsks.length > 0 ? Math.max(...displayedAsks.map((a) => a.total)) : 1;
  const maxBidTotal = displayedBids.length > 0 ? Math.max(...displayedBids.map((b) => b.total)) : 1;

  // Scroll to spread on first data load
  useLayoutEffect(() => {
    if (hasScrolled.current || !spreadRef.current || !scrollRef.current) return;
    if (displayedAsks.length === 0 && displayedBids.length === 0) return;
    const container = scrollRef.current;
    const el = spreadRef.current;
    container.scrollTop = el.offsetTop - container.clientHeight / 2 + el.clientHeight / 2;
    hasScrolled.current = true;
  }, [displayedAsks.length, displayedBids.length]);

  // When asks are prepended (scroll up to load more), preserve scroll position
  useLayoutEffect(() => {
    const el = scrollRef.current;
    if (!el || !prevScrollHeight.current) return;
    const diff = el.scrollHeight - prevScrollHeight.current;
    if (diff > 0) {
      el.scrollTop += diff;
    }
    prevScrollHeight.current = 0;
  }, [visibleAsks]);

  const handleScroll = useCallback(() => {
    const el = scrollRef.current;
    if (!el) return;

    // Near top → reveal more asks
    if (el.scrollTop < SCROLL_THRESHOLD && visibleAsks < asks.length) {
      prevScrollHeight.current = el.scrollHeight;
      setVisibleAsks((prev) => Math.min(prev + LOAD_MORE, asks.length));
    }

    // Near bottom → reveal more bids
    if (
      el.scrollHeight - el.scrollTop - el.clientHeight < SCROLL_THRESHOLD &&
      visibleBids < bids.length
    ) {
      setVisibleBids((prev) => Math.min(prev + LOAD_MORE, bids.length));
    }
  }, [asks.length, bids.length, visibleAsks, visibleBids]);

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

      {/* Scrollable book — starts centered on spread */}
      <div
        ref={scrollRef}
        onScroll={handleScroll}
        className="max-h-[340px] overflow-y-auto scrollbar-thin scrollbar-track-transparent scrollbar-thumb-card-border"
      >
        {/* Asks (less attractive at top, best ask near spread) */}
        <div>
          {displayedAsks.length === 0 ? (
            <p className="py-4 text-center text-xs text-muted">No asks</p>
          ) : (
            displayedAsks.map((ask, i) => {
              const depthPct = (ask.total / maxAskTotal) * 100;
              return (
                <div
                  key={ask.price}
                  className="relative grid grid-cols-[1fr_auto_auto_auto] items-center gap-x-4 px-2 py-[3px]"
                >
                  <div className="relative h-5">
                    <div
                      className="absolute inset-y-0 left-0 rounded-sm bg-red-dim"
                      style={{ width: `${depthPct}%` }}
                    />
                    {i === displayedAsks.length - 1 && (
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
        <div
          ref={spreadRef}
          className="sticky top-0 z-10 my-1 flex items-center justify-between border-y border-card-border bg-card px-2 py-1.5 text-xs text-muted"
        >
          <span>
            Last: <span className="text-foreground">{(lastPrice * 100).toFixed(0)}¢</span>
          </span>
          <span>
            Spread: <span className="text-foreground">{(spread * 100).toFixed(0)}¢</span>
          </span>
        </div>

        {/* Bids (best bid near spread, less attractive at bottom) */}
        <div>
          {displayedBids.length === 0 ? (
            <p className="py-4 text-center text-xs text-muted">No bids</p>
          ) : (
            displayedBids.map((bid, i) => {
              const depthPct = (bid.total / maxBidTotal) * 100;
              return (
                <div
                  key={bid.price}
                  className="relative grid grid-cols-[1fr_auto_auto_auto] items-center gap-x-4 px-2 py-[3px]"
                >
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
    </div>
  );
}
