"use client";

import { useEffect, useCallback } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useMarketWS } from "@/components/providers/market-ws-provider";
import type { PriceHistoryPoint } from "@/lib/types/orderbook";
import type { MarketEventCallback } from "@/lib/ws/market-ws";

async function getPriceHistory(
  tokenId: string,
  fidelity: number = 60,
  days: number = 7
): Promise<PriceHistoryPoint[]> {
  const now = Math.floor(Date.now() / 1000);
  const startTs = now - days * 24 * 60 * 60;

  const params = new URLSearchParams({
    endpoint: "prices-history",
    token_id: tokenId,
    startTs: String(startTs),
    endTs: String(now),
    fidelity: String(fidelity),
  });

  const res = await fetch(`/api/clob?${params}`);
  if (!res.ok) return [];
  const data = await res.json();
  return data.history ?? [];
}

async function getMidpoint(tokenId: string): Promise<number> {
  const res = await fetch(
    `/api/clob?endpoint=midpoint&token_id=${tokenId}`
  );
  if (!res.ok) return 0;
  const data = await res.json();
  return parseFloat(data.mid);
}

export function usePriceHistory(
  tokenId: string | undefined,
  fidelity: number = 60,
  days: number = 7
) {
  return useQuery({
    queryKey: ["priceHistory", tokenId, fidelity, days],
    queryFn: () => getPriceHistory(tokenId!, fidelity, days),
    enabled: !!tokenId,
    refetchInterval: 30000,
  });
}

export function useMidpoint(tokenId: string | undefined) {
  const queryClient = useQueryClient();
  const ws = useMarketWS();

  const query = useQuery({
    queryKey: ["midpoint", tokenId],
    queryFn: () => getMidpoint(tokenId!),
    enabled: !!tokenId,
    refetchInterval: 60_000,
  });

  const handleBestBidAsk: MarketEventCallback = useCallback(
    (data) => {
      if (data.asset_id !== tokenId) return;
      const bestBid = parseFloat(data.best_bid as string);
      const bestAsk = parseFloat(data.best_ask as string);
      if (!isNaN(bestBid) && !isNaN(bestAsk)) {
        queryClient.setQueryData(
          ["midpoint", tokenId],
          (bestBid + bestAsk) / 2
        );
      }
    },
    [tokenId, queryClient]
  );

  const handlePriceChange: MarketEventCallback = useCallback(
    (data) => {
      if (data.asset_id !== tokenId) return;
      const bestBid = parseFloat(data.best_bid as string);
      const bestAsk = parseFloat(data.best_ask as string);
      if (!isNaN(bestBid) && !isNaN(bestAsk)) {
        queryClient.setQueryData(
          ["midpoint", tokenId],
          (bestBid + bestAsk) / 2
        );
      }
    },
    [tokenId, queryClient]
  );

  useEffect(() => {
    if (!tokenId) return;
    ws.subscribe(tokenId);
    ws.on("best_bid_ask", handleBestBidAsk);
    ws.on("price_change", handlePriceChange);
    return () => {
      ws.off("best_bid_ask", handleBestBidAsk);
      ws.off("price_change", handlePriceChange);
      ws.unsubscribe(tokenId);
    };
  }, [tokenId, ws, handleBestBidAsk, handlePriceChange]);

  return query;
}
