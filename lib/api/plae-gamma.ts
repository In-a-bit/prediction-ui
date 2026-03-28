import type { GammaEvent } from "@/lib/types/event";

const PLAE_GAMMA_BASE =
  process.env.NEXT_PUBLIC_GAMMA_API_URL ?? "http://localhost:8084";

interface FetchPlaeEventsParams {
  active?: boolean;
  closed?: boolean;
  limit?: number;
  offset?: number;
  order?: string;
  ascending?: boolean;
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
      next: { revalidate: 30 },
      signal: AbortSignal.timeout(5000),
    });
    if (!res.ok) return null;
    return res.json();
  } catch {
    return null;
  }
}
