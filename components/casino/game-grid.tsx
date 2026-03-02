import { casinoGames } from "@/lib/data/casino-games";
import { GameCard } from "./game-card";

export function GameGrid() {
  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
      {casinoGames.map((game) => (
        <GameCard key={game.id} game={game} />
      ))}
    </div>
  );
}
