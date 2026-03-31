"use client";

import { useEffect, useState, useCallback } from "react";
import { cn } from "@/lib/utils";
import { timeAgo } from "@/lib/utils";
import { useMarketWS } from "@/components/providers/market-ws-provider";
import { normalizeWsPrice, normalizeWsSize } from "@/lib/orderbook-scaled";
import type { MarketEventCallback } from "@/lib/ws/market-ws";

interface TradeActivity {
  id: string;
  side: string;
  outcome: string;
  price: number;
  size: number;
  timestamp: string;
}

export function TradeTicker({
  conditionId,
  tokenIds,
}: {
  conditionId: string | undefined;
  tokenIds?: string[];
}) {
  const [trades, setTrades] = useState<TradeActivity[]>([]);
  const ws = useMarketWS();

  // REST fallback polling at 60s
  useEffect(() => {
    if (!conditionId) return;

    async function fetchActivity() {
      try {
        const res = await fetch(
          `/api/trades?conditionId=${conditionId}&limit=15`
        );
        if (!res.ok) return;
        const data = await res.json();
        if (Array.isArray(data)) {
          setTrades(data);
        }
      } catch {
        // Silently fail — activity feed is non-critical
      }
    }

    fetchActivity();
    const interval = setInterval(fetchActivity, 60_000);
    return () => clearInterval(interval);
  }, [conditionId]);

  // WebSocket real-time trade events
  const handleTrade: MarketEventCallback = useCallback(
    (data) => {
      if (!tokenIds?.includes(data.asset_id as string)) return;
      // WS timestamps are epoch milliseconds as strings
      const rawTs = data.timestamp as string | undefined;
      const tsMs = rawTs ? parseInt(rawTs, 10) : NaN;
      const timestamp = !isNaN(tsMs)
        ? new Date(tsMs).toISOString()
        : new Date().toISOString();

      const trade: TradeActivity = {
        id: `ws-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
        side: (data.side as string) ?? "BUY",
        outcome: data.asset_id === tokenIds[0] ? "Yes" : "No",
        price: normalizeWsPrice(data.price as string) || 0,
        size: normalizeWsSize(data.size as string) || 0,
        timestamp,
      };
      setTrades((prev) => [trade, ...prev].slice(0, 20));
    },
    [tokenIds]
  );

  useEffect(() => {
    if (!tokenIds || tokenIds.length === 0) return;

    for (const id of tokenIds) {
      ws.subscribe(id);
    }
    ws.on("last_trade_price", handleTrade);

    return () => {
      ws.off("last_trade_price", handleTrade);
      for (const id of tokenIds) {
        ws.unsubscribe(id);
      }
    };
  }, [tokenIds, ws, handleTrade]);

  if (!conditionId) {
    return <p className="text-sm text-muted">No activity data</p>;
  }

  if (trades.length === 0) {
    return (
      <p className="py-4 text-center text-sm text-muted">
        No trades yet
      </p>
    );
  }

  return (
    <div className="space-y-1">
      {trades.map((trade) => {
        const isBuy = trade.side === "BUY";
        return (
          <div
            key={trade.id}
            className="flex items-center justify-between rounded-lg px-2 py-1.5 transition-colors hover:bg-input"
          >
            <div className="flex items-center gap-2">
              <span
                className={cn(
                  "inline-flex h-5 w-11 items-center justify-center rounded text-[10px] font-bold uppercase",
                  isBuy
                    ? "bg-green-dim text-green"
                    : "bg-red-dim text-red"
                )}
              >
                {trade.side}
              </span>
              <span className="text-xs text-foreground">{trade.outcome}</span>
            </div>
            <div className="flex items-center gap-3">
              <span className="text-xs font-medium text-foreground">
                {(trade.price * 100).toFixed(1)}¢
              </span>
              <span className="text-xs text-muted">
                {trade.size.toFixed(1)} shares
              </span>
              <span className="text-[11px] text-muted/60">
                {timeAgo(trade.timestamp)}
              </span>
            </div>
          </div>
        );
      })}
    </div>
  );
}
