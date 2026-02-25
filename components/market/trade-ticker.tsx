"use client";

import { useEffect, useState } from "react";
import { cn } from "@/lib/utils";
import { timeAgo } from "@/lib/utils";

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
}: {
  conditionId: string | undefined;
}) {
  const [trades, setTrades] = useState<TradeActivity[]>([]);

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
    const interval = setInterval(fetchActivity, 15000);
    return () => clearInterval(interval);
  }, [conditionId]);

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
