"use client";

import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";

import type { OpenOrder } from "@/lib/hooks/use-open-orders";
import { predictionServiceBase } from "@/lib/prediction-proxy";

const GAMMA_API_URL = predictionServiceBase("gamma");

export interface MarketDisplayInfo {
  marketId: string;
  question: string;
  icon: string | null;
  slug: string | null;
  clobTokenIds: string[];
}

function parseClobTokenIds(raw: string | undefined): string[] {
  if (!raw) return [];
  try {
    return JSON.parse(raw) as string[];
  } catch {
    return [];
  }
}

function toDisplayInfo(market: {
  question?: string;
  icon?: string | null;
  image?: string | null;
  slug?: string | null;
  clobTokenIds?: string;
}): MarketDisplayInfo | null {
  if (!market.question) return null;
  return {
    marketId: "",
    question: market.question,
    icon: market.icon ?? market.image ?? null,
    slug: market.slug ?? null,
    clobTokenIds: parseClobTokenIds(market.clobTokenIds),
  };
}

/** Map CLOB market id → display info by matching order asset_id to clobTokenIds. */
function indexMarketsByClobMarketId(
  marketIds: string[],
  orders: OpenOrder[],
  markets: Array<{
    question?: string;
    icon?: string | null;
    image?: string | null;
    slug?: string | null;
    clobTokenIds?: string;
  }>,
): Map<string, MarketDisplayInfo> {
  const byToken = new Map<string, MarketDisplayInfo>();
  for (const market of markets) {
    const info = toDisplayInfo(market);
    if (!info) continue;
    for (const tokenId of info.clobTokenIds) {
      byToken.set(tokenId, info);
    }
  }

  const lookup = new Map<string, MarketDisplayInfo>();
  for (const marketId of marketIds) {
    const order = orders.find((item) => item.market === marketId);
    if (!order) continue;
    const info = byToken.get(order.asset_id);
    if (!info) continue;
    lookup.set(marketId, { ...info, marketId });
  }

  return lookup;
}

async function fetchMarketsByIds(
  marketIds: string[],
  orders: OpenOrder[],
): Promise<Map<string, MarketDisplayInfo>> {
  const unique = [...new Set(marketIds.filter(Boolean))];
  if (unique.length === 0) return new Map();

  const params = new URLSearchParams();
  for (const id of unique) {
    params.append("id", id);
  }

  const res = await fetch(`${GAMMA_API_URL}/markets?${params}`);
  if (!res.ok) return new Map();

  const json = (await res.json()) as {
    data?: Array<{
      id?: string;
      question?: string;
      icon?: string | null;
      image?: string | null;
      slug?: string | null;
      clobTokenIds?: string;
    }>;
  };

  return indexMarketsByClobMarketId(unique, orders, json.data ?? []);
}

export function isPrimaryOutcomeToken(
  assetId: string,
  clobTokenIds: string[],
): boolean | undefined {
  if (!clobTokenIds.length) return undefined;
  return clobTokenIds[0] === assetId;
}

export function useMarketLookup(marketIds: string[], orders: OpenOrder[]) {
  const uniqueIds = useMemo(
    () => [...new Set(marketIds.filter(Boolean))].sort(),
    [marketIds],
  );

  return useQuery({
    queryKey: ["market-lookup", uniqueIds],
    queryFn: () => fetchMarketsByIds(uniqueIds, orders),
    enabled: uniqueIds.length > 0 && orders.length > 0,
    staleTime: 5 * 60 * 1000,
  });
}
