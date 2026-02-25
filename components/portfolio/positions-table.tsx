"use client";

import { cn } from "@/lib/utils";

interface Position {
  id: string;
  conditionId: string;
  tokenId: string;
  outcome: string;
  shares: number;
  avgPrice: number;
}

export function PositionsTable({ positions }: { positions: Position[] }) {
  if (positions.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center rounded-2xl border border-card-border bg-card px-8 py-16">
        <svg
          className="mb-3 h-10 w-10 text-muted/30"
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
          strokeWidth={1.5}
        >
          <path d="M3 3h2l.4 2M7 13h10l4-8H5.4M7 13L5.4 5M7 13l-2.293 2.293c-.63.63-.184 1.707.707 1.707H17m0 0a2 2 0 100 4 2 2 0 000-4zm-8 2a2 2 0 100 4 2 2 0 000-4z" />
        </svg>
        <p className="text-sm font-medium text-muted">No positions yet</p>
        <p className="mt-1 text-xs text-muted/60">
          Start trading to build your portfolio
        </p>
      </div>
    );
  }

  return (
    <div className="overflow-hidden rounded-2xl border border-card-border bg-card">
      <table className="w-full">
        <thead>
          <tr className="border-b border-card-border">
            <th className="px-4 py-3 text-left text-[11px] font-semibold uppercase tracking-wider text-muted">
              Market
            </th>
            <th className="px-4 py-3 text-left text-[11px] font-semibold uppercase tracking-wider text-muted">
              Outcome
            </th>
            <th className="px-4 py-3 text-right text-[11px] font-semibold uppercase tracking-wider text-muted">
              Shares
            </th>
            <th className="px-4 py-3 text-right text-[11px] font-semibold uppercase tracking-wider text-muted">
              Avg Price
            </th>
            <th className="px-4 py-3 text-right text-[11px] font-semibold uppercase tracking-wider text-muted">
              Value
            </th>
          </tr>
        </thead>
        <tbody>
          {positions.map((pos) => {
            const isYes = pos.outcome.toLowerCase() === "yes";
            const value = pos.shares * pos.avgPrice;
            return (
              <tr
                key={pos.id}
                className="border-b border-card-border/50 transition-colors hover:bg-card-hover"
              >
                <td className="px-4 py-3 text-sm font-medium text-foreground">
                  {pos.conditionId.slice(0, 8)}...
                </td>
                <td className="px-4 py-3">
                  <span
                    className={cn(
                      "inline-flex items-center rounded-lg px-2 py-0.5 text-xs font-semibold",
                      isYes ? "bg-green-dim text-green" : "bg-red-dim text-red"
                    )}
                  >
                    {pos.outcome}
                  </span>
                </td>
                <td className="px-4 py-3 text-right text-sm text-foreground">
                  {pos.shares.toFixed(2)}
                </td>
                <td className="px-4 py-3 text-right text-sm text-muted">
                  {(pos.avgPrice * 100).toFixed(1)}¢
                </td>
                <td className="px-4 py-3 text-right text-sm font-medium text-foreground">
                  ${value.toFixed(2)}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
