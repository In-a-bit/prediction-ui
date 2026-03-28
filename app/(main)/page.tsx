import { GameGrid } from "@/components/casino/game-grid";

export default function CasinoPage() {
  return (
    <>
      {/* Hero */}
      <section className="relative mb-10 overflow-hidden rounded-2xl border border-card-border bg-gradient-to-br from-brand/20 via-card to-purple-500/10 p-8">
        <div className="absolute -right-20 -top-20 h-64 w-64 rounded-full bg-brand/10 blur-3xl" />
        <div className="absolute -bottom-16 -left-16 h-48 w-48 rounded-full bg-purple-500/10 blur-3xl" />
        <div className="relative">
          <div className="mb-2 flex items-center gap-2">
            <span className="rounded-full bg-brand/20 px-3 py-1 text-xs font-bold uppercase tracking-wider text-brand">
              Live
            </span>
          </div>
          <h1 className="mb-3 text-3xl font-extrabold tracking-tight text-foreground">
            Casino
          </h1>
          <p className="max-w-md text-sm leading-relaxed text-muted">
            Pick a game and test your luck. New games launching soon — play
            blackjack, roulette, poker, and more with your DPM balance.
          </p>
        </div>
      </section>

      {/* Games */}
      <section>
        <GameGrid />
      </section>
    </>
  );
}
