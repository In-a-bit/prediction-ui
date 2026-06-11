"use client";

import { useMemo, useState } from "react";
import { usePlaeEvents } from "@/lib/hooks/use-plae-events";
import { buildSoccerGameView, groupGamesByDate } from "@/lib/sports-soccer";
import { PlaeSoccerGameCard } from "./plae-soccer-game-card";

const PAGE_SIZE = 12;

interface PlaeSoccerGameListProps {
  tagSlug: string;
}

export function PlaeSoccerGameList({ tagSlug }: PlaeSoccerGameListProps) {
  const [page, setPage] = useState(0);

  const { data, isLoading } = usePlaeEvents({
    active: true,
    group_by_series: false,
    tag_slug: tagSlug,
    order: "start_time",
    ascending: true,
    limit: PAGE_SIZE,
    offset: page * PAGE_SIZE,
  });

  const games = useMemo(() => {
    return (data?.events ?? [])
      .map(buildSoccerGameView)
      .filter((game): game is NonNullable<typeof game> => game != null);
  }, [data?.events]);

  const groupedGames = useMemo(() => groupGamesByDate(games), [games]);
  const hasMore = data?.hasMore ?? false;

  if (!games.length && !isLoading) {
    return (
      <div className="flex flex-col items-center justify-center rounded-2xl border border-card-border bg-card px-8 py-16">
        <p className="text-sm text-muted">No games found</p>
      </div>
    );
  }

  return (
    <div>
      {isLoading ? (
        <div className="space-y-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <div
              key={i}
              className="h-36 animate-pulse rounded-2xl border border-card-border bg-card"
            />
          ))}
        </div>
      ) : (
        <div className="space-y-8">
          {groupedGames.map((group) => (
            <section key={group.label}>
              <h2 className="mb-4 text-lg font-bold text-foreground">
                {group.label}
              </h2>
              <div className="space-y-3">
                {group.games.map((game) => (
                  <PlaeSoccerGameCard key={game.event.id} game={game} />
                ))}
              </div>
            </section>
          ))}
        </div>
      )}

      <div className="mt-6 flex items-center justify-center gap-3">
        <button
          onClick={() => setPage((p) => Math.max(0, p - 1))}
          disabled={page === 0}
          className="rounded-xl border border-card-border px-4 py-2 text-sm font-medium text-foreground transition-colors hover:bg-card-hover disabled:cursor-not-allowed disabled:opacity-40"
        >
          Previous
        </button>
        <span className="text-sm text-muted">Page {page + 1}</span>
        <button
          onClick={() => setPage((p) => p + 1)}
          disabled={!hasMore}
          className="rounded-xl border border-card-border px-4 py-2 text-sm font-medium text-foreground transition-colors hover:bg-card-hover disabled:cursor-not-allowed disabled:opacity-40"
        >
          Next
        </button>
      </div>
    </div>
  );
}
