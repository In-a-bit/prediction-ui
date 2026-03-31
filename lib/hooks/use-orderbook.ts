"use client";

import { useEffect, useCallback, useRef } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useMarketWS } from "@/components/providers/market-ws-provider";
import { useDataSource } from "@/components/providers/data-source-provider";
import {
  normalizeRestBookLevel,
  normalizeWsBookLevel,
} from "@/lib/orderbook-scaled";
import type { OrderBook } from "@/lib/types/orderbook";
import type { MarketEventCallback } from "@/lib/ws/market-ws";

type BuildClobUrl = (endpoint: string, params: Record<string, string>) => string;

async function getOrderBook(
  buildClobUrl: BuildClobUrl,
  tokenId: string
): Promise<OrderBook> {
  const url = buildClobUrl("book", { token_id: tokenId });
  const res = await fetch(url);
  if (!res.ok) throw new Error("Failed to fetch order book");
  return res.json();
}

export function useOrderBook(tokenId: string | undefined) {
  const queryClient = useQueryClient();
  const ws = useMarketWS();
  const { buildClobUrl } = useDataSource();

  const query = useQuery({
    queryKey: ["orderbook", tokenId],
    queryFn: async () => {
      const book = await getOrderBook(buildClobUrl, tokenId!);
      return {
        ...book,
        bids: book.bids.map((e) => normalizeRestBookLevel(e)),
        asks: book.asks.map((e) => normalizeRestBookLevel(e)),
      };
    },
    // Live `book` events replace the cache; polling/focus refetch caused visible “jumping”
    // when timing raced the WebSocket or replayed slightly different snapshots.
    staleTime: Infinity,
    refetchOnWindowFocus: false,
    refetchOnReconnect: false,
    refetchInterval: false,
    enabled: !!tokenId,
  });

  // Debounce REST refetches triggered by paired-token book events.
  const refetchDebounce = useRef<ReturnType<typeof setTimeout> | null>(null);

  const handleBook: MarketEventCallback = useCallback(
    (data) => {
      if (data.asset_id === tokenId) {
        // Direct cache update from matching WS event (instant).
        const rawBids = (data.bids as OrderBook["bids"]) ?? [];
        const rawAsks = (data.asks as OrderBook["asks"]) ?? [];
        const toLevel = (e: OrderBook["bids"][number]) =>
          normalizeWsBookLevel({
            price: String(e.price),
            size: String(e.size),
          });
        const book: OrderBook = {
          market: (data.market as string) ?? "",
          asset_id: data.asset_id as string,
          hash: (data.hash as string) ?? "",
          timestamp: (data.timestamp as string) ?? new Date().toISOString(),
          bids: rawBids.map(toLevel),
          asks: rawAsks.map(toLevel),
        };
        queryClient.setQueryData(["orderbook", tokenId], book);
      } else {
        // Paired token book changed — our book likely changed too.
        // Refetch from REST (debounced to avoid hammering the API).
        if (refetchDebounce.current) return;
        refetchDebounce.current = setTimeout(() => {
          refetchDebounce.current = null;
        }, 1000);
        queryClient.invalidateQueries({ queryKey: ["orderbook", tokenId] });
      }
    },
    [tokenId, queryClient]
  );

  useEffect(() => {
    if (!tokenId) return;
    ws.subscribe(tokenId);
    ws.on("book", handleBook);
    return () => {
      ws.off("book", handleBook);
      ws.unsubscribe(tokenId);
      if (refetchDebounce.current) {
        clearTimeout(refetchDebounce.current);
        refetchDebounce.current = null;
      }
    };
  }, [tokenId, ws, handleBook]);

  return query;
}
