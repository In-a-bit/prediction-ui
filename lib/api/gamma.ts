import type { GammaEvent } from "@/lib/types/event";

const GAMMA_BASE = "https://gamma-api.polymarket.com";

interface FetchEventsParams {
  active?: boolean;
  closed?: boolean;
  limit?: number;
  offset?: number;
  order?: string;
  ascending?: boolean;
  tag?: string;
}

export async function fetchEvents(
  params: FetchEventsParams = {}
): Promise<GammaEvent[]> {
  const searchParams = new URLSearchParams();
  Object.entries(params).forEach(([key, value]) => {
    if (value !== undefined) searchParams.set(key, String(value));
  });

  const res = await fetch(`${GAMMA_BASE}/events?${searchParams}`, {
    next: { revalidate: 60 },
  });

  if (!res.ok) {
    console.error("Gamma API error:", res.status, res.statusText);
    return [];
  }

  return res.json();
}

export async function fetchEventBySlug(
  slug: string
): Promise<GammaEvent | null> {
  const res = await fetch(`${GAMMA_BASE}/events?slug=${slug}`, {
    next: { revalidate: 30 },
  });

  if (!res.ok) return null;
  const data = await res.json();
  return data[0] ?? null;
}

export async function searchEvents(query: string): Promise<GammaEvent[]> {
  if (!query || query.length < 2) return [];

  const res = await fetch(
    `${GAMMA_BASE}/events?title_contains=${encodeURIComponent(query)}&active=true&limit=10`,
    { next: { revalidate: 30 } }
  );

  if (!res.ok) return [];
  return res.json();
}
