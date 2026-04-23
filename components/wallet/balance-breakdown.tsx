"use client";

import { type ReactNode, useState, useRef, useEffect } from "react";
import { useDetailedBalance } from "@/lib/hooks/use-detailed-balance";
import { useCollateralBalance } from "@/lib/hooks/use-collateral-balance";
import { useDetailedTokenBalance } from "@/lib/hooks/use-detailed-token-balance";

function formatRaw(raw: string | null): string {
  if (!raw) return "—";
  try {
    const n = Number(raw) / 1e6;
    if (Number.isNaN(n)) return "—";
    return `$${n.toFixed(6).replace(/\.?0+$/, "")}`;
  } catch {
    return "—";
  }
}

function formatTokenRaw(raw: string | null | undefined): string {
  if (!raw) return "—";
  try {
    const n = Number(raw) / 1e6;
    if (Number.isNaN(n)) return "—";
    return n.toFixed(6).replace(/\.?0+$/, "");
  } catch {
    return "—";
  }
}

function StatusDot({ values }: { values: (string | null | undefined)[] }) {
  const defined = values.filter((v) => v != null) as string[];
  if (defined.length < 2) return null;
  const normalized = defined.map((v) => {
    try {
      return BigInt(v);
    } catch {
      return null;
    }
  });
  const valid = normalized.filter((v) => v != null) as bigint[];
  if (valid.length < 2) return null;
  const allMatch = valid.every((v) => v === valid[0]);
  return (
    <span
      className={`ml-1.5 inline-block h-2 w-2 rounded-full ${allMatch ? "bg-green" : "bg-red"}`}
      title={allMatch ? "All sources match" : "Mismatch detected"}
    />
  );
}

function RefreshIcon({ spinning }: { spinning?: boolean }) {
  return (
    <svg
      className={`h-3 w-3 ${spinning ? "animate-spin" : ""}`}
      fill="none"
      viewBox="0 0 24 24"
      stroke="currentColor"
      strokeWidth={2}
    >
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"
      />
    </svg>
  );
}

type Position = { above: boolean; alignRight: boolean };

function useTooltipPosition(open: boolean, triggerRef: React.RefObject<HTMLDivElement | null>): Position {
  const [pos, setPos] = useState<Position>({ above: false, alignRight: false });

  useEffect(() => {
    if (open && triggerRef.current) {
      const rect = triggerRef.current.getBoundingClientRect();
      setPos({
        above: rect.bottom + 180 > window.innerHeight,
        alignRight: rect.right > window.innerWidth - 230,
      });
    }
  }, [open, triggerRef]);

  return pos;
}

function TooltipWrapper({
  children,
  content,
}: {
  children: ReactNode;
  content: ReactNode;
}) {
  const [open, setOpen] = useState(false);
  const triggerRef = useRef<HTMLDivElement>(null);
  const { above, alignRight } = useTooltipPosition(open, triggerRef);

  const posClass = [
    above ? "bottom-full mb-2" : "top-full mt-2",
    alignRight ? "right-0" : "left-1/2 -translate-x-1/2",
  ].join(" ");

  return (
    <div
      ref={triggerRef}
      className="relative inline-flex"
      onMouseEnter={() => setOpen(true)}
      onMouseLeave={() => setOpen(false)}
    >
      {children}
      {open && (
        <div
          className={`absolute z-50 w-56 rounded-lg border border-card-border bg-card p-3 shadow-lg ${posClass}`}
        >
          {content}
        </div>
      )}
    </div>
  );
}

export function BalanceBreakdown({ children }: { children: ReactNode }) {
  const { detailed, isPending: detailedFetching, refetch: refetchDetailed } = useDetailedBalance();
  const { balanceNormalized, isFetching: onchainFetching, refetch: refetchOnchain } = useCollateralBalance();

  const fetching = detailedFetching || onchainFetching;

  const refreshAll = () => {
    void refetchOnchain();
    void refetchDetailed();
  };

  const onchainRaw = balanceNormalized
    ? String(Math.round(Number(balanceNormalized) * 1e6))
    : null;

  return (
    <div className="inline-flex items-center gap-1">
      <TooltipWrapper
        content={
          <>
            <div className="mb-2 flex items-center justify-between">
              <p className="text-[10px] font-semibold uppercase tracking-wider text-muted">
                Balance Sources
              </p>
              <StatusDot values={[onchainRaw, detailed.db, detailed.engine]} />
            </div>
            <ul className="space-y-1.5 text-xs">
              <li className="flex justify-between">
                <span className="text-muted">On-chain</span>
                <span className="font-medium tabular-nums text-foreground">
                  {balanceNormalized
                    ? `$${Number(balanceNormalized).toFixed(6).replace(/\.?0+$/, "")}`
                    : "—"}
                </span>
              </li>
              <li className="flex justify-between">
                <span className="text-muted">Database</span>
                <span className="font-medium tabular-nums text-foreground">
                  {formatRaw(detailed.db)}
                </span>
              </li>
              <li className="flex justify-between">
                <span className="text-muted">Engine</span>
                <span className="font-medium tabular-nums text-foreground">
                  {formatRaw(detailed.engine)}
                </span>
              </li>
              <li className="flex justify-between border-t border-card-border pt-1.5">
                <span className="text-muted">Locked</span>
                <span className="font-medium tabular-nums text-yellow-500">
                  {formatRaw(detailed.locked)}
                </span>
              </li>
            </ul>
          </>
        }
      >
        {children}
      </TooltipWrapper>
      <button
        type="button"
        onClick={refreshAll}
        disabled={fetching}
        title="Refresh all balance sources"
        className="shrink-0 text-muted transition-colors hover:text-foreground disabled:opacity-50"
      >
        <RefreshIcon spinning={fetching} />
      </button>
    </div>
  );
}

export function TokenBalanceBreakdown({
  children,
  tokenId,
  onchainBalance,
}: {
  children: ReactNode;
  tokenId: string | undefined;
  onchainBalance: number;
}) {
  const { tokenDetail, isFetching: tokenFetching, refetch: refetchToken } = useDetailedTokenBalance(tokenId);

  const onchainRaw = onchainBalance > 0
    ? String(Math.round(onchainBalance * 1e6))
    : null;

  return (
    <div className="inline-flex items-center gap-1">
      <TooltipWrapper
        content={
          <>
            <div className="mb-2 flex items-center justify-between">
              <p className="text-[10px] font-semibold uppercase tracking-wider text-muted">
                Token Balance Sources
              </p>
              <StatusDot
                values={[
                  onchainRaw,
                  tokenDetail?.balance,
                  tokenDetail?.engine_balance,
                ]}
              />
            </div>
            <ul className="space-y-1.5 text-xs">
              <li className="flex justify-between">
                <span className="text-muted">On-chain</span>
                <span className="font-medium tabular-nums text-foreground">
                  {onchainBalance > 0
                    ? onchainBalance.toFixed(6).replace(/\.?0+$/, "")
                    : "—"}
                </span>
              </li>
              <li className="flex justify-between">
                <span className="text-muted">Database</span>
                <span className="font-medium tabular-nums text-foreground">
                  {formatTokenRaw(tokenDetail?.balance)}
                </span>
              </li>
              <li className="flex justify-between">
                <span className="text-muted">Engine</span>
                <span className="font-medium tabular-nums text-foreground">
                  {formatTokenRaw(tokenDetail?.engine_balance)}
                </span>
              </li>
              <li className="flex justify-between border-t border-card-border pt-1.5">
                <span className="text-muted">Locked</span>
                <span className="font-medium tabular-nums text-yellow-500">
                  {formatTokenRaw(tokenDetail?.engine_locked)}
                </span>
              </li>
            </ul>
          </>
        }
      >
        {children}
      </TooltipWrapper>
      <button
        type="button"
        onClick={() => void refetchToken()}
        disabled={tokenFetching}
        title="Refresh all token balance sources"
        className="shrink-0 text-muted transition-colors hover:text-foreground disabled:opacity-50"
      >
        <RefreshIcon spinning={tokenFetching} />
      </button>
    </div>
  );
}
