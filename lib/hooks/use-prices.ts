"use client";

import { useEffect, useCallback, useRef, useState } from "react";
import { useQuery, useQueryClient, keepPreviousData } from "@tanstack/react-query";
import { useMarketWS } from "@/components/providers/market-ws-provider";
import { useDataSource } from "@/components/providers/data-source-provider";
import { parseWireDecimal } from "@/lib/parse-wire-decimal";
import type { PriceHistoryPoint } from "@/lib/types/orderbook";
import type { MarketEventCallback } from "@/lib/ws/market-ws";

type BuildClobUrl = (endpoint: string, params: Record<string, string>) => string;

async function getPriceHistory(
  buildClobUrl: BuildClobUrl,
  tokenId: string,
  fidelity: number = 60,
  days: number = 7
): Promise<PriceHistoryPoint[]> {
  const now = Math.floor(Date.now() / 1000);
  const startTs = now - days * 24 * 60 * 60;

  const url = buildClobUrl("prices-history", {
    token_id: tokenId,
    startTs: String(startTs),
    endTs: String(now),
    fidelity: String(fidelity),
  });

  const res = await fetch(url);
  if (!res.ok) {
    console.warn("[getPriceHistory] request failed", {
      tokenId,
      days,
      fidelity,
      status: res.status,
    });
    throw new Error(`Price history request failed (${res.status})`);
  }
  const data = await res.json();
  return data.history ?? [];
}

async function getMidpoint(
  buildClobUrl: BuildClobUrl,
  tokenId: string
): Promise<number> {
  const url = buildClobUrl("midpoint", { token_id: tokenId });
  const res = await fetch(url);
  if (!res.ok) return 0;
  const data = await res.json();
  return parseWireDecimal(data.mid);
}

function wireStr(v: unknown): string {
  return typeof v === "string" ? v : "";
}

function midpointFromBestBidAsk(data: Record<string, unknown>): number | null {
  const bestBid = parseWireDecimal(wireStr(data.best_bid));
  const bestAsk = parseWireDecimal(wireStr(data.best_ask));
  if (bestBid > 0 && bestAsk > 0) {
    return (bestBid + bestAsk) / 2;
  }
  if (bestBid > 0) return bestBid;
  if (bestAsk > 0) return bestAsk;
  return null;
}

export function usePriceHistory(
  tokenId: string | undefined,
  fidelity: number = 60,
  days: number = 7
) {
  const queryClient = useQueryClient();
  const ws = useMarketWS();
  const { buildClobUrl } = useDataSource();
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const query = useQuery({
    queryKey: ["priceHistory", tokenId, fidelity, days],
    queryFn: () => getPriceHistory(buildClobUrl, tokenId!, fidelity, days),
    enabled: !!tokenId,
    staleTime: 30_000,
    placeholderData: keepPreviousData,
    retry: 1,
    refetchOnWindowFocus: false,
    refetchInterval: false,
  });

  const handleBook: MarketEventCallback = useCallback(
    (data) => {
      if (data.asset_id !== tokenId) return;
      if (debounceRef.current) return;
      debounceRef.current = setTimeout(() => {
        debounceRef.current = null;
      }, 1000);
      queryClient.invalidateQueries({
        queryKey: ["priceHistory", tokenId, fidelity, days],
      });
    },
    [tokenId, fidelity, days, queryClient]
  );

  useEffect(() => {
    if (!tokenId) return;
    ws.subscribe(tokenId);
    ws.on("book", handleBook);
    return () => {
      ws.off("book", handleBook);
      ws.unsubscribe(tokenId);
      if (debounceRef.current) {
        clearTimeout(debounceRef.current);
        debounceRef.current = null;
      }
    };
  }, [tokenId, ws, handleBook]);

  return query;
}

export function useMidpoint(tokenId: string | undefined) {
  const queryClient = useQueryClient();
  const ws = useMarketWS();
  const { buildClobUrl } = useDataSource();

  const query = useQuery({
    queryKey: ["midpoint", tokenId],
    queryFn: () => getMidpoint(buildClobUrl, tokenId!),
    enabled: !!tokenId,
    staleTime: Infinity,
    refetchOnWindowFocus: false,
    refetchInterval: false,
  });

  const applyMidpointFromWs = useCallback(
    (data: Record<string, unknown>) => {
      if (data.asset_id !== tokenId) return;
      const mid = midpointFromBestBidAsk(data);
      if (mid !== null) {
        queryClient.setQueryData(["midpoint", tokenId], mid);
      }
    },
    [tokenId, queryClient]
  );

  useEffect(() => {
    if (!tokenId) return;
    ws.subscribe(tokenId);
    ws.on("best_bid_ask", applyMidpointFromWs);
    ws.on("price_change", applyMidpointFromWs);
    return () => {
      ws.off("best_bid_ask", applyMidpointFromWs);
      ws.off("price_change", applyMidpointFromWs);
      ws.unsubscribe(tokenId);
    };
  }, [tokenId, ws, applyMidpointFromWs]);

  return query;
}

/**
 * Yes-token display price for moneyline / list buttons: midpoint with
 * last-trade WS updates. Not bid/ask (those belong on the trade panel).
 */
export function useYesTokenDisplayPrice(
  tokenId: string | undefined,
  initialCents: number,
): number {
  const ws = useMarketWS();
  const { data: midpoint } = useMidpoint(tokenId);
  const [lastTradeCents, setLastTradeCents] = useState<number | null>(null);

  useEffect(() => {
    setLastTradeCents(null);
  }, [tokenId]);

  const handleLastTrade = useCallback(
    (data: Record<string, unknown>) => {
      if (data.asset_id !== tokenId) return;
      const raw = typeof data.price === "string" ? data.price : "";
      const price = parseWireDecimal(raw);
      if (price <= 0 || price >= 1) return;
      setLastTradeCents(Math.round(price * 100));
    },
    [tokenId],
  );

  useEffect(() => {
    if (!tokenId) return;
    ws.on("last_trade_price", handleLastTrade);
    return () => {
      ws.off("last_trade_price", handleLastTrade);
    };
  }, [tokenId, ws, handleLastTrade]);

  if (lastTradeCents !== null) return lastTradeCents;
  if (midpoint) return Math.round(midpoint * 100);
  return initialCents;
}
