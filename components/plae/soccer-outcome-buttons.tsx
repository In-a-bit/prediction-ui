"use client";

import { useOutcomePrices } from "@/lib/hooks/use-outcome-prices";
import { parsePrices, parseTokenIds } from "@/lib/market/gamma-helpers";
import type { GammaMarket } from "@/lib/types/event";
import {
  SOCCER_OUTCOME_ORDER,
  teamAbbrev,
  type SoccerMarketGroup,
  type SoccerOutcomeKey,
  type SoccerTeam,
} from "@/lib/sports-soccer";
import { cn } from "@/lib/utils";

const OUTCOME_BUTTON_CLASS: Record<SoccerOutcomeKey, string> = {
  home: "bg-card-border/70 text-foreground hover:bg-card-hover",
  draw: "bg-card-border/70 text-foreground hover:bg-card-hover",
  away: "bg-card-border/70 text-foreground hover:bg-card-hover",
};

function outcomeLabel(
  outcomeKey: SoccerOutcomeKey,
  home: SoccerTeam,
  away: SoccerTeam,
): string {
  if (outcomeKey === "draw") return "DRAW";
  return teamAbbrev(outcomeKey === "home" ? home : away);
}

function formatCentsDisplay(cents: number): string {
  if (!Number.isFinite(cents) || cents <= 0) return "—";
  if (Number.isInteger(cents)) return `${cents}¢`;
  return `${parseFloat(cents.toFixed(1))}¢`;
}

function SoccerOutcomeButton({
  market,
  outcomeKey,
  home,
  away,
  isSelected,
  onSelect,
}: {
  market: GammaMarket;
  outcomeKey: SoccerOutcomeKey;
  home: SoccerTeam;
  away: SoccerTeam;
  isSelected: boolean;
  onSelect: (market: GammaMarket) => void;
}) {
  const tokenIds = parseTokenIds(market);
  const { yes: initialYes, no: initialNo } = parsePrices(market);
  const { yesPrice } = useOutcomePrices({
    yesTokenId: tokenIds[0],
    noTokenId: tokenIds[1],
    side: "buy",
    initialYesPrice: initialYes,
    initialNoPrice: initialNo,
  });

  const label = outcomeLabel(outcomeKey, home, away);

  return (
    <button
      type="button"
      onClick={() => onSelect(market)}
      className={cn(
        "flex min-w-[6.5rem] items-center justify-between rounded-xl px-4 py-3 text-sm font-semibold transition-colors",
        isSelected
          ? "bg-green text-white hover:bg-green/90"
          : OUTCOME_BUTTON_CLASS[outcomeKey],
      )}
    >
      <span>{label}</span>
      <span>{formatCentsDisplay(yesPrice)}</span>
    </button>
  );
}

export function SoccerOutcomeButtons({
  group,
  home,
  away,
  selectedMarketId,
  onSelect,
}: {
  group: SoccerMarketGroup;
  home: SoccerTeam;
  away: SoccerTeam;
  selectedMarketId: string | null;
  onSelect: (market: GammaMarket) => void;
}) {
  return (
    <div className="flex flex-wrap gap-2">
      {SOCCER_OUTCOME_ORDER.map((outcomeKey) => {
        const market = group[outcomeKey];
        if (!market) return null;

        return (
          <SoccerOutcomeButton
            key={outcomeKey}
            market={market}
            outcomeKey={outcomeKey}
            home={home}
            away={away}
            isSelected={selectedMarketId === String(market.id)}
            onSelect={onSelect}
          />
        );
      })}
    </div>
  );
}
