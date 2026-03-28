import Link from "next/link";
import Image from "next/image";
import type { CasinoGame } from "@/lib/data/casino-games";

const accentMap: Record<string, { glow: string; badge: string; border: string }> = {
  emerald: { glow: "shadow-emerald-500/20", badge: "bg-emerald-500/10 text-emerald-400", border: "hover:border-emerald-500/40" },
  red:     { glow: "shadow-red-500/20",     badge: "bg-red-500/10 text-red-400",         border: "hover:border-red-500/40" },
  amber:   { glow: "shadow-amber-500/20",   badge: "bg-amber-500/10 text-amber-400",     border: "hover:border-amber-500/40" },
  blue:    { glow: "shadow-blue-500/20",     badge: "bg-blue-500/10 text-blue-400",       border: "hover:border-blue-500/40" },
  purple:  { glow: "shadow-purple-500/20",   badge: "bg-purple-500/10 text-purple-400",   border: "hover:border-purple-500/40" },
  teal:    { glow: "shadow-teal-500/20",     badge: "bg-teal-500/10 text-teal-400",       border: "hover:border-teal-500/40" },
  pink:    { glow: "shadow-pink-500/20",     badge: "bg-pink-500/10 text-pink-400",       border: "hover:border-pink-500/40" },
  yellow:  { glow: "shadow-yellow-500/20",   badge: "bg-yellow-500/10 text-yellow-400",   border: "hover:border-yellow-500/40" },
};

export function GameCard({ game }: { game: CasinoGame }) {
  const colors = accentMap[game.accent] ?? accentMap.blue;

  return (
    <Link
      href={game.href}
      className={`group relative flex flex-col overflow-hidden rounded-2xl border border-card-border bg-card transition-all duration-300 hover:bg-card-hover hover:shadow-xl ${colors.glow} ${colors.border}`}
    >
      {/* Image */}
      <div className="relative h-40 w-full overflow-hidden">
        <Image
          src={game.image}
          alt={game.title}
          fill
          className="object-cover transition-transform duration-500 group-hover:scale-110"
          sizes="(max-width: 768px) 100vw, (max-width: 1024px) 50vw, 25vw"
        />
        <div className="absolute inset-0 bg-gradient-to-t from-card via-card/40 to-transparent" />

        {/* Category pill */}
        <div className="absolute left-3 top-3">
          <span className={`rounded-full px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider ${colors.badge}`}>
            {game.category}
          </span>
        </div>
      </div>

      <div className="flex flex-1 flex-col p-4">
        <h3 className="mb-1 text-base font-bold text-foreground">
          {game.title}
        </h3>
        <p className="mb-4 text-xs leading-relaxed text-muted">
          {game.description}
        </p>

        <div className="mt-auto" />

        {game.comingSoon ? (
          <div className="flex items-center justify-between">
            <span className={`rounded-lg px-3 py-1.5 text-xs font-semibold ${colors.badge}`}>
              Coming Soon
            </span>
            <svg
              className="h-5 w-5 text-muted/40 transition-transform duration-300 group-hover:translate-x-1 group-hover:text-muted"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              strokeWidth={2}
            >
              <path d="M9 5l7 7-7 7" />
            </svg>
          </div>
        ) : (
          <button className={`w-full rounded-xl py-2.5 text-sm font-bold text-white bg-gradient-to-r ${game.gradient} transition-shadow hover:shadow-lg ${colors.glow}`}>
            Play Now
          </button>
        )}
      </div>
    </Link>
  );
}
