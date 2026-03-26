"use client";

import { useEffect, useCallback } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useMarketWS } from "@/components/providers/market-ws-provider";
import { useDataSource } from "@/components/providers/data-source-provider";
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
    queryFn: () => getOrderBook(buildClobUrl, tokenId!),
    refetchInterval: 60_000,
    enabled: !!tokenId,
  });

  const handleBook: MarketEventCallback = useCallback(
    (data) => {
      if (data.asset_id !== tokenId) return;
      const book: OrderBook = {
        market: (data.market as string) ?? "",
        asset_id: data.asset_id as string,
        hash: (data.hash as string) ?? "",
        timestamp: (data.timestamp as string) ?? new Date().toISOString(),
        bids: (data.bids as OrderBook["bids"]) ?? [],
        asks: (data.asks as OrderBook["asks"]) ?? [],
      };
      queryClient.setQueryData(["orderbook", tokenId], book);
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
    };
  }, [tokenId, ws, handleBook]);

  return query;
}
