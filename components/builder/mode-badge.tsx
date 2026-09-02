import type { BuilderMode } from "@/lib/builder/types";

/**
 * States which custody model you are looking at, and what it means for the money.
 *
 * Present on every page inside a builder rather than only on the chooser: the two builders are
 * otherwise near-identical, and "whose USDC is this" is the one fact that changes every answer on
 * the page. Reading the mode off the builder's own `/site/config` rather than the URL means the
 * badge cannot disagree with the service it describes.
 */
export function ModeBadge({ mode, className = "" }: { mode: BuilderMode; className?: string }) {
  const segregated = mode === "segregated";
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[11px] font-medium ${
        segregated
          ? "border-green/40 bg-green-dim/20 text-green"
          : "border-brand/40 bg-brand/10 text-brand"
      } ${className}`}
      title={
        segregated
          ? "Each customer holds their own USDC in a proxy wallet only they can spend from."
          : "The builder holds all the USDC in its operations wallet; the ledger is the money."
      }
    >
      <span aria-hidden="true">{segregated ? "◎" : "◍"}</span>
      {segregated ? "Segregated custody" : "Shared custody"}
    </span>
  );
}
