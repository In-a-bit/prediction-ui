"use client";

import { useQuery } from "@tanstack/react-query";

const GAMMA_API_URL = process.env.NEXT_PUBLIC_GAMMA_API_URL!;

export interface EventInfo {
  title: string;
  icon: string | null;
  slug: string;
}

/**
 * Fetches all active events from gamma-api and builds a lookup
 * from clobTokenId → event info (title, icon, slug).
 */
async function fetchEventLookup(): Promise<Map<string, EventInfo>> {
  const res = await fetch(
    `${GAMMA_API_URL}/events/pagination?active=true&limit=100`,
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
    const info: EventInfo = {
      title: ev.title,
      icon: ev.icon ?? null,
      slug: ev.slug,
    };
    for (const market of ev.markets ?? []) {
      if (!market.clobTokenIds) continue;
      try {
        const ids: string[] = JSON.parse(market.clobTokenIds);
        for (const id of ids) {
          lookup.set(id, info);
        }
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
