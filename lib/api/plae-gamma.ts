import type { GammaEvent } from "@/lib/types/event";

import { predictionServiceBase } from "@/lib/prediction-proxy";

const PLAE_GAMMA_BASE = predictionServiceBase("gamma");

interface FetchPlaeEventsParams {
  active?: boolean;
  closed?: boolean;
  limit?: number;
  offset?: number;
  order?: string;
  ascending?: boolean;
  group_by_series?: boolean;
}

export interface PlaeEventsResponse {
  events: GammaEvent[];
  hasMore: boolean;
}

export async function fetchPlaeEvents(
  params: FetchPlaeEventsParams = {},
): Promise<PlaeEventsResponse> {
  const searchParams = new URLSearchParams();
  Object.entries(params).forEach(([key, value]) => {
    if (value !== undefined) searchParams.set(key, String(value));
  });

  try {
    const res = await fetch(`${PLAE_GAMMA_BASE}/events/pagination?${searchParams}`, {
      next: { revalidate: 30 },
      signal: AbortSignal.timeout(5000),
    });
    if (!res.ok) return { events: [], hasMore: false };
    const json = await res.json();
    return {
      events: json.data ?? [],
      hasMore: json.pagination?.hasMore ?? false,
    };
  } catch {
    return { events: [], hasMore: false };
  }
}

export async function fetchPlaeEventBySlug(
  slug: string,
): Promise<GammaEvent | null> {
  try {
    const res = await fetch(`${PLAE_GAMMA_BASE}/events/slug/${slug}`, {
      cache: "no-store",
      signal: AbortSignal.timeout(10000),
    });
    if (!res.ok) return null;
    return res.json();
  } catch {
    return null;
  }
}
