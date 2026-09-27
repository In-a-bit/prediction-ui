"use client";

import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import { useMemo } from "react";
import { useMarketSurface } from "@/components/providers/market-surface-provider";
import { fetchSeriesBySlug } from "@/lib/api/plae-gamma-series";
import { buildSoccerGameView, groupGamesByDate } from "@/lib/sports-soccer";
import type { GammaEvent } from "@/lib/types/event";
import { PlaeSoccerGameCard } from "./plae-soccer-game-card";

function gamesFromSeriesEvents(events: GammaEvent[] | undefined) {
  return (events ?? [])
    .filter((event) => event.active)
    .map(buildSoccerGameView)
    .filter((game): game is NonNullable<typeof game> => game != null);
}

export function PlaeSoccerSeriesPage({ slug }: { slug: string }) {
  const surface = useMarketSurface();
  const gammaBase = surface.serviceBase("gamma");
  const { data, isLoading } = useQuery({
    queryKey: ["soccer-series", surface.id, gammaBase, slug],
    queryFn: () =>
      fetchSeriesBySlug(slug, {
        gammaBase,
        // Empty slot_end_after means now, which drops an active game whose
        // kickoff is already past. Epoch removes that window; inactive
        // events are skipped below.
        slotEndAfter: new Date(0),
      }),
  });

  const games = useMemo(
    () => gamesFromSeriesEvents(data?.events),
    [data?.events],
  );
  const groupedGames = useMemo(() => groupGamesByDate(games), [games]);
  const title = data?.title || slug;

  return (
    <>
      <SeriesHeader
        homeHref={surface.basePath}
        homeLabel={surface.label}
        title={isLoading ? slug : title}
        missing={!isLoading && !data}
      />
      <SeriesGames isLoading={isLoading} groupedGames={groupedGames} />
    </>
  );
}

function SeriesHeader({
  homeHref,
  homeLabel,
  title,
  missing,
}: {
  homeHref: string;
  homeLabel: string;
  title: string;
  missing: boolean;
}) {
  return (
    <section className="mb-8">
      <div className="mb-2 flex items-center gap-2 text-sm text-muted">
        <Link href={homeHref} className="transition-colors hover:text-foreground">
          {homeLabel}
        </Link>
        <span>/</span>
        <span className="text-foreground">{title}</span>
      </div>
      <h1 className="mb-2 text-2xl font-bold text-foreground">{title}</h1>
      <p className="text-sm text-muted">
        {missing
          ? "This league was not found."
          : "Soccer prediction markets — moneyline prices for each match."}
      </p>
    </section>
  );
}

function SeriesGames({
  isLoading,
  groupedGames,
}: {
  isLoading: boolean;
  groupedGames: ReturnType<typeof groupGamesByDate>;
}) {
  if (isLoading) {
    return (
      <div className="space-y-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <div
            key={i}
            className="h-36 animate-pulse rounded-2xl border border-card-border bg-card"
          />
        ))}
      </div>
    );
  }
  if (groupedGames.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center rounded-2xl border border-card-border bg-card px-8 py-16">
        <p className="text-sm text-muted">No games found</p>
      </div>
    );
  }
  return <SeriesGameGroups groupedGames={groupedGames} />;
}

function SeriesGameGroups({
  groupedGames,
}: {
  groupedGames: ReturnType<typeof groupGamesByDate>;
}) {
  return (
    <div className="space-y-8">
      {groupedGames.map((group) => (
        <section key={group.label}>
          <h2 className="mb-4 text-lg font-bold text-foreground">{group.label}</h2>
          <div className="space-y-3">
            {group.games.map((game) => (
              <PlaeSoccerGameCard key={game.event.id} game={game} />
            ))}
          </div>
        </section>
      ))}
    </div>
  );
}
