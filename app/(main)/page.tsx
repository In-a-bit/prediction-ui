import { GameGrid } from "@/components/casino/game-grid";

export default function CasinoPage() {
  return (
    <>
      {/* Hero */}
      <section className="mb-8">
        <h1 className="mb-2 text-2xl font-bold text-foreground">Casino</h1>
        <p className="text-sm text-muted">
          Pick a game and test your luck — more games launching soon.
        </p>
      </section>

      {/* Games Grid */}
      <section>
        <GameGrid />
      </section>
    </>
  );
}
