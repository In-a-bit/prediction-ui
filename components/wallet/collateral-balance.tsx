"use client";

import Link from "next/link";
import { useCollateralBalance } from "@/lib/hooks/use-collateral-balance";
import { formatTradeBalanceUsd } from "@/lib/utils";
import { BalanceBreakdown } from "@/components/wallet/balance-breakdown";

export function CollateralBalance() {
  const {
    walletAddress,
    balanceNormalized,
    isPending,
    isFetching,
    isError,
    refetch,
  } = useCollateralBalance();

  if (!walletAddress) return null;

  return (
    <div className="flex items-stretch overflow-hidden rounded-xl border border-card-border bg-card text-sm">
      <Link
        href="/portfolio"
        className="flex min-w-0 flex-1 items-center gap-2 px-3 py-2 transition-colors hover:bg-card-hover"
      >
        <span className="shrink-0 text-muted">Portfolio</span>
        {isPending && !balanceNormalized && !isError ? (
          <span className="min-w-0 truncate font-medium text-muted">—</span>
        ) : isError ? (
          <span className="font-medium text-red">Error</span>
        ) : (
          <BalanceBreakdown>
            <span className="min-w-0 truncate font-semibold text-foreground">
              {formatTradeBalanceUsd(balanceNormalized ?? undefined)}
            </span>
          </BalanceBreakdown>
        )}
      </Link>
      <button
        type="button"
        onClick={(e) => {
          e.preventDefault();
          void refetch();
        }}
        disabled={isFetching}
        title="Refresh balance"
        className="border-l border-card-border px-2.5 py-2 text-muted transition-colors hover:bg-card-hover hover:text-foreground disabled:opacity-50"
      >
        <svg
          className={`h-3.5 w-3.5 ${isFetching ? "animate-spin" : ""}`}
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
      </button>
    </div>
  );
}
