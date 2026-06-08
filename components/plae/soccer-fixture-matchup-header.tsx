"use client";

import { useEffect, useState } from "react";
import {
  formatFixtureDateShort,
  formatFixtureTime,
  formatKickoffCountdown,
  type SoccerTeam,
} from "@/lib/sports-soccer";

function TeamBubble({ team }: { team: SoccerTeam }) {
  return (
    <div className="flex flex-col items-center gap-3">
      <div className="relative">
        <div className="absolute -inset-1 rounded-[1.25rem] bg-white/5 blur-md" />
        <div className="relative flex h-[5.5rem] w-[5.5rem] items-center justify-center overflow-hidden rounded-2xl border border-white/10 bg-card shadow-[0_10px_40px_rgba(0,0,0,0.45),inset_0_1px_0_rgba(255,255,255,0.18)] sm:h-24 sm:w-24">
          {team.logo ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={team.logo}
              alt=""
              className="h-14 w-14 object-contain sm:h-16 sm:w-16"
            />
          ) : (
            <div className="h-14 w-14 rounded-xl bg-card-border/60 sm:h-16 sm:w-16" />
          )}
          <div className="pointer-events-none absolute inset-0 rounded-2xl bg-gradient-to-b from-white/30 via-white/5 to-black/25" />
        </div>
      </div>
      <span className="max-w-[7rem] text-center text-sm font-medium leading-tight text-foreground">
        {team.name}
      </span>
    </div>
  );
}

function KickoffCenter({ kickoff }: { kickoff: Date | null }) {
  if (!kickoff) {
    return (
      <div className="text-center">
        <p className="text-lg font-bold text-foreground">TBD</p>
      </div>
    );
  }

  return (
    <div className="text-center">
      <p className="text-xl font-bold text-foreground sm:text-2xl">
        {formatFixtureTime(kickoff)}
      </p>
      <p className="mt-1 text-sm text-muted">{formatFixtureDateShort(kickoff)}</p>
    </div>
  );
}

export function SoccerFixtureMatchupHeader({
  home,
  away,
  kickoff,
}: {
  home: SoccerTeam;
  away: SoccerTeam;
  kickoff: Date | null;
}) {
  const [countdown, setCountdown] = useState(() =>
    formatKickoffCountdown(kickoff),
  );

  useEffect(() => {
    setCountdown(formatKickoffCountdown(kickoff));
    const timer = setInterval(() => {
      setCountdown(formatKickoffCountdown(kickoff));
    }, 60_000);
    return () => clearInterval(timer);
  }, [kickoff]);

  return (
    <header className="mb-2">
      <h1 className="text-2xl font-bold tracking-tight text-foreground sm:text-3xl">
        {home.name} vs {away.name}
      </h1>

      {countdown ? (
        <div className="mt-2 flex items-center gap-1.5 text-sm text-muted">
          <svg
            className="h-4 w-4 shrink-0"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            strokeWidth={1.75}
          >
            <circle cx="12" cy="12" r="9" />
            <path d="M12 7v5l3 2" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
          <span>{countdown}</span>
        </div>
      ) : null}

      <hr className="my-6 border-card-border" />

      <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-4 sm:gap-8">
        <div className="flex justify-center sm:justify-end">
          <TeamBubble team={home} />
        </div>
        <KickoffCenter kickoff={kickoff} />
        <div className="flex justify-center sm:justify-start">
          <TeamBubble team={away} />
        </div>
      </div>
    </header>
  );
}
