"use client";

import { useQuery } from "@tanstack/react-query";
import type { GammaEvent } from "@/lib/types/event";

import { useMarketSurface } from "@/components/providers/market-surface-provider";

interface UsePlaeEventsParams {
  active?: boolean;
  closed?: boolean;
  limit?: number;
  offset?: number;
  order?: string;
  ascending?: boolean;
  group_by_series?: boolean;
  tag_slug?: string;
}

export interface PlaeEventsResult {
  events: GammaEvent[];
  hasMore: boolean;
}

async function getPlaeEvents(
  gammaBase: string,
  params: UsePlaeEventsParams,
): Promise<PlaeEventsResult> {
  const searchParams = new URLSearchParams();
  Object.entries(params).forEach(([key, value]) => {
    if (value !== undefined) searchParams.set(key, String(value));
  });

  const res = await fetch(`${gammaBase}/events?${searchParams}`);
  if (!res.ok) return { events: [], hasMore: false };
  const json = await res.json();
  return {
    events: json.data ?? [],
    hasMore: json.pagination?.hasMore ?? false,
  };
}

export function usePlaeEvents(params: UsePlaeEventsParams) {
  const { serviceBase, id } = useMarketSurface();
  const gammaBase = serviceBase("gamma");

  return useQuery({
    queryKey: ["plae-events", id, gammaBase, params],
    queryFn: () => getPlaeEvents(gammaBase, params),
  });
}
