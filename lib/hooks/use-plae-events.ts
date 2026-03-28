"use client";

import { useQuery } from "@tanstack/react-query";
import type { GammaEvent } from "@/lib/types/event";

const PLAE_GAMMA_BASE =
  process.env.NEXT_PUBLIC_GAMMA_API_URL ?? "http://localhost:8084";

interface UsePlaeEventsParams {
  active?: boolean;
  closed?: boolean;
  limit?: number;
  offset?: number;
  order?: string;
  ascending?: boolean;
}

export interface PlaeEventsResult {
  events: GammaEvent[];
  hasMore: boolean;
}

async function getPlaeEvents(
  params: UsePlaeEventsParams,
): Promise<PlaeEventsResult> {
  const searchParams = new URLSearchParams();
  Object.entries(params).forEach(([key, value]) => {
    if (value !== undefined) searchParams.set(key, String(value));
  });

  const res = await fetch(`${PLAE_GAMMA_BASE}/events/pagination?${searchParams}`);
  if (!res.ok) return { events: [], hasMore: false };
  const json = await res.json();
  return {
    events: json.data ?? [],
    hasMore: json.pagination?.hasMore ?? false,
  };
}

export function usePlaeEvents(params: UsePlaeEventsParams) {
  return useQuery({
    queryKey: ["plae-events", params],
    queryFn: () => getPlaeEvents(params),
  });
}
