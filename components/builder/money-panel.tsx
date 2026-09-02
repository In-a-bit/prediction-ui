"use client";

import { useState } from "react";

import { deposit, transfer } from "@/lib/builder/client";
import { formatUsd, isValidAmount } from "@/lib/builder/money";
import type { BuilderMode, SiteBalances } from "@/lib/builder/types";

type Action = "deposit" | "to_predictions" | "from_predictions";

/**
 * The customer's money, and the two things they can do with it.
 *
 * In segregated custody there are two balances and a real transfer between them; in shared custody
 * there is one, and a transfer would be fiction. So this renders differently per mode by design —
 * showing a greyed-out "move to predictions" in shared custody would imply a pot that does not
 * exist.
 */
export function MoneyPanel({
  mode,
  balances,
  onChanged,
}: {
  mode: BuilderMode;
  balances: SiteBalances;
  onChanged: (balances: SiteBalances) => void;
}) {
  const segregated = balances.cashMicro !== null;

  return (
    <section className="rounded-lg border border-card-border bg-card">
      <div className="grid gap-px bg-card-border sm:grid-cols-2">
        {segregated && (
          <Figure
            label="Cash with the builder"
            value={formatUsd(balances.cashMicro)}
            note="Held in the builder's own books. Not tradeable until you move it."
          />
        )}
        <Figure
          label={segregated ? "Prediction balance" : "Balance"}
          value={formatUsd(balances.predictionsMicro)}
          note={
            segregated
              ? "USDC in your own wallet, on chain."
              : "Held by the builder. The ledger is the money."
          }
          reserved={balances.reservedMicro}
          source={balances.source}
        />
      </div>

      <div className="flex flex-wrap gap-2 border-t border-card-border p-4">
        <AmountAction
          mode={mode}
          action="deposit"
          label="Deposit"
          onChanged={onChanged}
          help={
            segregated
              ? "Adds to your cash with the builder. Nothing touches the chain."
              : "Adds to your balance. The builder credits its own ledger; nothing touches the chain."
          }
        />
        {segregated && (
          <>
            <AmountAction
              mode={mode}
              action="to_predictions"
              label="Move to predictions"
              onChanged={onChanged}
              help="Sends USDC from the builder's operations wallet to your own. Takes a minute to mine."
            />
            <AmountAction
              mode={mode}
              action="from_predictions"
              label="Move back to cash"
              onChanged={onChanged}
              help="Returns USDC from your wallet to the builder, and credits your cash."
            />
          </>
        )}
      </div>
    </section>
  );
}

function Figure({
  label,
  value,
  note,
  reserved,
  source,
}: {
  label: string;
  value: string;
  note: string;
  reserved?: string;
  source?: SiteBalances["source"];
}) {
  const held = reserved && BigInt(reserved) > 0n ? reserved : null;
  return (
    <div className="bg-card p-4">
      <p className="text-[11px] uppercase tracking-wide text-muted">{label}</p>
      <p className="mt-1 font-mono text-2xl">{value}</p>
      {held && (
        <p className="text-xs text-muted">{formatUsd(held)} held against open orders</p>
      )}
      <p className="mt-1 text-xs text-muted">{note}</p>
      {/* A stale figure says so rather than quietly being wrong. */}
      {source === "mirror" && (
        <p className="mt-1 text-xs text-red">
          Showing the builder&apos;s last known copy — the chain could not be reached.
        </p>
      )}
    </div>
  );
}

function AmountAction({
  mode,
  action,
  label,
  help,
  onChanged,
}: {
  mode: BuilderMode;
  action: Action;
  label: string;
  help: string;
  onChanged: (balances: SiteBalances) => void;
}) {
  const [open, setOpen] = useState(false);
  const [amount, setAmount] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [note, setNote] = useState<string | null>(null);

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    setBusy(true);
    setError(null);
    setNote(null);
    try {
      if (action === "deposit") {
        const result = await deposit(mode, amount);
        onChanged(result.balances);
        setNote(`Added ${formatUsd(String(BigInt(Math.round(Number(amount) * 1e6))))}.`);
      } else {
        const result = await transfer(mode, amount, action);
        onChanged(result.balances);
        setNote(result.detail);
      }
      setAmount("");
    } catch (err) {
      setError(err instanceof Error ? err.message : "That did not work");
    } finally {
      setBusy(false);
    }
  };

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="rounded-md border border-card-border px-3 py-1.5 text-xs font-medium hover:border-brand hover:bg-card-hover"
      >
        {label}
      </button>
    );
  }

  return (
    <form onSubmit={submit} className="w-full rounded-md border border-brand/40 bg-input p-3">
      <p className="text-xs font-medium">{label}</p>
      <p className="mt-0.5 text-xs text-muted">{help}</p>
      <div className="mt-2 flex flex-wrap items-center gap-2">
        <input
          autoFocus
          inputMode="decimal"
          value={amount}
          onChange={(event) => setAmount(event.target.value)}
          placeholder="25.00"
          className="w-32 rounded-md border border-input-border bg-card px-3 py-1.5 font-mono text-sm outline-none focus:border-brand"
        />
        <button
          type="submit"
          disabled={busy || !isValidAmount(amount)}
          className="rounded-md bg-brand px-4 py-1.5 text-xs font-medium text-white hover:bg-brand-hover disabled:opacity-50"
        >
          {busy ? "Working…" : "Confirm"}
        </button>
        <button
          type="button"
          onClick={() => {
            setOpen(false);
            setError(null);
            setNote(null);
          }}
          className="rounded-md px-2 py-1.5 text-xs text-muted hover:text-foreground"
        >
          Cancel
        </button>
      </div>
      {error && <p className="mt-2 text-xs text-red">{error}</p>}
      {note && <p className="mt-2 text-xs text-green">{note}</p>}
    </form>
  );
}
