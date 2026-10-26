import Link from "next/link";

/**
 * The demo's frame: which Plaee this app is pointed at, stated and not editable.
 *
 * There is no connection form. Plaee is infrastructure the builders are already integrated with —
 * choosing it per page-load would misrepresent the relationship, and the credential that reaches
 * it belongs to the builder's backend, not to this page.
 */
export default function BuilderLayout({ children }: { children: React.ReactNode }) {
  const plaee = process.env.PLAEE_BASE_URL ?? "http://localhost:3100";

  return (
    // Wide on purpose: the Plaee frame below carries charts and fixture lists, and a builder's own
    // site would give it the page width, not a reading column.
    <div className="mx-auto w-full max-w-[1600px] space-y-4">
      <header className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-card-border bg-card px-4 py-3">
        <div>
          <Link href="/builder" className="text-sm font-semibold hover:text-brand">
            Custody builders
          </Link>
          <p className="text-xs text-muted">
            Two businesses reselling prediction markets through Plaee.
          </p>
        </div>
        <div className="text-right">
          <p className="text-[11px] uppercase tracking-wide text-muted">Plaee backend</p>
          <p className="font-mono text-xs">{plaee}</p>
        </div>
      </header>
      {children}
    </div>
  );
}
