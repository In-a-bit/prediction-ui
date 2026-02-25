"use client";

import { useQuery } from "@tanstack/react-query";
import type { PriceHistoryPoint } from "@/lib/types/orderbook";

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
  return useQuery({
    queryKey: ["midpoint", tokenId],
    queryFn: () => getMidpoint(tokenId!),
    enabled: !!tokenId,
    refetchInterval: 5000,
  });
}
