"use client";

import { useState, useMemo, useEffect, useCallback, useRef } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { cn } from "@/lib/utils";
import {
  useOpenOrders,
  useCancelOrder,
  type OpenOrder,
} from "@/lib/hooks/use-open-orders";
import { useMarketWS } from "@/components/providers/market-ws-provider";
import { useMagic } from "@/components/providers/magic-provider";
import type { MarketEventCallback } from "@/lib/ws/market-ws";

function formatPrice(price: string): string {
  const n = Number(price);
  if (Number.isNaN(n)) return price;
  return `${Math.round(n * 100)}¢`;
}

function formatFilled(sizeMatched: string, originalSize: string): string {
  const matched = Number(sizeMatched);
  const original = Number(originalSize);
  if (Number.isNaN(matched) || Number.isNaN(original)) return "-";
  return `${parseFloat(sizeMatched)} / ${parseFloat(originalSize)}`;
}

function formatTotal(originalSize: string, price: string): string {
  const size = Number(originalSize);
  const p = Number(price);
  if (Number.isNaN(size) || Number.isNaN(p)) return "-";
  return `$${(size * p).toFixed(2)}`;
}

export function MarketOpenOrders({
  yesTokenId,
  noTokenId,
}: {
  yesTokenId: string | undefined;
  noTokenId: string | undefined;
}) {
  const { walletAddress } = useMagic();
  const { data: allOrders, isPending } = useOpenOrders();
  const cancelMutation = useCancelOrder();
  const [cancellingIds, setCancellingIds] = useState<Set<string>>(new Set());
  const queryClient = useQueryClient();
  const ws = useMarketWS();
  const refetchDebounce = useRef<ReturnType<typeof setTimeout> | null>(null);

  const tokenIds = useMemo(() => {
    const ids = new Set<string>();
    if (yesTokenId) ids.add(yesTokenId);
    if (noTokenId) ids.add(noTokenId);
    return ids;
  }, [yesTokenId, noTokenId]);

  const orders = useMemo(() => {
    if (!allOrders) return [];
    return allOrders.filter((o) => tokenIds.has(o.asset_id));
  }, [allOrders, tokenIds]);

  const handleBook: MarketEventCallback = useCallback(() => {
    if (refetchDebounce.current) return;
    refetchDebounce.current = setTimeout(() => {
      refetchDebounce.current = null;
    }, 2000);
    queryClient.invalidateQueries({ queryKey: ["open-orders"] });
  }, [queryClient]);

  useEffect(() => {
    if (!yesTokenId && !noTokenId) return;
    ws.on("book", handleBook);
    return () => {
      ws.off("book", handleBook);
      if (refetchDebounce.current) {
        clearTimeout(refetchDebounce.current);
        refetchDebounce.current = null;
      }
    };
  }, [yesTokenId, noTokenId, ws, handleBook]);

  const handleCancel = async (order: OpenOrder) => {
    setCancellingIds((prev) => new Set(prev).add(order.id));
    try {
      await cancelMutation.mutateAsync({
        orderHash: order.id,
        marketId: order.market,
      });
    } finally {
      setCancellingIds((prev) => {
        const next = new Set(prev);
        next.delete(order.id);
        return next;
      });
    }
  };

  if (!walletAddress) return null;

  if (isPending) {
    return (
      <div className="rounded-2xl border border-card-border bg-card p-4">
        <h2 className="mb-3 text-sm font-semibold text-muted">My Orders</h2>
        <div className="flex items-center justify-center py-6">
          <div className="h-4 w-4 animate-spin rounded-full border-2 border-muted border-t-foreground" />
        </div>
      </div>
    );
  }

  if (orders.length === 0) {
    return (
      <div className="rounded-2xl border border-card-border bg-card p-4">
        <h2 className="mb-1 text-sm font-semibold text-muted">My Orders</h2>
        <p className="text-xs text-muted/60">
          No open orders on this market
        </p>
      </div>
    );
  }

  return (
    <div className="rounded-2xl border border-card-border bg-card p-4">
      <h2 className="mb-3 text-sm font-semibold text-muted">
        My Orders{" "}
        <span className="ml-1 text-xs font-normal text-muted/60">
          ({orders.length})
        </span>
      </h2>
      <div className="overflow-x-auto">
        <table className="w-full">
          <thead>
            <tr className="border-b border-card-border/50">
              <th className="pb-2 text-left text-[11px] font-semibold uppercase tracking-wider text-muted">
                Side
              </th>
              <th className="pb-2 text-left text-[11px] font-semibold uppercase tracking-wider text-muted">
                Outcome
              </th>
              <th className="pb-2 text-left text-[11px] font-semibold uppercase tracking-wider text-muted">
                Price
              </th>
              <th className="pb-2 text-left text-[11px] font-semibold uppercase tracking-wider text-muted">
                Filled
              </th>
              <th className="pb-2 text-left text-[11px] font-semibold uppercase tracking-wider text-muted">
                Total
              </th>
              <th className="pb-2" />
            </tr>
          </thead>
          <tbody>
            {orders.map((order) => (
              <tr
                key={order.id}
                className="border-b border-card-border/30 last:border-0"
              >
                <td className="py-2 pr-3 text-sm text-foreground">
                  <span
                    className={cn(
                      "font-medium",
                      order.side === "BUY" ? "text-green" : "text-red",
                    )}
                  >
                    {order.side === "BUY" ? "Buy" : "Sell"}
                  </span>
                </td>
                <td className="py-2 pr-3">
                  <span
                    className={cn(
                      "inline-flex items-center rounded px-1.5 py-0.5 text-xs font-semibold",
                      order.outcome.toLowerCase() === "yes"
                        ? "bg-green-dim text-green"
                        : "bg-red-dim text-red",
                    )}
                  >
                    {order.outcome}
                  </span>
                </td>
                <td className="py-2 pr-3 text-sm text-foreground">
                  {formatPrice(order.price)}
                </td>
                <td className="py-2 pr-3 text-sm text-foreground">
                  {formatFilled(order.size_matched, order.original_size)}
                </td>
                <td className="py-2 pr-3 text-sm text-foreground">
                  {formatTotal(order.original_size, order.price)}
                </td>
                <td className="py-2 text-right">
                  <button
                    onClick={() => handleCancel(order)}
                    disabled={cancellingIds.has(order.id)}
                    className={cn(
                      "rounded-lg border border-red/30 px-2.5 py-1 text-xs font-medium text-red hover:bg-red/10 transition-colors",
                      cancellingIds.has(order.id) &&
                        "opacity-50 cursor-not-allowed",
                    )}
                  >
                    {cancellingIds.has(order.id) ? "..." : "Cancel"}
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
