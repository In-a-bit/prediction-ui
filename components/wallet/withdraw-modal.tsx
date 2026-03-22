"use client";

import { useCallback, useEffect, useState, useSyncExternalStore } from "react";
import { createPortal } from "react-dom";
import { useQueryClient } from "@tanstack/react-query";
import { isAddress, parseUnits } from "viem";
import { useMagic } from "@/components/providers/magic-provider";
import { formatTradeBalanceUsd } from "@/lib/utils";
import type { MagicLike } from "@/lib/allowance-relayer";
import { submitFundWithdraw } from "@/lib/fund-withdraw-relayer";
import {
  invalidateAllCollateralBalances,
  useCollateralBalance,
} from "@/lib/hooks/use-collateral-balance";

type WithdrawModalProps = {
  open: boolean;
  onClose: () => void;
  /** Optional extra callback after successful withdraw (balance is refreshed globally via React Query). */
  onSuccess?: () => void;
};

export function WithdrawModal({
  open,
  onClose,
  onSuccess,
}: WithdrawModalProps) {
  const queryClient = useQueryClient();
  const { balanceNormalized } = useCollateralBalance();
  const { magic, userProfile, walletAddress } = useMagic();
  const proxyWallet = userProfile?.proxyWallet ?? walletAddress ?? "";
  const [recipient, setRecipient] = useState("");
  const [amount, setAmount] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const isClient = useSyncExternalStore(
    () => () => {},
    () => true,
    () => false,
  );

  const handleClose = useCallback(() => {
    setRecipient("");
    setAmount("");
    setError(null);
    setSubmitting(false);
    onClose();
  }, [onClose]);

  useEffect(() => {
    if (open) setError(null);
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") handleClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, handleClose]);

  const recipientOk = isAddress(recipient.trim());
  let amountWei: bigint | null = null;
  let amountExceedsBalance = false;
  try {
    const t = amount.trim();
    if (t) {
      amountWei = parseUnits(t, 6);
      if (amountWei <= 0n) amountWei = null;
      if (balanceNormalized != null && balanceNormalized !== "" && amountWei != null) {
        const bal = parseUnits(balanceNormalized.trim(), 6);
        if (amountWei > bal) amountExceedsBalance = true;
      }
    }
  } catch {
    amountWei = null;
  }

  const canSubmit =
    Boolean(magic) &&
    Boolean(proxyWallet) &&
    recipientOk &&
    amountWei != null &&
    !amountExceedsBalance &&
    !submitting;

  function handleMax() {
    if (balanceNormalized == null || balanceNormalized === "") return;
    setAmount(balanceNormalized);
  }

  async function handleWithdraw() {
    if (!canSubmit || !magic) return;
    setError(null);
    setSubmitting(true);
    try {
      const relayerUrl = process.env.NEXT_PUBLIC_RELAYER_API_URL;
      await submitFundWithdraw(
        magic as unknown as MagicLike,
        relayerUrl,
        proxyWallet,
        recipient.trim(),
        amount.trim(),
      );
      await invalidateAllCollateralBalances(queryClient);
      onSuccess?.();
      handleClose();
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setSubmitting(false);
    }
  }

  if (!open || !isClient) return null;

  return createPortal(
    <>
      <div
        className="fixed inset-0 z-[100] bg-black/60 backdrop-blur-sm"
        aria-hidden
        onClick={handleClose}
      />
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="withdraw-modal-title"
        className="fixed left-1/2 top-1/2 z-[101] w-[calc(100%-2rem)] max-w-md -translate-x-1/2 -translate-y-1/2 rounded-2xl border border-card-border bg-card p-6 shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mb-4 flex items-start justify-between gap-4">
          <h2
            id="withdraw-modal-title"
            className="text-lg font-semibold text-foreground"
          >
            Withdraw
          </h2>
          <button
            type="button"
            onClick={handleClose}
            className="rounded-lg p-1 text-muted transition-colors hover:bg-card-hover hover:text-foreground"
            aria-label="Close"
          >
            <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <div className="space-y-4">
          <div>
            <label
              htmlFor="withdraw-recipient"
              className="mb-1.5 block text-xs font-medium text-muted"
            >
              Recipient address
            </label>
            <input
              id="withdraw-recipient"
              type="text"
              value={recipient}
              onChange={(e) => setRecipient(e.target.value)}
              placeholder="0x…"
              autoComplete="off"
              className="w-full rounded-xl border border-card-border bg-input px-3 py-2.5 font-mono text-sm text-foreground placeholder:text-muted/50 focus:border-brand focus:outline-none"
            />
          </div>

          <div>
            <div className="mb-1.5 flex items-center justify-between gap-2">
              <label
                htmlFor="withdraw-amount"
                className="text-xs font-medium text-muted"
              >
                Amount
              </label>
              <span className="text-xs text-muted">
                Balance{" "}
                <span className="font-medium text-foreground">
                  {formatTradeBalanceUsd(balanceNormalized ?? undefined)}
                </span>
              </span>
            </div>
            <div className="relative flex rounded-xl border border-card-border bg-input focus-within:border-brand">
              <input
                id="withdraw-amount"
                type="text"
                inputMode="decimal"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                placeholder="0"
                className="min-w-0 flex-1 bg-transparent px-3 py-2.5 pr-16 text-sm text-foreground placeholder:text-muted/50 focus:outline-none"
              />
              <button
                type="button"
                onClick={handleMax}
                disabled={!balanceNormalized}
                className="absolute right-2 top-1/2 -translate-y-1/2 rounded-lg bg-brand/15 px-2.5 py-1 text-xs font-semibold text-brand transition-colors hover:bg-brand/25 disabled:cursor-not-allowed disabled:opacity-40"
              >
                Max
              </button>
            </div>
          </div>

          <div>
            <span className="mb-1.5 block text-xs font-medium text-muted">
              Receive token
            </span>
            <div className="pointer-events-none flex w-full cursor-not-allowed items-center justify-between rounded-xl border border-card-border bg-input/80 px-3 py-2.5 text-sm text-foreground opacity-90">
              <span>USDC</span>
              <svg className="h-4 w-4 text-muted" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
              </svg>
            </div>
          </div>

          <div>
            <span className="mb-1.5 block text-xs font-medium text-muted">
              Receive chain
            </span>
            <div className="pointer-events-none flex w-full cursor-not-allowed items-center justify-between rounded-xl border border-card-border bg-input/80 px-3 py-2.5 text-sm text-foreground opacity-90">
              <span>Polygon</span>
              <svg className="h-4 w-4 text-muted" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
              </svg>
            </div>
          </div>

          {amountExceedsBalance && (
            <p className="text-xs text-red">
              Amount exceeds available balance.
            </p>
          )}

          {error && (
            <p className="rounded-xl border border-red/30 bg-red-dim px-3 py-2 text-xs text-red">
              {error}
            </p>
          )}

          <button
            type="button"
            disabled={!canSubmit}
            onClick={() => void handleWithdraw()}
            className="w-full rounded-xl bg-brand py-3 text-sm font-bold text-white transition-colors hover:bg-brand-hover disabled:cursor-not-allowed disabled:opacity-40"
          >
            {submitting ? "Submitting…" : "Withdraw"}
          </button>
        </div>
      </div>
    </>,
    document.body,
  );
}
