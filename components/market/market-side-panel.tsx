"use client";

import {
  ResolutionPendingPanel,
  ResolutionResolvedPanel,
} from "@/components/market/resolution-panel";
import { TradePanel } from "@/components/market/trade-panel";
import { useMarketResolution } from "@/lib/hooks/use-market-resolution";
import type { GammaEvent, GammaMarket } from "@/lib/types/event";

export function MarketSidePanel({
  market,
  event,
  yesTokenId,
  noTokenId,
  initialYesPrice,
  initialNoPrice,
  outcomeLabels,
  tickSize,
  minOrderSize,
  onOutcomeChange,
}: {
  market: GammaMarket | undefined;
  event?: GammaEvent;
  yesTokenId: string | undefined;
  noTokenId: string | undefined;
  initialYesPrice: number;
  initialNoPrice: number;
  outcomeLabels?: [string, string];
  tickSize: number;
  minOrderSize: number;
  onOutcomeChange?: (outcome: "yes" | "no") => void;
}) {
  const { mode, outcomeText, marketQuestion } = useMarketResolution({
    market,
    event,
    yesTokenId,
    noTokenId,
  });

  if (mode === "resolution-pending") {
    return <ResolutionPendingPanel marketQuestion={marketQuestion} />;
  }

  if (mode === "resolution-resolved" && outcomeText) {
    return (
      <ResolutionResolvedPanel
        marketQuestion={marketQuestion}
        outcomeText={outcomeText}
      />
    );
  }

  return (
    <TradePanel
      yesTokenId={yesTokenId}
      noTokenId={noTokenId}
      initialYesPrice={initialYesPrice}
      initialNoPrice={initialNoPrice}
      outcomeLabels={outcomeLabels}
      tickSize={tickSize}
      minOrderSize={minOrderSize}
      onOutcomeChange={onOutcomeChange}
    />
  );
}
