"use client";

import { useState, useMemo } from "react";
import { cn } from "@/lib/utils";
import { useOpenOrders, useCancelOrder, type OpenOrder } from "@/lib/hooks/use-open-orders";
import { useEventLookup, type EventInfo } from "@/lib/hooks/use-event-lookup";

interface MarketGroup {
  market: string;
  orders: OpenOrder[];
}

function groupByMarket(orders: OpenOrder[]): MarketGroup[] {
  const map = new Map<string, OpenOrder[]>();
  for (const o of orders) {
    const list = map.get(o.market) ?? [];
    list.push(o);
    map.set(o.market, list);
  }
  return Array.from(map.entries()).map(([market, orders]) => ({
    market,
    orders,
  }));
}

function formatExpiration(exp: string, orderType: string): string {
  if (exp === "0" && orderType === "GTC") return "Until Cancelled";
  if (exp === "0") return "Until Cancelled";
  const d = new Date(Number(exp) * 1000);
  return d.toLocaleDateString();
}

function formatPrice(price: string): string {
  const n = Number(price);
  if (Number.isNaN(n)) return price;
  const cents = Math.round(n * 100);
  return `${cents}¢`;
}

function formatTotal(originalSize: string, price: string): string {
  const size = Number(originalSize);
  const p = Number(price);
  if (Number.isNaN(size) || Number.isNaN(p)) return "-";
  return `$${(size * p).toFixed(2)}`;
}

function formatFilled(sizeMatched: string, originalSize: string): string {
  const matched = Number(sizeMatched);
  const original = Number(originalSize);
  if (Number.isNaN(matched) || Number.isNaN(original)) return "-";
  return `${Math.round(matched)} / ${Math.round(original)}`;
}

function MarketGroupRow({
  group,
  expanded,
  onToggle,
  cancellingIds,
  onCancelOrder,
  eventInfo,
}: {
  group: MarketGroup;
  expanded: boolean;
  onToggle: () => void;
  cancellingIds: Set<string>;
  onCancelOrder: (order: OpenOrder) => void;
  eventInfo?: EventInfo;
}) {
  return (
    <>
      {/* Market header row */}
      <tr
        className="border-b border-card-border/50 transition-colors hover:bg-card-hover cursor-pointer"
        onClick={onToggle}
      >
        <td className="px-4 py-3">
          <div className="flex items-center gap-3">
            {eventInfo?.icon ? (
              <img
                src={eventInfo.icon}
                alt=""
                className="h-8 w-8 rounded-lg object-cover"
              />
            ) : (
              <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-card-hover text-xs font-bold text-muted">
                {(eventInfo?.title?.[0] ?? "?").toUpperCase()}
              </div>
            )}
            <div>
              <p className="text-sm font-medium text-foreground leading-tight">
                {eventInfo?.title ?? group.market}
              </p>
              <button
                className="flex items-center gap-1 text-xs text-muted hover:text-foreground"
                onClick={(e) => {
                  e.stopPropagation();
                  onToggle();
                }}
              >
                {group.orders.length} order{group.orders.length !== 1 && "s"}
                <svg
                  className={cn(
                    "h-3 w-3 transition-transform",
                    expanded && "rotate-180",
                  )}
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                  strokeWidth={2}
                >
                  <path d="M19 9l-7 7-7-7" />
                </svg>
              </button>
            </div>
          </div>
        </td>
        <td className="px-4 py-3 text-sm text-muted">-</td>
        <td className="px-4 py-3 text-sm text-muted">-</td>
        <td className="px-4 py-3 text-sm text-muted">-</td>
        <td className="px-4 py-3 text-right">
          <button
            disabled
            className="rounded-lg border border-red/20 px-3 py-1 text-xs font-medium text-red/40 cursor-not-allowed"
          >
            Cancel All <span className="text-[10px] italic font-normal">(coming soon)</span>
          </button>
        </td>
      </tr>

      {/* Individual order rows (when expanded) */}
      {expanded &&
        group.orders.map((order) => (
          <tr
            key={order.id}
            className="border-b border-card-border/30 bg-card-hover/30"
          >
            <td className="py-3 pl-8 pr-4">
              <div className="flex items-center gap-2">
                <span className="text-sm text-foreground">
                  {order.side === "BUY" ? "Buy" : "Sell"}
                </span>
                <span
                  className={cn(
                    "inline-flex items-center rounded px-1.5 py-0.5 text-xs font-semibold",
                    order.outcome.toLowerCase() === "yes"
                      ? "bg-green-dim text-green"
                      : "bg-red-dim text-red",
                  )}
                >
                  {order.outcome} {formatPrice(order.price)}
                </span>
              </div>
            </td>
            <td className="px-4 py-3 text-sm text-foreground">
              {formatFilled(order.size_matched, order.original_size)}
            </td>
            <td className="px-4 py-3 text-sm text-foreground">
              {formatTotal(order.original_size, order.price)}
            </td>
            <td className="px-4 py-3 text-sm text-muted">
              {formatExpiration(order.expiration, order.order_type)}
            </td>
            <td className="px-4 py-3 text-right">
              <button
                onClick={() => onCancelOrder(order)}
                disabled={cancellingIds.has(order.id)}
                className={cn(
                  "rounded-lg border border-red/30 px-3 py-1 text-xs font-medium text-red hover:bg-red/10 transition-colors",
                  cancellingIds.has(order.id) && "opacity-50 cursor-not-allowed",
                )}
              >
                {cancellingIds.has(order.id) ? "Cancelling…" : "Cancel"}
              </button>
            </td>
          </tr>
        ))}
    </>
  );
}

export function OpenOrders() {
  const { data: orders, isPending, error } = useOpenOrders();
  const { data: eventLookup } = useEventLookup();
  const cancelMutation = useCancelOrder();
  const [expandedMarkets, setExpandedMarkets] = useState<Set<string>>(
    new Set(),
  );
  const [cancellingIds, setCancellingIds] = useState<Set<string>>(new Set());
  const [search, setSearch] = useState("");

  const groups = useMemo(() => {
    if (!orders) return [];
    let filtered = orders;
    if (search) {
      const q = search.toLowerCase();
      filtered = orders.filter(
        (o) =>
          o.market.toLowerCase().includes(q) ||
          o.outcome.toLowerCase().includes(q) ||
          o.side.toLowerCase().includes(q),
      );
    }
    return groupByMarket(filtered);
  }, [orders, search]);

  const toggleMarket = (market: string) => {
    setExpandedMarkets((prev) => {
      const next = new Set(prev);
      if (next.has(market)) next.delete(market);
      else next.add(market);
      return next;
    });
  };

  const handleCancelOrder = async (order: OpenOrder) => {
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

  if (isPending) {
    return (
      <div className="flex items-center justify-center px-8 py-16">
        <div className="h-5 w-5 animate-spin rounded-full border-2 border-muted border-t-foreground" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center px-8 py-16">
        <p className="text-sm text-red">
          Failed to load open orders
        </p>
        <p className="mt-1 text-xs text-muted/60">{error.message}</p>
      </div>
    );
  }

  return (
    <div>
      {/* Toolbar: search + actions */}
      <div className="flex items-center gap-3 border-b border-card-border px-4 py-3">
        <div className="relative flex-1">
          <svg
            className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            strokeWidth={2}
          >
            <path d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
          </svg>
          <input
            type="text"
            placeholder="Search"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full rounded-lg border border-card-border bg-transparent py-2 pl-9 pr-3 text-sm text-foreground placeholder:text-muted focus:border-brand focus:outline-none"
          />
        </div>
        <button className="flex items-center gap-1.5 rounded-lg border border-card-border px-3 py-2 text-sm text-foreground hover:bg-card-hover transition-colors">
          <svg
            className="h-4 w-4"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            strokeWidth={2}
          >
            <path d="M3 4a1 1 0 011-1h16a1 1 0 011 1v2.586a1 1 0 01-.293.707l-6.414 6.414a1 1 0 00-.293.707V17l-4 4v-6.586a1 1 0 00-.293-.707L3.293 7.293A1 1 0 013 6.586V4z" />
          </svg>
          Market
        </button>
        <button
          disabled
          className="flex items-center gap-1.5 rounded-lg border border-red/20 px-3 py-2 text-sm text-red/40 cursor-not-allowed"
        >
          <svg
            className="h-4 w-4"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            strokeWidth={2}
          >
            <path d="M6 18L18 6M6 6l12 12" />
          </svg>
          Cancel all <span className="text-xs italic font-normal ml-1">(coming soon)</span>
        </button>
      </div>

      {/* Table */}
      {groups.length === 0 ? (
        <div className="flex flex-col items-center justify-center px-8 py-16">
          <svg
            className="mb-3 h-10 w-10 text-muted/30"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            strokeWidth={1.5}
          >
            <path d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
          </svg>
          <p className="text-sm font-medium text-muted">No open orders</p>
          <p className="mt-1 text-xs text-muted/60">
            Your resting limit orders will appear here
          </p>
        </div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-card-border">
                <th className="px-4 py-3 text-left text-[11px] font-semibold uppercase tracking-wider text-muted">
                  Market
                  <SortIcon />
                </th>
                <th className="px-4 py-3 text-left text-[11px] font-semibold uppercase tracking-wider text-muted">
                  Filled
                  <SortIcon />
                </th>
                <th className="px-4 py-3 text-left text-[11px] font-semibold uppercase tracking-wider text-muted">
                  Total
                  <SortIcon />
                </th>
                <th className="px-4 py-3 text-left text-[11px] font-semibold uppercase tracking-wider text-muted">
                  Expiration
                  <SortIcon />
                </th>
                <th className="px-4 py-3" />
              </tr>
            </thead>
            <tbody>
              {groups.map((group) => (
                <MarketGroupRow
                  key={group.market}
                  group={group}
                  expanded={expandedMarkets.has(group.market)}
                  onToggle={() => toggleMarket(group.market)}
                  cancellingIds={cancellingIds}
                  onCancelOrder={handleCancelOrder}
                  eventInfo={eventLookup?.get(group.orders[0]?.asset_id)}
                />
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

function SortIcon() {
  return (
    <svg
      className="ml-1 inline h-3 w-3 text-muted/40"
      fill="none"
      viewBox="0 0 24 24"
      stroke="currentColor"
      strokeWidth={2}
    >
      <path d="M7 11l5-5 5 5M7 13l5 5 5-5" />
    </svg>
  );
}
