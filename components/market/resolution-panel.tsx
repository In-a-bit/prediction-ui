"use client";

import { cn } from "@/lib/utils";

function ResolutionPanelCard({ children }: { children: React.ReactNode }) {
  return (
    <div className="rounded-2xl border border-card-border bg-card p-6">
      {children}
    </div>
  );
}

/** Market ended; waiting for on-chain resolution. */
export function ResolutionPendingPanel({
  marketQuestion,
}: {
  marketQuestion: string;
}) {
  return (
    <ResolutionPanelCard>
      <div className="flex flex-col items-center px-2 py-6 text-center">
        <div
          className="mb-5 h-10 w-10 animate-spin rounded-full border-2 border-brand border-t-transparent"
          aria-hidden
        />
        <h3 className="text-base font-semibold text-foreground">
          Hold on, determining winner…
        </h3>
        <p className="mt-3 max-w-[280px] text-sm leading-relaxed text-muted">
          {marketQuestion}
        </p>
        <p className="mt-4 max-w-[300px] text-sm leading-relaxed text-muted/80">
          This market has ended. Final resolution will appear automatically as
          soon as it is available on-chain.
        </p>
      </div>
    </ResolutionPanelCard>
  );
}

function OutcomeCheckIcon() {
  return (
    <div
      className="mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-brand"
      aria-hidden
    >
      <svg
        className="h-6 w-6 text-white"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth={2.5}
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <path d="M5 13l4 4L19 7" />
      </svg>
    </div>
  );
}

/** Market resolved with a winning outcome. */
export function ResolutionResolvedPanel({
  marketQuestion,
  outcomeText,
  className,
}: {
  marketQuestion: string;
  outcomeText: string;
  className?: string;
}) {
  return (
    <ResolutionPanelCard>
      <div
        className={cn(
          "flex flex-col items-center px-2 py-6 text-center",
          className,
        )}
      >
        <OutcomeCheckIcon />
        <p className="text-lg font-semibold text-brand">
          Outcome: {outcomeText}
        </p>
        <p className="mt-3 max-w-[280px] text-sm leading-relaxed text-muted">
          {marketQuestion}
        </p>
      </div>
    </ResolutionPanelCard>
  );
}

