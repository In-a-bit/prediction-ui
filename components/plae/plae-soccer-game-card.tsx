"use client";

import Link from "next/link";
import type { GammaMarket } from "@/lib/types/event";
import {
  formatFixtureTime,
  formatGameVolume,
  formatYesPriceCents,
  teamAbbrev,
  type SoccerGameView,
  type SoccerOutcomeKey,
} from "@/lib/sports-soccer";
import { cn } from "@/lib/utils";
import { useMarketSurface } from "@/components/providers/market-surface-provider";

const OUTCOME_ORDER: SoccerOutcomeKey[] = ["home", "draw", "away"];

const OUTCOME_BUTTON_CLASS: Record<SoccerOutcomeKey, string> = {
  home: "bg-blue-600 text-white hover:bg-blue-500",
  draw: "bg-card-border/80 text-foreground hover:bg-card-hover",
  away: "bg-amber-600 text-white hover:bg-amber-500",
};

function OutcomeButton({
  label,
  market,
  outcomeKey,
  href,
}: {
  label: string;
  market: GammaMarket | undefined;
  outcomeKey: SoccerOutcomeKey;
  href: string;
}) {
  if (!market) {
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
        OUTCOME_BUTTON_CLASS[outcomeKey],
      )}
    >
      <span>{label}</span>
      <span>{formatYesPriceCents(market)}</span>
    </Link>
  );
}

export function PlaeSoccerGameCard({ game }: { game: SoccerGameView }) {
  const { basePath } = useMarketSurface();
  const { event, home, away, moneyline, kickoff, leagueLabel, volume, marketCount } =
    game;
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
          {OUTCOME_ORDER.map((outcomeKey) => {
            const market = moneyline[outcomeKey];
            const label =
              outcomeKey === "draw"
                ? "DRAW"
                : teamAbbrev(outcomeKey === "home" ? home : away);

            return (
              <OutcomeButton
                key={outcomeKey}
                label={label}
                market={market}
                outcomeKey={outcomeKey}
                href={eventHref}
              />
            );
          })}
        </div>
      </div>
    </div>
  );
}

function TeamRow({ team }: { team: SoccerGameView["home"] }) {
  return (
    <div className="flex items-center gap-3">
      {team.logo ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={team.logo}
          alt=""
          className="h-6 w-6 shrink-0 rounded-sm object-cover"
        />
      ) : (
        <div className="h-6 w-6 shrink-0 rounded-sm bg-card-border/60" />
      )}
      <span className="truncate text-sm font-medium text-foreground">
        {team.name}
      </span>
    </div>
  );
}
