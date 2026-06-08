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
  tag_slug?: string;
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

async function fetchGammaWithRetry(
  url: string,
  init: RequestInit,
  retries = 1,
): Promise<Response> {
  let lastError: unknown;

  for (let attempt = 0; attempt <= retries; attempt += 1) {
    try {
      return await fetch(url, init);
    } catch (err) {
      lastError = err;
      if (init.signal?.aborted) {
        throw err;
      }
      if (attempt === retries) {
        break;
      }
      await new Promise((resolve) => setTimeout(resolve, 300 * (attempt + 1)));
    }
  }

  throw lastError;
}

function withFetchTimeout(
  signal: AbortSignal | undefined,
  timeoutMs: number,
): AbortSignal {
  const timeout = AbortSignal.timeout(timeoutMs);
  if (!signal) {
    return timeout;
  }

  const merged = new AbortController();
  const abort = () => merged.abort();

  if (signal.aborted || timeout.aborted) {
    merged.abort();
    return merged.signal;
  }

  signal.addEventListener("abort", abort, { once: true });
  timeout.addEventListener("abort", abort, { once: true });
  return merged.signal;
}

export async function fetchPlaeEventBySlug(
  slug: string,
  signal?: AbortSignal,
): Promise<GammaEvent | null> {
  try {
    const res = await fetchGammaWithRetry(
      `${PLAE_GAMMA_BASE}/events/slug/${slug}`,
      {
        cache: "no-store",
        signal: withFetchTimeout(signal, 15_000),
      },
    );
    if (!res.ok) return null;
    return res.json();
  } catch (err) {
    if (signal?.aborted) {
      return null;
    }
    console.error("fetchPlaeEventBySlug failed", { slug, err });
    return null;
  }
}
