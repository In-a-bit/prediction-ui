"use client";

import { cn } from "@/lib/utils";
import { timeAgo } from "@/lib/utils";

interface Trade {
  id: string;
  conditionId: string;
  outcome: string;
  side: string;
  price: number;
  shares: number;
  total: number;
  createdAt: string;
}

export function TradeHistory({ trades }: { trades: Trade[] }) {
  if (trades.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center rounded-2xl border border-card-border bg-card px-8 py-12">
        <p className="text-sm text-muted">No trades yet</p>
      </div>
    );
  }

  return (
    <div className="overflow-hidden rounded-2xl border border-card-border bg-card">
      <table className="w-full">
        <thead>
          <tr className="border-b border-card-border">
            <th className="px-4 py-3 text-left text-[11px] font-semibold uppercase tracking-wider text-muted">
              Side
            </th>
            <th className="px-4 py-3 text-left text-[11px] font-semibold uppercase tracking-wider text-muted">
              Outcome
            </th>
            <th className="px-4 py-3 text-right text-[11px] font-semibold uppercase tracking-wider text-muted">
              Price
            </th>
            <th className="px-4 py-3 text-right text-[11px] font-semibold uppercase tracking-wider text-muted">
              Shares
            </th>
            <th className="px-4 py-3 text-right text-[11px] font-semibold uppercase tracking-wider text-muted">
              Total
            </th>
            <th className="px-4 py-3 text-right text-[11px] font-semibold uppercase tracking-wider text-muted">
              Time
            </th>
          </tr>
        </thead>
        <tbody>
          {trades.map((trade) => {
            const isBuy = trade.side === "BUY";
            return (
              <tr
                key={trade.id}
                className="border-b border-card-border/50 transition-colors hover:bg-card-hover"
              >
                <td className="px-4 py-3">
                  <span
                    className={cn(
                      "inline-flex items-center rounded px-2 py-0.5 text-[10px] font-bold uppercase",
                      isBuy
                        ? "bg-green-dim text-green"
                        : "bg-red-dim text-red"
                    )}
                  >
                    {trade.side}
                  </span>
                </td>
                <td className="px-4 py-3 text-sm text-foreground">
                  {trade.outcome}
                </td>
                <td className="px-4 py-3 text-right text-sm text-muted">
                  {(trade.price * 100).toFixed(1)}¢
                </td>
                <td className="px-4 py-3 text-right text-sm text-foreground">
                  {trade.shares.toFixed(2)}
                </td>
                <td className="px-4 py-3 text-right text-sm font-medium text-foreground">
                  ${trade.total.toFixed(2)}
                </td>
                <td className="px-4 py-3 text-right text-xs text-muted">
                  {timeAgo(trade.createdAt)}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
