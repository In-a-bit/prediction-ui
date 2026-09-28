"use client";

import Link from "next/link";
import { formatFixtureTime, formatGameVolume, teamAbbrev } from "@/lib/sports-soccer";
import {
  formatOutcomePriceCents,
  type SportsGameView,
  type SportsOutcome,
} from "@/lib/sports-games";
import { cn } from "@/lib/utils";
import { useMarketSurface } from "@/components/providers/market-surface-provider";

const OUTCOME_BUTTON_CLASS: Record<SportsOutcome["key"], string> = {
  home: "bg-blue-600 text-white hover:bg-blue-500",
  draw: "bg-card-border/80 text-foreground hover:bg-card-hover",
  away: "bg-amber-600 text-white hover:bg-amber-500",
};

function outcomeLabel(
  outcome: SportsOutcome,
  home: SportsGameView["home"],
  away: SportsGameView["away"],
): string {
  if (outcome.key === "draw") return "DRAW";
  return teamAbbrev(outcome.key === "home" ? home : away);
}

function OutcomeButton({
  outcome,
  label,
  href,
}: {
  outcome: SportsOutcome;
  label: string;
  href: string;
}) {
  if (!outcome.market) {
    return (
      <div className="flex min-w-[5.5rem] flex-1 items-center justify-center rounded-lg bg-card-border/40 px-3 py-2.5 text-xs font-semibold text-muted">
        —
      </div>
    );
  }

  return (
    <Link
      href={href}
      className={cn(
        "flex min-w-[5.5rem] flex-1 items-center justify-between rounded-lg px-3 py-2.5 text-xs font-semibold transition-colors",
        OUTCOME_BUTTON_CLASS[outcome.key],
      )}
    >
      <span>{label}</span>
      <span>{formatOutcomePriceCents(outcome.market, outcome.priceIndex)}</span>
    </Link>
  );
}

function TeamRow({ team }: { team: SportsGameView["home"] }) {
  return (
    <div className="flex items-center gap-3">
      {team.logo ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={team.logo} alt="" className="h-6 w-6 shrink-0 rounded-sm object-cover" />
      ) : (
        <div className="h-6 w-6 shrink-0 rounded-sm bg-card-border/60" />
      )}
      <span className="truncate text-sm font-medium text-foreground">{team.name}</span>
    </div>
  );
}

// Generic across soccer (3 outcome buttons: home/draw/away) and the 2-way
// sports — hockey/basketball/baseball/NFL (2 buttons: home/away) — driven
// entirely by however many entries lib/sports-games.ts put in `outcomes`.
export function PlaeSportsGameCard({ game }: { game: SportsGameView }) {
  const { basePath } = useMarketSurface();
  const { event, home, away, kickoff, leagueLabel, volume, marketCount, outcomes } = game;
  const eventHref = `${basePath}/${event.slug}`;

  return (
    <div className="rounded-2xl border border-card-border bg-card p-4">
      <div className="mb-4 flex items-start justify-between gap-3">
        <div className="min-w-0 text-xs text-muted">
          <span className="font-medium text-foreground">{leagueLabel}</span>
          {kickoff ? (
            <>
              <span className="mx-1.5">·</span>
              <span>{formatFixtureTime(kickoff)}</span>
            </>
          ) : null}
          <span className="mx-1.5">·</span>
          <span>{formatGameVolume(volume)}</span>
        </div>

        <Link
          href={eventHref}
          className="flex shrink-0 items-center gap-1.5 rounded-full border border-card-border px-2.5 py-1 text-xs font-medium text-muted transition-colors hover:border-brand/40 hover:text-foreground"
        >
          {marketCount > 0 ? (
            <span className="rounded bg-card-border/60 px-1.5 py-0.5 text-[10px] font-semibold text-foreground">
              {marketCount}
            </span>
          ) : null}
          <span>Game View</span>
          <span aria-hidden>›</span>
        </Link>
      </div>

      <div className="flex items-center gap-4">
        <div className="min-w-0 flex-1 space-y-3">
          <TeamRow team={home} />
          <TeamRow team={away} />
        </div>

        <div className="flex w-full max-w-[22rem] shrink-0 gap-2">
          {outcomes.map((outcome) => (
            <OutcomeButton
              key={outcome.key}
              outcome={outcome}
              label={outcomeLabel(outcome, home, away)}
              href={eventHref}
            />
          ))}
        </div>
      </div>
    </div>
  );
}
