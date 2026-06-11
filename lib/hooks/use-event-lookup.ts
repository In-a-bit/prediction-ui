"use client";

import { useQuery } from "@tanstack/react-query";

import { predictionServiceBase } from "@/lib/prediction-proxy";

const GAMMA_API_URL = predictionServiceBase("gamma");

export interface EventInfo {
  title: string;
  icon: string | null;
  slug: string;
  /** True when this clob token is outcomes[0] / first token in the market. */
  isPrimaryToken: boolean;
}

/**
 * Fetches all active events from gamma-api and builds a lookup
 * from clobTokenId → event info (title, icon, slug).
 */
async function fetchEventLookup(): Promise<Map<string, EventInfo>> {
  const res = await fetch(
    `${GAMMA_API_URL}/events?active=true&limit=100`,
  );
  if (!res.ok) return new Map();

  const json = await res.json();
  const events: Array<{
    title?: string;
    icon?: string | null;
    slug?: string;
    markets?: Array<{ clobTokenIds?: string }>;
  }> = json.data ?? [];

  const lookup = new Map<string, EventInfo>();

  for (const ev of events) {
    if (!ev.title || !ev.slug) continue;
    for (const market of ev.markets ?? []) {
      if (!market.clobTokenIds) continue;
      try {
        const ids: string[] = JSON.parse(market.clobTokenIds);
        ids.forEach((id, index) => {
          lookup.set(id, {
            title: ev.title!,
            icon: ev.icon ?? null,
            slug: ev.slug!,
            isPrimaryToken: index === 0,
          });
        });
      } catch {
        // clobTokenIds wasn't valid JSON
      }
    }
  }

  return lookup;
}

export function useEventLookup() {
  return useQuery({
    queryKey: ["event-lookup"],
    queryFn: fetchEventLookup,
    staleTime: 5 * 60 * 1000,
  });
}
