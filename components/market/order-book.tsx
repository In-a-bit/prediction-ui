"use client";

import { useOrderBook } from "@/lib/hooks/use-orderbook";

export function OrderBookView({ tokenId }: { tokenId: string | undefined }) {
  const { data: book, isLoading } = useOrderBook(tokenId);

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

  const bids = (book?.bids ?? []).slice(0, 8);
  const asks = (book?.asks ?? []).slice(0, 8);

  const maxBidSize = Math.max(
    ...bids.map((b) => parseFloat(b.size)),
    0.01
  );
  const maxAskSize = Math.max(
    ...asks.map((a) => parseFloat(a.size)),
    0.01
  );

  return (
    <div className="grid grid-cols-2 gap-4">
      {/* Bids */}
      <div>
        <div className="mb-2 flex items-center justify-between text-[11px] font-medium uppercase tracking-wider text-muted">
          <span>Price</span>
          <span>Size</span>
        </div>
        <div className="space-y-0.5">
          {bids.length === 0 ? (
            <p className="py-4 text-center text-xs text-muted">No bids</p>
          ) : (
            bids.map((bid, i) => {
              const price = parseFloat(bid.price);
              const size = parseFloat(bid.size);
              const pct = (size / maxBidSize) * 100;

              return (
                <div key={i} className="relative flex items-center justify-between rounded px-2 py-1">
                  <div
                    className="absolute inset-y-0 left-0 rounded bg-green-dim"
                    style={{ width: `${pct}%` }}
                  />
                  <span className="relative text-xs font-medium text-green">
                    {(price * 100).toFixed(1)}¢
                  </span>
                  <span className="relative text-xs text-muted">
                    {size.toFixed(1)}
                  </span>
                </div>
              );
            })
          )}
        </div>
      </div>

      {/* Asks */}
      <div>
        <div className="mb-2 flex items-center justify-between text-[11px] font-medium uppercase tracking-wider text-muted">
          <span>Price</span>
          <span>Size</span>
        </div>
        <div className="space-y-0.5">
          {asks.length === 0 ? (
            <p className="py-4 text-center text-xs text-muted">No asks</p>
          ) : (
            asks.map((ask, i) => {
              const price = parseFloat(ask.price);
              const size = parseFloat(ask.size);
              const pct = (size / maxAskSize) * 100;

              return (
                <div key={i} className="relative flex items-center justify-between rounded px-2 py-1">
                  <div
                    className="absolute inset-y-0 right-0 rounded bg-red-dim"
                    style={{ width: `${pct}%` }}
                  />
                  <span className="relative text-xs font-medium text-red">
                    {(price * 100).toFixed(1)}¢
                  </span>
                  <span className="relative text-xs text-muted">
                    {size.toFixed(1)}
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
