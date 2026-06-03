"use client";

import { useEffect, useMemo, useState } from "react";

import { useMarketWS } from "@/components/providers/market-ws-provider";
import { parseCryptoMetadata } from "@/lib/crypto-updown";
import {
  getWinningOutcomeLabel,
  isCryptoUpdownEvent,
  isMarketAwaitingResolution,
  isUmaResolved,
} from "@/lib/market/gamma-helpers";
import type { GammaEvent, GammaMarket } from "@/lib/types/event";
import {
  marketResolvedMatchesSubscription,
  parseMarketResolvedEvent,
} from "@/lib/ws/market-resolved";
import type { MarketEventCallback } from "@/lib/ws/market-ws";

export type MarketPanelMode = "trade" | "resolution-pending" | "resolution-resolved";

export function useMarketResolution({
  market,
  event,
  yesTokenId,
  noTokenId,
}: {
  market: GammaMarket | undefined;
  event?: GammaEvent;
  yesTokenId: string | undefined;
  noTokenId: string | undefined;
}) {
  const { on, off, subscribe, unsubscribe } = useMarketWS();
  const [wsWinningOutcome, setWsWinningOutcome] = useState<string | null>(null);

  const tokenIds = useMemo(
    () => [yesTokenId, noTokenId].filter((id): id is string => Boolean(id)),
    [yesTokenId, noTokenId],
  );

  const [nowSec, setNowSec] = useState(() => Math.floor(Date.now() / 1000));

  useEffect(() => {
    if (!event || !isCryptoUpdownEvent(event)) return;
    const meta = parseCryptoMetadata(event);
    if (!meta?.slot_end) return;
    const tick = () => setNowSec(Math.floor(Date.now() / 1000));
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, [event]);

  const slotEnded = useMemo(() => {
    if (!event || !isCryptoUpdownEvent(event)) return false;
    const meta = parseCryptoMetadata(event);
    if (!meta?.slot_end) return false;
    return nowSec >= meta.slot_end;
  }, [event, nowSec]);

  useEffect(() => {
    setWsWinningOutcome(null);
  }, [market?.id, yesTokenId, noTokenId]);

  useEffect(() => {
    if (yesTokenId) subscribe(yesTokenId);
    if (noTokenId) subscribe(noTokenId);
    return () => {
      if (yesTokenId) unsubscribe(yesTokenId);
      if (noTokenId) unsubscribe(noTokenId);
    };
  }, [subscribe, unsubscribe, yesTokenId, noTokenId]);

  useEffect(() => {
    if (tokenIds.length === 0) return;

    const handler: MarketEventCallback = (data) => {
      const evt = parseMarketResolvedEvent(data);
      const outcome = evt?.winning_outcome;
      if (typeof outcome !== "string" || outcome === "") return;
      if (!evt || !marketResolvedMatchesSubscription(evt, market, tokenIds)) {
        return;
      }
      setWsWinningOutcome((prev) => (prev === outcome ? prev : outcome));
    };

    on("market_resolved", handler);
    return () => off("market_resolved", handler);
  }, [on, off, market, tokenIds, yesTokenId, noTokenId]);

  const outcomeText = useMemo(() => {
    if (wsWinningOutcome) return wsWinningOutcome;
    return getWinningOutcomeLabel(market);
  }, [wsWinningOutcome, market]);

  const mode: MarketPanelMode = useMemo(() => {
    if (outcomeText) return "resolution-resolved";
    if (isUmaResolved(market) || isMarketAwaitingResolution(market, event, slotEnded)) {
      return "resolution-pending";
    }
    return "trade";
  }, [market, event, slotEnded, outcomeText]);

  const marketQuestion = market?.question ?? "";

  return { mode, outcomeText, marketQuestion, slotEnded };
}
