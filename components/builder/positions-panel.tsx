"use client";

import { useState } from "react";

import { redeemPosition, sellPosition } from "@/lib/builder/client";
import { formatShares, formatUsd, isValidAmount } from "@/lib/builder/money";
import type { BuilderMode, Position } from "@/lib/builder/types";

/**
 * A customer's outcome-token holdings, in the same terms the platform's own portfolio page uses.
 *
 * The columns deliberately mirror that page — Market, Avg → Now, Traded, To Win, Value — because a
 * builder's console and the platform screen behind it showing a customer's PnL two different ways
 * is how the two quietly drift apart. The one extra column, Held, is custody-specific: it is the
 * builder's ledger reporting shares reserved against an open sell, which the chain does not model.
 *
 * Size comes from the builder's ledger; price and PnL come from the platform. Either can be
 * missing, and a missing one never removes the row: these are shares the customer owns, and a
 * screen that hides them says "no positions", which is a different and much worse claim than "we
 * could not price this one".
 */
export function PositionsPanel({
  mode,
  positions,
  title = "Positions",
  empty = "No open positions.",
  userId,
  onChanged,
}: {
  mode: BuilderMode;
  positions: Position[];
  title?: string;
  empty?: string;
  /** Set in the back office, where an operator acts for a named customer. Omitted on the site. */
  userId?: string;
  onChanged?: () => void;
}) {
  // A settled or fully-sold holding stays in the ledger at zero. It is not a position any more.
  const held = positions.filter((p) => BigInt(p.sizeMicro) > 0n);

  return (
    <section className="rounded-lg border border-card-border bg-card">
      <header className="flex items-baseline justify-between px-5 py-3">
        <h2 className="text-sm font-semibold">{title}</h2>
        {held.length > 0 && (
          <span className="text-xs text-muted">
            {held.length} {held.length === 1 ? "holding" : "holdings"}
          </span>
        )}
      </header>

      {held.length === 0 ? (
        <p className="px-5 pb-4 text-sm text-muted">{empty}</p>
      ) : (
        // Wide content scrolls inside its own box rather than making the page scroll sideways.
        <div className="overflow-x-auto border-t border-card-border">
          <table className="w-full min-w-[46rem] text-sm">
            <thead>
              <tr className="border-b border-card-border text-muted">
                <th className="px-5 py-2 text-left text-[11px] font-normal uppercase tracking-wide">
                  Market
                </th>
                <th className="px-3 py-2 text-left text-[11px] font-normal uppercase tracking-wide">
                  Avg &rarr; Now
                </th>
                <th className="px-3 py-2 text-right text-[11px] font-normal uppercase tracking-wide">
                  Traded
                </th>
                <th className="px-3 py-2 text-right text-[11px] font-normal uppercase tracking-wide">
                  To win
                </th>
                <th className="px-3 py-2 text-right text-[11px] font-normal uppercase tracking-wide">
                  Held
                </th>
                <th className="px-3 py-2 text-right text-[11px] font-normal uppercase tracking-wide">
                  Value
                </th>
                <th className="px-5 py-2" />
              </tr>
            </thead>
            <tbody>
              {held.map((p) => (
                <PositionRow
                  key={p.tokenId}
                  mode={mode}
                  position={p}
                  userId={userId}
                  onChanged={onChanged}
                />
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}

function PositionRow({
  mode,
  position: p,
  userId,
  onChanged,
}: {
  mode: BuilderMode;
  position: Position;
  userId?: string;
  onChanged?: () => void;
}) {
  const reserved = BigInt(p.reservedMicro || "0");
  const yes = p.outcome?.toLowerCase() === "yes";

  return (
    <tr className="border-b border-card-border/60 align-top last:border-0">
      {/* MARKET — art, question, side, size */}
      <td className="px-5 py-3">
        <div className="flex items-start gap-3">
          {p.icon ? (
            // eslint-disable-next-line @next/next/no-img-element -- remote market art, no loader
            <img src={p.icon} alt="" width={36} height={36} className="h-9 w-9 rounded object-cover" />
          ) : (
            <div className="flex h-9 w-9 items-center justify-center rounded bg-card-border text-xs text-muted">
              ?
            </div>
          )}
          <div className="min-w-0">
            {p.question ? (
              <p className="max-w-[22rem] truncate font-medium" title={p.question}>
                {p.question}
              </p>
            ) : (
              // Not an error state: the shares are real, only the name is missing.
              <p
                className="font-mono text-xs text-muted"
                title={`Token ${p.tokenId} — this holding could not be named.`}
              >
                Token {p.tokenId.slice(0, 10)}…
              </p>
            )}
            <p className="mt-0.5 flex flex-wrap items-center gap-1.5 text-xs text-muted">
              {p.outcome && (
                <span className={yes ? "font-semibold text-green" : "font-semibold text-red"}>
                  {p.outcome.toUpperCase()}
                </span>
              )}
              <span>{formatShares(p.sizeMicro)} shares</span>
              {p.endDate && (
                <>
                  <span className="text-muted/40">&middot;</span>
                  <span>ends {p.endDate}</span>
                </>
              )}
              {p.redeemable && <span className="text-green">&middot; redeemable</span>}
            </p>
            {/* The two books disagreeing is worth saying out loud, not quietly picking one. */}
            {p.chainSizeMismatch !== null && (
              <p className="mt-0.5 text-xs text-red">
                Chain reports {p.chainSizeMismatch} shares — the builder&apos;s ledger says{" "}
                {formatShares(p.sizeMicro)}.
              </p>
            )}
          </div>
        </div>
      </td>

      <td className="px-3 py-3 text-muted">
        {cents(p.avgPrice)} &rarr; {cents(p.curPrice)}
      </td>

      <td className="px-3 py-3 text-right font-mono">{usd(p.initialValue)}</td>

      <td className="px-3 py-3 text-right font-mono" title="A dollar a share if this outcome wins.">
        {usd(p.toWin)}
      </td>

      <td className="px-3 py-3 text-right font-mono text-muted">
        {reserved > 0n ? formatShares(p.reservedMicro) : "—"}
      </td>

      <td className="px-3 py-3 text-right">
        <p className="font-mono">{usd(p.currentValue)}</p>
        <Pnl cash={p.cashPnl} percent={p.percentPnl} />
      </td>

      <td className="px-5 py-3 text-right">
        <PositionActions mode={mode} position={p} userId={userId} onChanged={onChanged} />
      </td>
    </tr>
  );
}

function Pnl({ cash, percent }: { cash: number | null; percent: number | null }) {
  // No current price means no honest profit figure. A dash beats inventing a 100% loss.
  if (cash === null) {
    return (
      <p className="text-xs text-muted" title="No current market price, so there is nothing to compare against.">
        no price
      </p>
    );
  }
  const up = cash >= 0;
  return (
    <p className={up ? "text-xs text-green" : "text-xs text-red"}>
      {up ? "+" : "−"}
      {formatUsd(Math.round(Math.abs(cash) * 1_000_000).toString())}
      {percent !== null && <> ({Math.abs(percent).toFixed(0)}%)</>}
    </p>
  );
}

/** Prices are quoted in cents, the way a book is read. */
function cents(price: number | null): string {
  if (price === null) return "—";
  return `${Math.round(price * 100)}¢`;
}

function usd(value: number | null): string {
  if (value === null) return "—";
  return formatUsd(Math.round(value * 1_000_000).toString());
}

/** Shown when the whole set came back unnamed, so the reason is stated once rather than per row. */
export function PositionsUnnamedNote({ named }: { named: boolean }) {
  if (named) return null;
  return (
    <p className="px-5 pb-3 text-xs text-red">
      Showing token ids — Plaee could not be reached to name or price these markets.
    </p>
  );
}

/**
 * Sell and Redeem for one holding.
 *
 * Redeem appears only once the market has resolved, because that is the only time it does
 * anything — the platform decides that and reports it as `redeemable`, so this does not try to
 * infer it from an end date that has passed.
 *
 * Selling opens a small form rather than firing immediately. These books are thin, and a
 * one-click "sell at market" is how someone discovers they got a cent a share; an explicit limit
 * price is the honest interface. The current price pre-fills it when there is one.
 */
function PositionActions({
  mode,
  position: p,
  userId,
  onChanged,
}: {
  mode: BuilderMode;
  position: Position;
  userId?: string;
  onChanged?: () => void;
}) {
  const [selling, setSelling] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState<string | null>(null);

  async function redeem() {
    if (!p.conditionId) return;
    setBusy(true);
    setError(null);
    try {
      const r = await redeemPosition(mode, p.conditionId, userId);
      // Submitted, not settled. The ledger moves when the transaction mines, so saying "redeemed"
      // here would be claiming something that has not happened yet.
      setDone(r.relayerTxId ? "submitted" : "queued");
      onChanged?.();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Redeem failed");
    } finally {
      setBusy(false);
    }
  }

  if (done) return <span className="text-xs text-green">{done}</span>;

  return (
    <div className="flex flex-col items-end gap-1.5">
      {!selling && (
        <div className="flex items-center justify-end gap-2">
          <button
            type="button"
            onClick={() => setSelling(true)}
            className="rounded-md border border-card-border px-2.5 py-1 text-xs hover:border-brand hover:bg-card-hover"
          >
            Sell
          </button>
          {p.redeemable && (
            <button
              type="button"
              onClick={() => void redeem()}
              disabled={busy || !p.conditionId}
              title={
                p.conditionId
                  ? undefined
                  : "This holding could not be valued, so the market it belongs to is unknown."
              }
              className="rounded-md bg-green px-2.5 py-1 text-xs font-semibold text-white hover:bg-green/80 disabled:opacity-50"
            >
              {busy ? "Redeeming…" : "Redeem"}
            </button>
          )}
        </div>
      )}

      {selling && (
        <SellForm
          mode={mode}
          position={p}
          userId={userId}
          onCancel={() => setSelling(false)}
          onDone={() => {
            setSelling(false);
            setDone("order placed");
            onChanged?.();
          }}
        />
      )}

      {error && <p className="max-w-[16rem] text-right text-xs text-red">{error}</p>}
    </div>
  );
}

function SellForm({
  mode,
  position: p,
  userId,
  onCancel,
  onDone,
}: {
  mode: BuilderMode;
  position: Position;
  userId?: string;
  onCancel: () => void;
  onDone: () => void;
}) {
  const available = (Number(BigInt(p.sizeMicro)) - Number(BigInt(p.reservedMicro || "0"))) / 1_000_000;
  const [shares, setShares] = useState(String(available));
  const [price, setPrice] = useState(p.curPrice ? p.curPrice.toFixed(2) : "");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const priceOk = /^0?\.\d{1,4}$|^1(\.0+)?$/.test(price.trim()) && Number(price) > 0;
  const sharesOk = isValidAmount(shares) && Number(shares) <= available + 1e-9;

  async function submit() {
    setBusy(true);
    setError(null);
    try {
      await sellPosition(mode, { tokenId: p.tokenId, shares: Number(shares), price: Number(price) }, userId);
      onDone();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Sell failed");
      setBusy(false);
    }
  }

  return (
    <div className="flex flex-col items-end gap-1.5">
      <div className="flex items-center gap-1.5">
        <input
          value={shares}
          onChange={(e) => setShares(e.target.value)}
          aria-label="Shares to sell"
          placeholder="shares"
          className="w-20 rounded-md border border-card-border bg-transparent px-2 py-1 text-right text-xs"
        />
        <span className="text-xs text-muted">@</span>
        <input
          value={price}
          onChange={(e) => setPrice(e.target.value)}
          aria-label="Limit price, 0 to 1"
          placeholder="0.50"
          className="w-16 rounded-md border border-card-border bg-transparent px-2 py-1 text-right text-xs"
        />
        <button
          type="button"
          onClick={() => void submit()}
          disabled={busy || !priceOk || !sharesOk}
          className="rounded-md bg-brand px-2.5 py-1 text-xs font-semibold text-white disabled:opacity-50"
        >
          {busy ? "Placing…" : "Place"}
        </button>
        <button
          type="button"
          onClick={onCancel}
          className="rounded-md border border-card-border px-2 py-1 text-xs hover:bg-card-hover"
        >
          Cancel
        </button>
      </div>
      <p className="text-[11px] text-muted">
        {available.toLocaleString("en-US", { maximumFractionDigits: 6 })} sellable · price 0–1
      </p>
      {error && <p className="max-w-[16rem] text-right text-xs text-red">{error}</p>}
    </div>
  );
}
