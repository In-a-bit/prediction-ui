"use client";

import { useState, useMemo } from "react";
import { cn } from "@/lib/utils";
import { usePositions, type Position } from "@/lib/hooks/use-positions";
import { useRedeemPosition } from "@/lib/hooks/use-redeem-position";

function formatCents(price: number): string {
  const cents = Math.round(price * 100);
  return `${cents}¢`;
}

function SearchIcon() {
  return (
    <svg
      className="h-4 w-4 text-muted"
      fill="none"
      viewBox="0 0 24 24"
      stroke="currentColor"
      strokeWidth={2}
    >
      <path d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
    </svg>
  );
}

function SortIcon() {
  return (
    <svg
      className="ml-0.5 inline-block h-3 w-3 text-muted/60"
      fill="none"
      viewBox="0 0 24 24"
      stroke="currentColor"
      strokeWidth={2}
    >
      <path d="M7 11l5-5 5 5M7 13l5 5 5-5" />
    </svg>
  );
}

function DownloadIcon() {
  return (
    <svg
      className="h-4 w-4 text-muted hover:text-foreground"
      fill="none"
      viewBox="0 0 24 24"
      stroke="currentColor"
      strokeWidth={2}
    >
      <path d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
    </svg>
  );
}

export function PositionsTable() {
  const { data: positions, isLoading, error } = usePositions();
  const [search, setSearch] = useState("");

  const filtered = useMemo(() => {
    if (!positions) return [];
    if (!search.trim()) return positions;
    const q = search.toLowerCase();
    return positions.filter(
      (p) =>
        p.title.toLowerCase().includes(q) ||
        p.outcome.toLowerCase().includes(q),
    );
  }, [positions, search]);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center px-8 py-16">
        <div className="h-6 w-6 animate-spin rounded-full border-2 border-brand border-t-transparent" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center px-8 py-16">
        <p className="text-sm text-red">Failed to load positions</p>
        <p className="mt-1 text-xs text-muted/60">{error.message}</p>
      </div>
    );
  }

  return (
    <div>
      {/* Toolbar: search + toggle */}
      <div className="flex items-center justify-between border-b border-card-border px-4 py-2.5">
        <div className="flex items-center gap-2 rounded-lg border border-card-border bg-background px-3 py-1.5">
          <SearchIcon />
          <input
            type="text"
            placeholder="Search"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-48 bg-transparent text-sm text-foreground placeholder:text-muted/50 outline-none"
          />
        </div>
        <button className="flex items-center gap-1.5 rounded-lg border border-card-border px-3 py-1.5 text-xs font-medium text-muted hover:text-foreground transition-colors">
          <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path d="M3 4h13M3 8h9m-9 4h6m4 0l4-4m0 0l4 4m-4-4v12" />
          </svg>
          Average cost per share
        </button>
      </div>

      {filtered.length === 0 ? (
        <div className="flex flex-col items-center justify-center px-8 py-16">
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
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-card-border">
                <th className="px-4 py-3 text-left text-[11px] font-semibold uppercase tracking-wider text-muted">
                  Market <SortIcon />
                </th>
                <th className="px-4 py-3 text-left text-[11px] font-semibold uppercase tracking-wider text-muted">
                  Avg &rarr; Now <SortIcon />
                </th>
                <th className="px-4 py-3 text-right text-[11px] font-semibold uppercase tracking-wider text-muted">
                  Traded <SortIcon />
                </th>
                <th className="px-4 py-3 text-right text-[11px] font-semibold uppercase tracking-wider text-muted">
                  To Win <SortIcon />
                </th>
                <th className="px-4 py-3 text-right text-[11px] font-semibold uppercase tracking-wider text-muted">
                  Value <SortIcon />
                </th>
                <th className="w-24 px-4 py-3" />
              </tr>
            </thead>
            <tbody>
              {filtered.map((pos) => (
                <PositionRow key={pos.asset} position={pos} />
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

function PositionRow({ position: pos }: { position: Position }) {
  const isYes = pos.outcome.toLowerCase() === "yes";
  const toWin = pos.size;
  const pnlPositive = pos.cashPnl >= 0;
  const redeem = useRedeemPosition();
  const [redeemError, setRedeemError] = useState<string | null>(null);

  function handleRedeem() {
    setRedeemError(null);
    redeem.mutate(
      { conditionId: pos.conditionId },
      {
        onError: (err) => {
          setRedeemError(err instanceof Error ? err.message : String(err));
        },
      },
    );
  }

  return (
    <tr className="border-b border-card-border/50 transition-colors hover:bg-card-hover">
      {/* MARKET */}
      <td className="px-4 py-3">
        <div className="flex items-center gap-3">
          {pos.icon ? (
            <img
              src={pos.icon}
              alt=""
              width={40}
              height={40}
              className="h-10 w-10 rounded-lg object-cover"
            />
          ) : (
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-card-border text-sm font-bold text-muted">
              {pos.title?.charAt(0) ?? "?"}
            </div>
          )}
          <div className="min-w-0">
            <p className="truncate text-sm font-medium text-foreground">
              {pos.title || pos.conditionId.slice(0, 12) + "..."}
            </p>
            <div className="mt-0.5 flex items-center gap-1.5 text-xs text-muted">
              <span
                className={cn(
                  "font-semibold",
                  isYes ? "text-green" : "text-red",
                )}
              >
                {pos.outcome}
              </span>
              <span>{formatCents(pos.curPrice)}</span>
              <span className="text-muted/40">&middot;</span>
              <span>{pos.size.toFixed(1)} shares</span>
            </div>
          </div>
        </div>
      </td>

      {/* AVG -> NOW */}
      <td className="px-4 py-3 text-sm text-muted">
        {formatCents(pos.avgPrice)} &rarr; {formatCents(pos.curPrice)}
      </td>

      {/* TRADED */}
      <td className="px-4 py-3 text-right text-sm text-foreground">
        ${pos.initialValue.toFixed(2)}
      </td>

      {/* TO WIN */}
      <td className="px-4 py-3 text-right text-sm text-foreground">
        ${toWin.toFixed(2)}
      </td>

      {/* VALUE + PnL */}
      <td className="px-4 py-3 text-right">
        <p className="text-sm font-medium text-foreground">
          ${pos.currentValue.toFixed(2)}
        </p>
        <p
          className={cn(
            "text-xs",
            pnlPositive ? "text-green" : "text-red",
          )}
        >
          {pnlPositive ? "+" : ""}${pos.cashPnl.toFixed(2)} (
          {Math.abs(pos.percentPnl).toFixed(0)}%)
        </p>
      </td>

      {/* ACTION + DOWNLOAD */}
      <td className="px-4 py-3">
        <div className="flex items-center justify-end gap-2">
          {pos.redeemable ? (
            <button
              onClick={handleRedeem}
              disabled={redeem.isPending}
              className="rounded-lg bg-green px-4 py-1.5 text-xs font-semibold text-white transition-colors hover:bg-green/80 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {redeem.isPending ? "Redeeming..." : "Redeem"}
            </button>
          ) : (
            <button className="rounded-lg bg-red px-4 py-1.5 text-xs font-semibold text-white transition-colors hover:bg-red/80">
              Sell
            </button>
          )}
          <button className="rounded p-1 transition-colors hover:bg-card-hover">
            <DownloadIcon />
          </button>
        </div>
        {redeemError && (
          <p className="mt-1 text-right text-xs text-red">{redeemError}</p>
        )}
      </td>
    </tr>
  );
}
