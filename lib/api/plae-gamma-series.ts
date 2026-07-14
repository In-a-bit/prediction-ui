import type { GammaSeries } from "@/lib/types/event";

import { predictionServiceBase } from "@/lib/prediction-proxy";

export interface FetchSeriesBySlugOptions {
  slotEndAfter?: Date;
  slotEndBefore?: Date;
  limit?: number;
  gammaBase?: string;
}

function resolveGammaBase(override?: string): string {
  return (override ?? predictionServiceBase("gamma")).replace(/\/$/, "");
}

export async function fetchSeriesBySlug(
  slug: string,
  opts: FetchSeriesBySlugOptions = {},
): Promise<GammaSeries | null> {
  const params = new URLSearchParams();
  if (opts.slotEndAfter) {
    params.set("slot_end_after", opts.slotEndAfter.toISOString());
  }
  if (opts.slotEndBefore) {
    params.set("slot_end_before", opts.slotEndBefore.toISOString());
  }
  if (opts.limit !== undefined) {
    params.set("limit", String(opts.limit));
  }

  const qs = params.toString();
  const gammaBase = resolveGammaBase(opts.gammaBase);
  const url = `${gammaBase}/series/slug/${encodeURIComponent(slug)}${qs ? `?${qs}` : ""}`;

  try {
    const res = await fetch(url, { signal: AbortSignal.timeout(10000) });
    if (!res.ok) return null;
    return (await res.json()) as GammaSeries;
  } catch {
    return null;
  }
}
