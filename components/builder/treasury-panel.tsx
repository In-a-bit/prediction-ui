"use client";

import { useState } from "react";

import { transferTreasury } from "@/lib/builder/client";
import { formatUsd, isValidAmount } from "@/lib/builder/money";
import type { BuilderMode, Treasury, TreasuryWallet } from "@/lib/builder/types";

/**
 * The builder's two platform wallets, and the one movement allowed between them.
 *
 * They are kept deliberately unequal. The operations wallet is the hot one — it funds customers in
 * segregated custody and signs every trade in shared. The master wallet is the cold one: it can
 * never hold an allowance and never trades, so it is the only place funds can leave the platform
 * from, and doing so needs a credential Plaee may not even hold.
 */
export function TreasuryPanel({
  mode,
  treasury,
  error,
  onChanged,
}: {
  mode: BuilderMode;
  treasury: Treasury | null;
  error: string | null;
  onChanged: () => void;
}) {
  if (error && !treasury) {
    return (
      <section className="rounded-lg border border-card-border bg-card p-5">
        <h2 className="text-sm font-semibold">Treasury</h2>
        <p className="mt-2 text-xs text-red">{error}</p>
      </section>
    );
  }
  if (!treasury) {
    return (
      <section className="rounded-lg border border-card-border bg-card p-5 text-sm text-muted">
        Loading the treasury…
      </section>
    );
  }

  return (
    <section className="rounded-lg border border-card-border bg-card">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-card-border px-5 py-3">
        <div>
          <h2 className="text-sm font-semibold">Treasury</h2>
          <p className="text-xs text-muted">
            {treasury.walletCount} wallets · vault{" "}
            {treasury.upstream.vault.ready ? "ready" : "not ready"} · signer{" "}
            {treasury.upstream.reachable ? "reachable" : "unreachable"}
          </p>
        </div>
        <p className="text-xs text-muted">
          Mode burned {new Date(treasury.modeBurnedAt).toLocaleDateString()} — it can never change
        </p>
      </div>

      <div className="grid gap-px bg-card-border sm:grid-cols-2">
        <WalletCard
          wallet={treasury.masterWallet}
          title="Master"
          note="Cold. Never trades, never holds an allowance. The only exit from the platform."
        />
        <WalletCard
          wallet={treasury.operationsWallet}
          title="Operations"
          note={
            mode === "segregated"
              ? "Funds customers' wallets, and receives what they move back."
              : "Holds every customer's USDC and signs every trade."
          }
        />
      </div>

      {treasury.masterWallet && treasury.operationsWallet && (
        <TreasuryTransfer mode={mode} onChanged={onChanged} />
      )}

      <Keys treasury={treasury} />
    </section>
  );
}

function WalletCard({
  wallet,
  title,
  note,
}: {
  wallet: TreasuryWallet | null;
  title: string;
  note: string;
}) {
  if (!wallet) {
    return (
      <div className="bg-card p-4">
        <p className="text-[11px] uppercase tracking-wide text-muted">{title}</p>
        <p className="mt-1 text-sm text-muted">Not provisioned</p>
        <p className="mt-1 text-xs text-muted">{note}</p>
      </div>
    );
  }

  return (
    <div className="bg-card p-4">
      <div className="flex items-center justify-between gap-2">
        <p className="text-[11px] uppercase tracking-wide text-muted">{title}</p>
        <span
          className={`text-[11px] ${wallet.dpmRegistered ? "text-green" : "text-red"}`}
          title={
            wallet.dpmRegistered
              ? "Registered with the platform, so the relayer will accept its transactions."
              : "Not registered with the platform, so the relayer will refuse its transactions."
          }
        >
          {wallet.dpmRegistered ? "registered" : "not registered"}
        </span>
      </div>
      <p className="mt-1 font-mono text-xl">
        {wallet.balanceMicro === null ? "—" : formatUsd(wallet.balanceMicro)}
      </p>
      {wallet.balanceError && <p className="text-xs text-red">{wallet.balanceError}</p>}
      <p className="mt-1 text-xs text-muted">{note}</p>
      <dl className="mt-3 space-y-1 text-[11px]">
        <Address label="Proxy — where funds sit" value={wallet.proxyAddress} />
        <Address label="EOA — what signs" value={wallet.address} />
      </dl>
    </div>
  );
}

function Address({ label, value }: { label: string; value: string | null }) {
  return (
    <div className="flex items-baseline justify-between gap-2">
      <dt className="shrink-0 text-muted">{label}</dt>
      <dd className="truncate font-mono" title={value ?? undefined}>
        {value ?? "—"}
      </dd>
    </div>
  );
}

function TreasuryTransfer({ mode, onChanged }: { mode: BuilderMode; onChanged: () => void }) {
  const [amount, setAmount] = useState("");
  const [direction, setDirection] = useState<"to_operations" | "to_master">("to_operations");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [note, setNote] = useState<string | null>(null);

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    setBusy(true);
    setError(null);
    setNote(null);
    try {
      const result = await transferTreasury(mode, amount, direction);
      setNote(
        `Submitted. It becomes true when the transaction mines${
          result.relayerTxId ? ` (${result.relayerTxId.slice(0, 8)}…)` : ""
        }.`,
      );
      setAmount("");
      // Deliberately after a pause: the balances only change once the transfer mines, so refreshing
      // instantly would show the old figures and look like nothing happened.
      setTimeout(onChanged, 12_000);
    } catch (err) {
      setError(err instanceof Error ? err.message : "That transfer was refused");
    } finally {
      setBusy(false);
    }
  };

  return (
    <form onSubmit={submit} className="flex flex-wrap items-center gap-2 border-t border-card-border p-4">
      <span className="text-xs text-muted">Move USDC</span>
      <select
        value={direction}
        onChange={(event) => setDirection(event.target.value as typeof direction)}
        className="rounded-md border border-input-border bg-input px-2 py-1.5 text-xs outline-none focus:border-brand"
      >
        <option value="to_operations">master → operations</option>
        <option value="to_master">operations → master</option>
      </select>
      <input
        inputMode="decimal"
        value={amount}
        onChange={(event) => setAmount(event.target.value)}
        placeholder="10.00"
        className="w-28 rounded-md border border-input-border bg-input px-3 py-1.5 font-mono text-xs outline-none focus:border-brand"
      />
      <button
        type="submit"
        disabled={busy || !isValidAmount(amount)}
        className="rounded-md bg-brand px-4 py-1.5 text-xs font-medium text-white hover:bg-brand-hover disabled:opacity-50"
      >
        {busy ? "Submitting…" : "Transfer"}
      </button>
      {error && <p className="w-full text-xs text-red">{error}</p>}
      {note && <p className="w-full text-xs text-green">{note}</p>}
    </form>
  );
}

/**
 * The wallet-manager's credentials, as metadata only.
 *
 * Never their values — the wallet-manager reveals a key once, at creation, and a console that
 * could re-read them would be a second place for them to leak from.
 */
function Keys({ treasury }: { treasury: Treasury }) {
  return (
    <div className="border-t border-card-border px-5 py-4">
      <h3 className="text-xs font-semibold">Wallet-manager keys</h3>
      {treasury.apiKeysError ? (
        <p className="mt-1 text-xs text-muted">{treasury.apiKeysError}</p>
      ) : treasury.apiKeys.length === 0 ? (
        <p className="mt-1 text-xs text-muted">None.</p>
      ) : (
        <div className="mt-2 overflow-x-auto">
          <table className="w-full min-w-[560px] text-left text-xs">
            <thead className="text-muted">
              <tr>
                <th className="pb-1 font-normal">Name</th>
                <th className="pb-1 font-normal">Role</th>
                <th className="pb-1 font-normal">Prefix</th>
                <th className="pb-1 font-normal">Status</th>
                <th className="pb-1 font-normal">Last used</th>
              </tr>
            </thead>
            <tbody className="font-mono">
              {treasury.apiKeys.map((key) => (
                <tr key={key.id} className="border-t border-card-border/60">
                  <td className="py-1.5 font-sans">{key.name}</td>
                  <td className="py-1.5">{key.role}</td>
                  <td className="py-1.5 text-muted">{key.prefix}</td>
                  <td className={`py-1.5 ${key.status === "active" ? "text-green" : "text-red"}`}>
                    {key.status}
                  </td>
                  <td className="py-1.5 text-muted">
                    {key.lastUsedAt ? new Date(key.lastUsedAt).toLocaleString() : "never"}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
