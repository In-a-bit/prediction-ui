import Link from "next/link";

import { ModeBadge } from "@/components/builder/mode-badge";

/**
 * The two builders, side by side.
 *
 * Fixed rather than a list from an API: the demo exists to compare exactly these two custody
 * models, and each card says what the difference means before you have signed into anything.
 */
const BUILDERS = [
  {
    mode: "segregated",
    name: "Borough Segregated",
    tagline: "Every customer holds their own USDC.",
    detail:
      "Each customer gets their own on-chain proxy wallet. Borough's ledger mirrors what the chain says — it never decides the balance, it reports it.",
  },
  {
    mode: "shared",
    name: "Acme Custody",
    tagline: "Acme holds the USDC; the ledger is the money.",
    detail:
      "One operations wallet funds every trade. A customer's balance exists only in Acme's ledger, which makes deposits instant and the ledger load-bearing.",
  },
] as const;

export default function BuilderChooserPage() {
  return (
    <div className="grid gap-4 sm:grid-cols-2">
      {BUILDERS.map((builder) => (
        <Link
          key={builder.mode}
          href={`/builder/${builder.mode}`}
          className="group flex flex-col gap-3 rounded-lg border border-card-border bg-card p-5 transition hover:border-brand hover:bg-card-hover"
        >
          <div>
            <ModeBadge mode={builder.mode} />
            <h2 className="mt-2 text-lg font-semibold">{builder.name}</h2>
          </div>
          <p className="text-sm">{builder.tagline}</p>
          <p className="text-xs leading-relaxed text-muted">{builder.detail}</p>
          <span className="mt-auto text-xs font-medium text-brand group-hover:underline">
            Visit their site →
          </span>
        </Link>
      ))}
    </div>
  );
}
