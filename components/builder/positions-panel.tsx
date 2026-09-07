import { formatShares, formatUsd } from "@/lib/builder/money";
import type { Position } from "@/lib/builder/types";

/**
 * Outcome-token holdings, as a person reads them.
 *
 * A position is stored as a token id and a size, and a token id is a 77-digit number. The question
 * and the side come from Plaee, which is the only party that can resolve them — a custody builder
 * holds no platform credential. When that lookup fails the row still appears, showing the token id
 * instead: these are shares the customer owns, and omitting them would read as "no positions",
 * which is a different and much worse statement than "we could not name this one".
 */
export function PositionsPanel({
  positions,
  title = "Positions",
  empty = "No open positions.",
}: {
  positions: Position[];
  title?: string;
  empty?: string;
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
        <ul className="divide-y divide-card-border/60 border-t border-card-border">
          {held.map((p) => (
            <PositionRow key={p.tokenId} position={p} />
          ))}
        </ul>
      )}
    </section>
  );
}

function PositionRow({ position }: { position: Position }) {
  const reserved = BigInt(position.reservedMicro || "0");
  return (
    <li className="flex items-start justify-between gap-4 px-5 py-3">
      <div className="min-w-0">
        {position.question ? (
          <p className="truncate text-sm" title={position.question}>
            {position.question}
          </p>
        ) : (
          // Not an error state: the shares are real, only the name is missing.
          <p
            className="truncate font-mono text-xs text-muted"
            title={`Token ${position.tokenId} — the market could not be reached, so this holding could not be named.`}
          >
            Token {position.tokenId.slice(0, 10)}…
          </p>
        )}
        {position.outcome && (
          <span className="mt-1 inline-block rounded border border-card-border px-1.5 py-0.5 text-[11px] uppercase tracking-wide text-muted">
            {position.outcome}
          </span>
        )}
      </div>

      <div className="shrink-0 text-right">
        <p className="font-mono text-sm">{formatShares(position.sizeMicro)}</p>
        <p className="text-[11px] text-muted">shares</p>
        {reserved > 0n && (
          <p
            className="mt-0.5 text-[11px] text-muted"
            title="Shares put up against an open sell order. Still theirs, just not sellable twice."
          >
            {formatShares(position.reservedMicro)} held
          </p>
        )}
      </div>
    </li>
  );
}

/** Shown when the whole set came back unnamed, so the reason is stated once rather than per row. */
export function PositionsUnnamedNote({ named }: { named: boolean }) {
  if (named) return null;
  return (
    <p className="px-5 pb-3 text-xs text-red">
      Showing token ids — Plaee could not be reached to name these markets.
    </p>
  );
}

/** Re-exported so a caller rendering a single figure does not reach past this module. */
export { formatUsd };
