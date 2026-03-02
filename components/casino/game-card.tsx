import Link from "next/link";
import type { CasinoGame } from "@/lib/data/casino-games";

export function GameCard({ game }: { game: CasinoGame }) {
  return (
    <Link
      href={game.href}
      className="group flex flex-col rounded-2xl border border-card-border bg-card transition-all hover:border-brand/30 hover:bg-card-hover"
    >
      {/* Gradient image placeholder */}
      <div
        className={`relative flex h-28 w-full items-center justify-center overflow-hidden rounded-t-2xl bg-gradient-to-br ${game.gradient}`}
      >
        <svg
          className="h-12 w-12 text-white/30 transition-transform duration-300 group-hover:scale-110"
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
          strokeWidth={1.5}
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <path d={game.icon} />
        </svg>
      </div>

      <div className="flex flex-1 flex-col p-4">
        {/* Title */}
        <h3 className="mb-1 text-sm font-semibold leading-snug text-foreground">
          {game.title}
        </h3>

        {/* Description */}
        <p className="mb-3 text-xs text-muted">{game.description}</p>

        {/* Spacer */}
        <div className="mt-auto" />

        {/* Coming Soon badge */}
        {game.comingSoon && (
          <div className="flex">
            <span className="rounded-lg bg-brand/10 px-3 py-1.5 text-xs font-medium text-brand">
              Coming Soon
            </span>
          </div>
        )}
      </div>
    </Link>
  );
}
