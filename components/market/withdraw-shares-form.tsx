"use client";

import { useMemo, useState } from "react";
import { isAddress, parseUnits } from "viem";

import { useTrading } from "@/components/providers/trading-provider";
import { usePositions } from "@/lib/hooks/use-positions";
import { useWithdrawShares } from "@/lib/hooks/use-withdraw-shares";
import { cn } from "@/lib/utils";

function formatShares(n: number): string {
  return n.toFixed(6).replace(/\.?0+$/, "");
}

export function WithdrawSharesForm() {
  const { userProfile } = useTrading();
  const { data: positions, isLoading, error } = usePositions();
  const withdraw = useWithdrawShares();
  const [asset, setAsset] = useState("");
  const [amount, setAmount] = useState("");
  const [recipient, setRecipient] = useState("");
  const [result, setResult] = useState<
    { kind: "success" | "error"; message: string } | null
  >(null);

  const held = useMemo(
    () => (positions ?? []).filter((p) => p.size > 0),
    [positions],
  );
  const selected = held.find((p) => p.asset === asset);

  const maxDecimal = selected ? formatShares(selected.size) : "0";
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
  const recipientValid = isAddress(recipientTrimmed);

  const canSubmit =
    Boolean(selected) &&
    Boolean(userProfile?.proxyWallet) &&
    amountUnits != null &&
    !exceedsBalance &&
    recipientValid &&
    !withdraw.isPending;

  function handleSubmit() {
    if (!canSubmit || !selected) return;
    setResult(null);
    withdraw.mutate(
      {
        tokenId: selected.asset,
        amountDecimal: amount.trim(),
        recipient: recipientTrimmed,
      },
      {
        onSuccess: (data) => {
          setAmount("");
          setResult({
            kind: "success",
            message: `Mined ${data.transactionHash.slice(0, 10)}…`,
          });
        },
        onError: (err) => {
          setResult({
            kind: "error",
            message: err instanceof Error ? err.message : String(err),
          });
        },
      },
    );
  }

  return (
    <div className="space-y-4">
      <p className="text-sm text-muted">
        Sends shares out of your proxy. The EOA pays POL; this does not go
        through the relayer.
      </p>

      <div>
        <label
          htmlFor="withdraw-shares-position"
          className="mb-1.5 block text-xs font-medium text-muted"
        >
          Position
        </label>
        <select
          id="withdraw-shares-position"
          value={asset}
          onChange={(e) => {
            setAsset(e.target.value);
            setAmount("");
          }}
          disabled={isLoading || held.length === 0}
          className="w-full rounded-xl border border-card-border bg-input px-3 py-2.5 text-sm text-foreground focus:border-brand focus:outline-none disabled:opacity-40"
        >
          <option value="">
            {isLoading
              ? "Loading…"
              : held.length === 0
                ? "No positions"
                : "Select a position"}
          </option>
          {held.map((p) => (
            <option key={p.asset} value={p.asset}>
              {p.title || p.question || p.slug} · {p.outcome} · {formatShares(p.size)}
            </option>
          ))}
        </select>
        {error && (
          <p className="mt-1 text-[11px] text-red">Failed to load positions.</p>
        )}
      </div>

      <div>
        <label
          htmlFor="withdraw-shares-amount"
          className="mb-1.5 block text-xs font-medium text-muted"
        >
          Amount (shares)
        </label>
        <div
          className={cn(
            "relative flex rounded-xl border bg-input focus-within:border-brand",
            exceedsBalance ? "border-red/50" : "border-card-border",
          )}
        >
          <input
            id="withdraw-shares-amount"
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
          <p className="mt-1 text-[11px] text-red">Amount exceeds your balance.</p>
        )}
      </div>

      <div>
        <label
          htmlFor="withdraw-shares-recipient"
          className="mb-1.5 block text-xs font-medium text-muted"
        >
          Recipient
        </label>
        <input
          id="withdraw-shares-recipient"
          type="text"
          autoComplete="off"
          spellCheck={false}
          value={recipient}
          onChange={(e) => setRecipient(e.target.value)}
          placeholder="0x…"
          aria-invalid={recipientTrimmed !== "" && !recipientValid}
          className={cn(
            "w-full rounded-xl border bg-input px-3 py-2.5 font-mono text-sm text-foreground placeholder:text-muted/50 focus:border-brand focus:outline-none",
            recipientTrimmed === "" || recipientValid
              ? "border-card-border"
              : "border-red/50",
          )}
        />
      </div>

      <button
        type="button"
        disabled={!canSubmit}
        onClick={handleSubmit}
        className="w-full rounded-xl bg-brand py-3.5 text-sm font-semibold text-white transition-all hover:bg-brand-hover active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-40"
      >
        {withdraw.isPending ? "Withdrawing…" : "Withdraw"}
      </button>

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
          <span className="break-words">{result.message}</span>
        </div>
      )}
    </div>
  );
}
