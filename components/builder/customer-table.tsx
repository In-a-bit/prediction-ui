"use client";

import { useState } from "react";

import { adjustCustomer } from "@/lib/builder/client";
import { formatUsd } from "@/lib/builder/money";
import type { BuilderMode, ManagedUser } from "@/lib/builder/types";

/**
 * The builder's customers and what they hold.
 *
 * Two balance columns in segregated custody, one in shared — the same distinction the customer
 * sees, because a back office that models money differently from the site it serves is how the two
 * end up disagreeing.
 */
export function CustomerTable({
  mode,
  users,
  error,
  onChanged,
}: {
  mode: BuilderMode;
  users: ManagedUser[] | null;
  error: string | null;
  onChanged: () => void;
}) {
  const [adjusting, setAdjusting] = useState<string | null>(null);
  const segregated = mode === "segregated";

  return (
    <section className="rounded-lg border border-card-border bg-card">
      <div className="border-b border-card-border px-5 py-3">
        <h2 className="text-sm font-semibold">Customers</h2>
        <p className="text-xs text-muted">
          {segregated
            ? "Cash is held in the builder's books; predictions is USDC in the customer's own wallet."
            : "One balance: the builder holds the USDC and the ledger is the money."}
        </p>
      </div>

      {error ? (
        <p className="px-5 py-4 text-xs text-red">{error}</p>
      ) : users === null ? (
        <p className="px-5 py-4 text-sm text-muted">Loading customers…</p>
      ) : users.length === 0 ? (
        <p className="px-5 py-4 text-sm text-muted">Nobody has signed up yet.</p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full min-w-[720px] text-left text-xs">
            <thead className="text-muted">
              <tr className="border-b border-card-border">
                <th className="px-5 py-2 font-normal">Customer</th>
                {segregated && <th className="px-3 py-2 text-right font-normal">Cash</th>}
                <th className="px-3 py-2 text-right font-normal">
                  {segregated ? "Predictions" : "Balance"}
                </th>
                <th className="px-3 py-2 text-right font-normal">Held</th>
                <th className="px-3 py-2 font-normal">Wallet</th>
                <th className="px-5 py-2 text-right font-normal"></th>
              </tr>
            </thead>
            <tbody>
              {users.map((user) => (
                <tr key={user.id} className="border-b border-card-border/60 last:border-0">
                  <td className="px-5 py-2.5">
                    <p className="font-medium">{user.displayName ?? user.email}</p>
                    <p className="text-muted">{user.email}</p>
                  </td>
                  {segregated && (
                    <td className="px-3 py-2.5 text-right font-mono">
                      {formatUsd(user.cashMicro)}
                    </td>
                  )}
                  <td className="px-3 py-2.5 text-right font-mono">
                    {formatUsd(user.predictionsMicro)}
                  </td>
                  <td className="px-3 py-2.5 text-right font-mono text-muted">
                    {formatUsd(user.reservedMicro)}
                  </td>
                  <td className="px-3 py-2.5">
                    {user.plaeeUserId ? (
                      <span className="text-green">provisioned</span>
                    ) : (
                      <span
                        className="text-muted"
                        title="A DPM wallet costs two on-chain transactions, so it is minted on their first visit to prediction markets rather than at sign-up."
                      >
                        not yet
                      </span>
                    )}
                  </td>
                  <td className="px-5 py-2.5 text-right">
                    <button
                      type="button"
                      onClick={() => setAdjusting(adjusting === user.id ? null : user.id)}
                      className="rounded-md border border-card-border px-2.5 py-1 hover:border-brand hover:bg-card-hover"
                    >
                      Adjust
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {adjusting && (
        <AdjustForm
          mode={mode}
          userId={adjusting}
          onDone={() => {
            setAdjusting(null);
            onChanged();
          }}
          onCancel={() => setAdjusting(null)}
        />
      )}
    </section>
  );
}

/**
 * Moving a customer's balance by hand.
 *
 * A signed amount, and a reason that is not optional: an adjustment is an exceptional act, and one
 * with no stated cause is indistinguishable from a mistake when it is read back later.
 */
function AdjustForm({
  mode,
  userId,
  onDone,
  onCancel,
}: {
  mode: BuilderMode;
  userId: string;
  onDone: () => void;
  onCancel: () => void;
}) {
  const [amount, setAmount] = useState("");
  const [reason, setReason] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const valid = /^-?\d+(\.\d{1,6})?$/.test(amount.trim()) && Number(amount) !== 0;

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    setBusy(true);
    setError(null);
    try {
      await adjustCustomer(mode, userId, amount.trim(), reason.trim());
      onDone();
    } catch (err) {
      setError(err instanceof Error ? err.message : "That adjustment was refused");
    } finally {
      setBusy(false);
    }
  };

  return (
    <form onSubmit={submit} className="flex flex-wrap items-center gap-2 border-t border-card-border p-4">
      <input
        autoFocus
        inputMode="decimal"
        value={amount}
        onChange={(event) => setAmount(event.target.value)}
        placeholder="25.00 or -25.00"
        className="w-36 rounded-md border border-input-border bg-input px-3 py-1.5 font-mono text-xs outline-none focus:border-brand"
      />
      <input
        value={reason}
        onChange={(event) => setReason(event.target.value)}
        placeholder="Why? (goodwill credit, correcting a mistake…)"
        className="min-w-[16rem] flex-1 rounded-md border border-input-border bg-input px-3 py-1.5 text-xs outline-none focus:border-brand"
      />
      <button
        type="submit"
        disabled={busy || !valid || reason.trim().length < 3}
        className="rounded-md bg-brand px-4 py-1.5 text-xs font-medium text-white hover:bg-brand-hover disabled:opacity-50"
      >
        {busy ? "Working…" : "Apply"}
      </button>
      <button
        type="button"
        onClick={onCancel}
        className="rounded-md px-2 py-1.5 text-xs text-muted hover:text-foreground"
      >
        Cancel
      </button>
      {error && <p className="w-full text-xs text-red">{error}</p>}
    </form>
  );
}
