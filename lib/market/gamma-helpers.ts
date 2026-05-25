import type { GammaEvent, GammaMarket } from "@/lib/types/event";

export function formatVolume(v: number): string {
  if (v >= 1_000_000) return `$${(v / 1_000_000).toFixed(1)}M`;
  if (v >= 1_000) return `$${(v / 1_000).toFixed(1)}K`;
  if (v > 0) return `$${v.toFixed(0)}`;
  return "$0";
}

export function isDeployed(m: GammaMarket): boolean {
  if (!m.conditionId || m.conditionId === "PENDING") return false;
  try {
    const ids = m.clobTokenIds ? JSON.parse(m.clobTokenIds) : [];
    return Array.isArray(ids) && ids.length >= 2;
  } catch {
    return false;
  }
}

export function parseTokenIds(m: GammaMarket): string[] {
  try {
    return m.clobTokenIds ? JSON.parse(m.clobTokenIds) : [];
  } catch {
    return [];
  }
}

export function parsePrices(m: GammaMarket): { yes: number; no: number } {
  if (m.outcomePrices) {
    try {
      const p = JSON.parse(m.outcomePrices) as string[];
      return {
        yes: Math.round(parseFloat(p[0]) * 100),
        no: Math.round(parseFloat(p[1]) * 100),
      };
    } catch {
      /* fall through */
    }
  }
  return { yes: 50, no: 50 };
}

export function getDeployedMarkets(event: GammaEvent): GammaMarket[] {
  return event.markets?.filter(isDeployed) ?? [];
}

export function isCryptoUpdownEvent(event: GammaEvent): boolean {
  return event.metadataType === "crypto_updown";
}
