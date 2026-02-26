import type { GammaEvent } from "@/lib/types/event";

const GAMMA_BASE = "https://gamma-api.polymarket.com";

interface FetchEventsParams {
  active?: boolean;
  closed?: boolean;
  limit?: number;
  offset?: number;
  order?: string;
  ascending?: boolean;
  tag_slug?: string;
}

export async function fetchEvents(
  params: FetchEventsParams = {}
): Promise<GammaEvent[]> {
  const searchParams = new URLSearchParams();
  Object.entries(params).forEach(([key, value]) => {
    if (value !== undefined) searchParams.set(key, String(value));
  });

  try {
    const res = await fetch(`${GAMMA_BASE}/events?${searchParams}`, {
      next: { revalidate: 60 },
      signal: AbortSignal.timeout(5000),
    });

    if (!res.ok) {
      console.error("Gamma API error:", res.status, res.statusText);
      return [];
    }

    return res.json();
  } catch (e) {
    console.error("Gamma API fetch failed:", e);
    return [];
  }
}

export async function fetchEventBySlug(
  slug: string
): Promise<GammaEvent | null> {
  try {
    const res = await fetch(`${GAMMA_BASE}/events?slug=${slug}`, {
      next: { revalidate: 30 },
      signal: AbortSignal.timeout(5000),
    });

    if (!res.ok) return null;
    const data = await res.json();
    return data[0] ?? null;
  } catch {
    return null;
  }
}

export async function searchEvents(query: string): Promise<GammaEvent[]> {
  if (!query || query.length < 2) return [];

  try {
    const res = await fetch(
      `${GAMMA_BASE}/events?title_contains=${encodeURIComponent(query)}&active=true&limit=10`,
      { next: { revalidate: 30 }, signal: AbortSignal.timeout(5000) }
    );

    if (!res.ok) return [];
    return res.json();
  } catch {
    return [];
  }
}
