"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useMarketWS } from "@/components/providers/market-ws-provider";
import { useOrderBook } from "@/lib/hooks/use-orderbook";
import { parseWireDecimal } from "@/lib/parse-wire-decimal";
import type { OrderBook } from "@/lib/types/orderbook";

type TradeSide = "buy" | "sell";

type TokenQuotes = {
  bestBidCents: number;
  bestAskCents: number;
};

function centsFromField(raw: unknown): number | null {
  const s = typeof raw === "string" ? raw : "";
  const n = parseWireDecimal(s);
  if (n <= 0 || n >= 1) return null;
  return Math.round(n * 100);
}

/** Best bid = highest bid; best ask = lowest ask (matches order book UI). */
export function quotesFromBook(book: OrderBook | undefined): TokenQuotes | null {
  if (!book) return null;

  let bestBidCents = 0;
  let bestAskCents = 0;

  for (const level of book.bids ?? []) {
    const c = centsFromField(level.price);
    if (c !== null && c > bestBidCents) bestBidCents = c;
  }
  for (const level of book.asks ?? []) {
    const c = centsFromField(level.price);
    if (c !== null && (bestAskCents === 0 || c < bestAskCents)) bestAskCents = c;
  }

  if (bestBidCents === 0 && bestAskCents === 0) return null;
  return { bestBidCents, bestAskCents };
}

function mergeQuotes(prev: TokenQuotes, next: TokenQuotes): TokenQuotes {
  return {
    bestBidCents: next.bestBidCents > 0 ? next.bestBidCents : prev.bestBidCents,
    bestAskCents: next.bestAskCents > 0 ? next.bestAskCents : prev.bestAskCents,
  };
}

function pickQuoteCents(
  q: TokenQuotes,
  tradeSide: TradeSide,
  fallbackCents: number
): number {
  const cents = tradeSide === "buy" ? q.bestAskCents : q.bestBidCents;
  return cents > 0 ? cents : fallbackCents;
}

const emptyQuotes: TokenQuotes = { bestBidCents: 0, bestAskCents: 0 };

/**
 * Yes/No button prices: REST book for initial bid/ask, then WS price_change / best_bid_ask.
 * Gamma outcomePrices are midpoints only — not used as bid/ask.
 */
export function useOutcomePrices({
  yesTokenId,
  noTokenId,
  side,
  initialYesPrice,
  initialNoPrice,
}: {
  yesTokenId: string | undefined;
  noTokenId: string | undefined;
  side: TradeSide;
  initialYesPrice: number;
  initialNoPrice: number;
}) {
  const ws = useMarketWS();
  const { data: yesBook } = useOrderBook(yesTokenId);
  const { data: noBook } = useOrderBook(noTokenId);

  const [quotes, setQuotes] = useState({
    yes: emptyQuotes,
    no: emptyQuotes,
  });

  useEffect(() => {
    setQuotes({ yes: emptyQuotes, no: emptyQuotes });
  }, [yesTokenId, noTokenId]);

  useEffect(() => {
    const yesQ = quotesFromBook(yesBook);
    const noQ = quotesFromBook(noBook);
    if (!yesQ && !noQ) return;
    setQuotes((q) => ({
      yes: yesQ ? mergeQuotes(q.yes, yesQ) : q.yes,
      no: noQ ? mergeQuotes(q.no, noQ) : q.no,
    }));
  }, [yesBook, noBook]);

  const applyQuote = useCallback(
    (data: Record<string, unknown>) => {
      const assetId =
        typeof data.asset_id === "string" ? data.asset_id : undefined;
      if (!assetId) return;

      const bid = centsFromField(data.best_bid);
      const ask = centsFromField(data.best_ask);
      if (bid === null && ask === null) return;

      const patch: TokenQuotes = {
        bestBidCents: bid ?? 0,
        bestAskCents: ask ?? 0,
      };

      if (assetId === yesTokenId) {
        setQuotes((q) => ({ ...q, yes: mergeQuotes(q.yes, patch) }));
      } else if (assetId === noTokenId) {
        setQuotes((q) => ({ ...q, no: mergeQuotes(q.no, patch) }));
      }
    },
    [yesTokenId, noTokenId]
  );

  useEffect(() => {
    if (!yesTokenId && !noTokenId) return;

    if (yesTokenId) ws.subscribe(yesTokenId);
    if (noTokenId) ws.subscribe(noTokenId);

    ws.on("price_change", applyQuote);
    ws.on("best_bid_ask", applyQuote);

    return () => {
      ws.off("price_change", applyQuote);
      ws.off("best_bid_ask", applyQuote);
      if (yesTokenId) ws.unsubscribe(yesTokenId);
      if (noTokenId) ws.unsubscribe(noTokenId);
    };
  }, [yesTokenId, noTokenId, ws, applyQuote]);

  const yesPrice = useMemo(
    () => pickQuoteCents(quotes.yes, side, initialYesPrice),
    [quotes.yes, side, initialYesPrice]
  );

  const noPrice = useMemo(
    () => pickQuoteCents(quotes.no, side, initialNoPrice),
    [quotes.no, side, initialNoPrice]
  );

  return { yesPrice, noPrice };
}
