"use client";

import { useState } from "react";
import { useCollateralBalance } from "@/lib/hooks/use-collateral-balance";
import { formatTradeBalanceUsd } from "@/lib/utils";
import { DepositModal } from "@/components/wallet/deposit-modal";
import { WithdrawModal } from "@/components/wallet/withdraw-modal";
import { BalanceBreakdown } from "@/components/wallet/balance-breakdown";

export function TradingBalanceCard() {
  const {
    walletAddress,
    balanceNormalized,
    isPending,
    isFetching,
    isError,
    refetch,
  } = useCollateralBalance();
  const [depositOpen, setDepositOpen] = useState(false);
  const [withdrawOpen, setWithdrawOpen] = useState(false);

  return (
    <>
      <div className="flex h-full flex-col rounded-2xl border border-card-border bg-card p-4">
        <div className="mb-3 text-right">
          <p className="text-xs font-medium uppercase tracking-wider text-muted">
            Available to trade
          </p>
          <div className="mt-0.5 text-xl font-bold tabular-nums text-foreground">
            {isPending && !balanceNormalized && !isError ? (
              <span className="text-muted">—</span>
            ) : isError ? (
              <span className="text-red">Error</span>
            ) : (
              <BalanceBreakdown>
                <span className="cursor-help border-b border-dashed border-muted/40">
                  {formatTradeBalanceUsd(balanceNormalized ?? undefined)}
                </span>
              </BalanceBreakdown>
            )}
          </div>
        </div>

        <div className="mt-auto grid grid-cols-2 gap-2">
          <button
            type="button"
            onClick={() => setDepositOpen(true)}
            className="rounded-xl bg-brand py-2.5 text-sm font-bold text-white transition-colors hover:bg-brand-hover"
          >
            Deposit
          </button>
          <button
            type="button"
            onClick={() => setWithdrawOpen(true)}
            disabled={!walletAddress}
            className="rounded-xl border border-card-border py-2.5 text-sm font-bold text-foreground transition-colors hover:bg-card-hover disabled:cursor-not-allowed disabled:opacity-50"
          >
            Withdraw
          </button>
        </div>

        <div className="mt-2 flex justify-end">
          <button
            type="button"
            onClick={() => void refetch()}
            disabled={isFetching || !walletAddress}
            className="flex items-center gap-1.5 text-xs text-muted transition-colors hover:text-foreground disabled:opacity-50"
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
            Update balance
          </button>
        </div>
      </div>

      <DepositModal open={depositOpen} onClose={() => setDepositOpen(false)} />
      <WithdrawModal
        open={withdrawOpen}
        onClose={() => setWithdrawOpen(false)}
      />
    </>
  );
}
