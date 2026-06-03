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

const DEFAULT_OUTCOME_LABELS: [string, string] = ["Yes", "No"];

/**
 * Whether this order/position is on the first outcome token (index 0).
 * Returns undefined when token IDs are unknown — do not guess from label text.
 */
export function isPrimaryOutcomeToken(
  assetId: string,
  firstTokenId?: string,
  secondTokenId?: string,
): boolean | undefined {
  if (firstTokenId && assetId === firstTokenId) return true;
  if (secondTokenId && assetId === secondTokenId) return false;
  return undefined;
}

export function outcomeBadgeClass(isPrimary: boolean | undefined): string {
  if (isPrimary === true) return "bg-green-dim text-green";
  if (isPrimary === false) return "bg-red-dim text-red";
  return "bg-card-border/50 text-foreground";
}

/** First active, non-resolved market on an event (same pick as list cards). */
export function pickDisplayMarket(event: GammaEvent): GammaMarket | undefined {
  return (
    event.markets?.find((m) => {
      if (m.closed || !m.active) return false;
      if (m.outcomePrices) {
        try {
          const prices = JSON.parse(m.outcomePrices) as string[];
          if (prices.some((p) => parseFloat(p) >= 0.99 || parseFloat(p) <= 0.01)) {
            return false;
          }
        } catch {
          /* ignore */
        }
      }
      return true;
    }) ?? event.markets?.[0]
  );
}

/** Parses market.outcomes JSON from gamma-api, e.g. ["Yes","No"] or ["Up","Down"]. */
export function parseOutcomes(m: GammaMarket | undefined): [string, string] {
  if (!m?.outcomes) return DEFAULT_OUTCOME_LABELS;
  try {
    const raw = JSON.parse(m.outcomes) as unknown;
    if (!Array.isArray(raw) || raw.length < 2) return DEFAULT_OUTCOME_LABELS;
    const a = String(raw[0] ?? "").trim();
    const b = String(raw[1] ?? "").trim();
    if (!a || !b) return DEFAULT_OUTCOME_LABELS;
    return [a, b];
  } catch {
    return DEFAULT_OUTCOME_LABELS;
  }
}

/** Parses market.outcomePrices JSON to cents (0–100) for each outcome index. */
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

/** List-card prices: picks display market, then parses outcomePrices (gamma-api / snapshots). */
export function parseOutcomePrices(event: GammaEvent): {
  yes: number;
  no: number;
  market: GammaMarket | undefined;
  labels: [string, string];
} {
  const market = pickDisplayMarket(event);
  const prices = market ? parsePrices(market) : { yes: 50, no: 50 };
  return {
    market,
    labels: parseOutcomes(market),
    yes: prices.yes,
    no: prices.no,
  };
}

export function getDeployedMarkets(event: GammaEvent): GammaMarket[] {
  return event.markets?.filter(isDeployed) ?? [];
}

export function isCryptoUpdownEvent(event: GammaEvent): boolean {
  return event.metadataType === "crypto_updown";
}

const UMA_RESOLVED_STATUSES = new Set(["RESOLVED", "MANUALLY_RESOLVED"]);

export function isUmaResolved(market: GammaMarket | undefined): boolean {
  const status = market?.umaResolutionStatus?.trim().toUpperCase();
  return status != null && UMA_RESOLVED_STATUSES.has(status);
}

/** Index of the winning outcome from settled outcomePrices (e.g. ["1","0"]). */
export function getWinningOutcomeIndex(
  market: GammaMarket | undefined,
): number | null {
  if (!market?.outcomePrices) return null;
  try {
    const prices = JSON.parse(market.outcomePrices) as string[];
    for (let i = 0; i < prices.length; i++) {
      if (parseFloat(prices[i]) >= 0.99) return i;
    }
  } catch {
    /* ignore */
  }
  return null;
}

export function getWinningOutcomeLabel(
  market: GammaMarket | undefined,
): string | null {
  const idx = getWinningOutcomeIndex(market);
  if (idx == null) return null;
  const labels = parseOutcomes(market);
  return labels[idx] ?? null;
}

export function isMarketAwaitingResolution(
  market: GammaMarket | undefined,
  event?: GammaEvent,
  slotEnded?: boolean,
): boolean {
  if (!market || isUmaResolved(market)) return false;
  if (market.closed) return true;
  if (slotEnded) return true;
  return false;
}
