"use client";

import { useQuery } from "@tanstack/react-query";
import type { OrderBook } from "@/lib/types/orderbook";

async function getOrderBook(tokenId: string): Promise<OrderBook> {
  const res = await fetch(
    `/api/clob?endpoint=book&token_id=${tokenId}`
  );
  if (!res.ok) throw new Error("Failed to fetch order book");
  return res.json();
}

export function useOrderBook(tokenId: string | undefined) {
  return useQuery({
    queryKey: ["orderbook", tokenId],
    queryFn: () => getOrderBook(tokenId!),
    refetchInterval: 5000,
    enabled: !!tokenId,
  });
}
