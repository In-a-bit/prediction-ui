"use client";

import { useEffect, useCallback, useRef } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useMarketWS } from "@/components/providers/market-ws-provider";
import { useDataSource } from "@/components/providers/data-source-provider";
import { normalizeWsPrice } from "@/lib/orderbook-scaled";
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
  if (!res.ok) return [];
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
  return parseFloat(data.mid);
}

export function usePriceHistory(
  tokenId: string | undefined,
  fidelity: number = 60,
  days: number = 7
) {
  const queryClient = useQueryClient();
  const ws = useMarketWS();
  const { buildClobUrl } = useDataSource();
  // Debounce rapid book events — refetch at most once per second.
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const query = useQuery({
    queryKey: ["priceHistory", tokenId, fidelity, days],
    queryFn: () => getPriceHistory(buildClobUrl, tokenId!, fidelity, days),
    enabled: !!tokenId,
    staleTime: Infinity,
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
    refetchInterval: 60_000,
  });

  const handleBestBidAsk: MarketEventCallback = useCallback(
    (data) => {
      if (data.asset_id !== tokenId) return;
      const bestBid = normalizeWsPrice(data.best_bid as string);
      const bestAsk = normalizeWsPrice(data.best_ask as string);
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
      const bestBid = normalizeWsPrice(data.best_bid as string);
      const bestAsk = normalizeWsPrice(data.best_ask as string);
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
