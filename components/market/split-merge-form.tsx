"use client";

import { useState } from "react";
import { isAddress, parseUnits } from "viem";

import { useTrading } from "@/components/providers/trading-provider";
import { useCollateralBalance } from "@/lib/hooks/use-collateral-balance";
import { useTokenBalances } from "@/lib/hooks/use-token-balances";
import { useSplitMerge, type SplitMergeAction } from "@/lib/hooks/use-split-merge";
import { cn, formatTradeBalanceUsd } from "@/lib/utils";

const COPY: Record<
  SplitMergeAction,
  { verb: string; pending: string; balanceLabel: string; recipientHelp: string }
> = {
  split: {
    verb: "Split",
    pending: "Splitting…",
    balanceLabel: "USDC.e Balance",
    recipientHelp:
      "Sends both outcome tokens to another address, so they hold the position and you only fund it.",
  },
  merge: {
    verb: "Merge",
    pending: "Merging…",
    balanceLabel: "Complete sets",
    recipientHelp:
      "Sends the released USDC to another address. Your own outcome tokens are still the ones burned.",
  },
};

/**
 * Splitting and merging move value across the USDC / outcome-token boundary
 * rather than trading a side, so this form deliberately has no outcome or
 * buy/sell control: a split always mints both outcomes, and a merge always burns
 * one of each.
 */
export function SplitMergeForm({
  action,
  conditionId,
  yesTokenId,
  noTokenId,
  outcomeLabels = ["Yes", "No"],
}: {
  action: SplitMergeAction;
  conditionId: string | undefined;
  yesTokenId: string | undefined;
  noTokenId: string | undefined;
  outcomeLabels?: [string, string];
}) {
  const copy = COPY[action];
  const { userProfile } = useTrading();
  const { balanceNormalized } = useCollateralBalance();
  const { yesBalance, noBalance } = useTokenBalances(yesTokenId, noTokenId);
  const splitMerge = useSplitMerge();

  const [amount, setAmount] = useState("");
  const [recipient, setRecipient] = useState("");
  const [result, setResult] = useState<
    { kind: "success" | "error"; message: string } | null
  >(null);

  // A merge burns one of each outcome, so only complete sets can be merged.
  // Both sides are compared in base units so a decimal string never has to
  // round-trip through a float to be checked against the balance.
  const maxDecimal =
    action === "split"
      ? (balanceNormalized ?? "0")
      : String(Math.min(yesBalance, noBalance));

  let amountUnits: bigint | null = null;
  let maxUnits = 0n;
  try {
    maxUnits = parseUnits(maxDecimal, 6);
  } catch {
    maxUnits = 0n;
  }
  try {
    const trimmedAmount = amount.trim();
    if (trimmedAmount) {
      amountUnits = parseUnits(trimmedAmount, 6);
      if (amountUnits <= 0n) amountUnits = null;
    }
  } catch {
    amountUnits = null;
  }
  const exceedsBalance = amountUnits != null && amountUnits > maxUnits;

  const recipientTrimmed = recipient.trim();
  const recipientValid = recipientTrimmed === "" || isAddress(recipientTrimmed);

  const canSubmit =
    Boolean(conditionId) &&
    Boolean(userProfile?.proxyWallet) &&
    amountUnits != null &&
    !exceedsBalance &&
    recipientValid &&
    !splitMerge.isPending;

  function handleSubmit() {
    if (!canSubmit || !conditionId) return;
    setResult(null);
    splitMerge.mutate(
      {
        action,
        conditionId,
        amountDecimal: amount.trim(),
        recipient: recipientTrimmed || undefined,
      },
      {
        onSuccess: (data) => {
          setAmount("");
          setRecipient("");
          setResult({
            kind: "success",
            message: `${copy.verb} ${data.state} (${data.transactionID.slice(0, 10)}…)`,
          });
        },
        onError: (err) => {
          console.error(`[SplitMergeForm] ${action} failed:`, err);
          setResult({
            kind: "error",
            message: err instanceof Error ? err.message : String(err),
          });
        },
      },
    );
  }

  if (!conditionId) {
    return (
      <p className="text-sm text-muted">
        This market has no condition yet, so it cannot be {action}ed.
      </p>
    );
  }

  const [yesLabel, noLabel] = outcomeLabels;

  return (
    <div className="space-y-4">
      <p className="text-sm text-muted">
        {action === "split" ? (
          <>
            Locks USDC to mint an equal number of {yesLabel} and {noLabel} shares.
          </>
        ) : (
          <>
            Burns an equal number of {yesLabel} and {noLabel} shares to release
            the USDC behind them.
          </>
        )}
      </p>

      {userProfile?.proxyWallet && (
        <div className="flex items-center justify-between text-xs">
          <span className="text-muted">{copy.balanceLabel}</span>
          <span className="font-medium tabular-nums text-foreground">
            {action === "split"
              ? formatTradeBalanceUsd(balanceNormalized ?? undefined)
              : maxDecimal}
          </span>
        </div>
      )}

      <div>
        <label
          htmlFor="split-merge-amount"
          className="mb-1.5 block text-xs font-medium text-muted"
        >
          Amount {action === "split" ? "(USDC)" : "(shares of each)"}
        </label>
        <div
          className={cn(
            "relative flex rounded-xl border bg-input focus-within:border-brand",
            exceedsBalance ? "border-red/50" : "border-card-border",
          )}
        >
          <input
            id="split-merge-amount"
            type="text"
            inputMode="decimal"
            autoComplete="off"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            placeholder="0"
            className="min-w-0 flex-1 bg-transparent px-3 py-2.5 pr-16 text-sm tabular-nums text-foreground placeholder:text-muted/50 focus:outline-none"
          />
          <button
            type="button"
            onClick={() => setAmount(maxUnits > 0n ? maxDecimal : "")}
            disabled={maxUnits <= 0n}
            className="absolute right-2 top-1/2 -translate-y-1/2 rounded-lg bg-brand/15 px-2.5 py-1 text-xs font-semibold text-brand transition-colors hover:bg-brand/25 disabled:cursor-not-allowed disabled:opacity-40"
          >
            Max
          </button>
        </div>
        {exceedsBalance && (
          <p className="mt-1 text-[11px] text-red">
            {action === "split"
              ? "Amount exceeds your USDC.e balance."
              : "You do not hold that many complete sets."}
          </p>
        )}
      </div>

      <div>
        <label
          htmlFor="split-merge-recipient"
          className="mb-1.5 block text-xs font-medium text-muted"
        >
          Recipient <span className="font-normal">(optional)</span>
        </label>
        <input
          id="split-merge-recipient"
          type="text"
          autoComplete="off"
          spellCheck={false}
          value={recipient}
          onChange={(e) => setRecipient(e.target.value)}
          placeholder="0x… — leave empty to keep it yourself"
          aria-invalid={!recipientValid}
          aria-describedby="split-merge-recipient-help"
          className={cn(
            "w-full rounded-xl border bg-input px-3 py-2.5 font-mono text-sm text-foreground placeholder:text-muted/50 focus:border-brand focus:outline-none",
            recipientValid ? "border-card-border" : "border-red/50",
          )}
        />
        <p id="split-merge-recipient-help" className="mt-1.5 text-xs text-muted">
          {recipientValid ? (
            copy.recipientHelp
          ) : (
            <span className="text-red">
              Not a valid address. Check for a missing character or altered
              capitalisation — addresses carry a checksum.
            </span>
          )}
        </p>
      </div>

      <button
        type="button"
        disabled={!canSubmit}
        onClick={handleSubmit}
        className="w-full rounded-xl bg-brand py-3.5 text-sm font-semibold text-white transition-all hover:bg-brand-hover active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-40"
      >
        {splitMerge.isPending ? copy.pending : copy.verb}
      </button>

      {!userProfile?.proxyWallet && (
        <p className="text-center text-xs text-muted">
          Connect your wallet to {action}
        </p>
      )}

      {result && (
        <div
          className={cn(
            "flex items-start gap-2 rounded-lg border px-3 py-2 text-xs font-medium",
            result.kind === "error"
              ? "border-red/30 bg-red/10 text-red"
              : "border-green/30 bg-green/10 text-green",
          )}
          role={result.kind === "error" ? "alert" : "status"}
        >
          <span aria-hidden className="mt-px shrink-0 leading-none">
            {result.kind === "error" ? "⚠" : "✓"}
          </span>
          <span className="break-words">{result.message}</span>
        </div>
      )}
    </div>
  );
}
