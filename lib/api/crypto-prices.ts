import {
  cryptoPriceHistorySymbol,
  priceHistoryInterval,
  priceHistoryWindow,
  type CryptoUpdownMetadata,
} from "@/lib/crypto-updown";
import { predictionServiceBase } from "@/lib/prediction-proxy";

export type CryptoPricePoint = {
  timestamp: number;
  price: number;
};

function intervalMs(interval: string): number {
  switch (interval) {
    case "1m":
      return 60_000;
    case "5m":
      return 5 * 60_000;
    case "15m":
      return 15 * 60_000;
    case "1h":
      return 60 * 60_000;
    case "4h":
      return 4 * 60 * 60_000;
    case "1d":
      return 24 * 60 * 60_000;
    default:
      return 60_000;
  }
}

export async function fetchCryptoPriceHistory(
  meta: CryptoUpdownMetadata,
  nowMs = Date.now(),
): Promise<CryptoPricePoint[]> {
  const interval = priceHistoryInterval(meta.interval_minutes);
  const minRange = intervalMs(interval);
  const window = priceHistoryWindow(meta, nowMs);

  const closeTimeMs = window.closeTimeMs;
  let openTimeMs = window.openTimeMs;
  if (closeTimeMs-openTimeMs < minRange) {
    openTimeMs = closeTimeMs - minRange;
  }
  if (openTimeMs >= closeTimeMs) return [];

  return fetchPriceHistoryRange(meta, openTimeMs, closeTimeMs, interval);
}

async function fetchPriceHistoryRange(
  meta: CryptoUpdownMetadata,
  openTimeMs: number,
  closeTimeMs: number,
  interval = "1m",
): Promise<CryptoPricePoint[]> {
  const minRange = intervalMs(interval);
  let open = openTimeMs;
  if (closeTimeMs - open < minRange) {
    open = closeTimeMs - minRange;
  }
  if (open >= closeTimeMs) return [];

  const params = new URLSearchParams({
    symbol: cryptoPriceHistorySymbol(meta),
    interval,
    openTime: String(open),
    closeTime: String(closeTimeMs),
    limit: "5000",
  });

  const url = `${predictionServiceBase("price")}/crypto/price-history?${params}`;
  const res = await fetch(url);
  if (!res.ok) {
    throw new Error(`price-history failed: ${res.status}`);
  }

  const data = (await res.json()) as CryptoPricePoint[];
  return Array.isArray(data) ? data : [];
}

/** Merge closed 1m buckets with /latest so live charts start even when history is []. */
export function mergeHistoryWithLatest(
  history: CryptoPricePoint[],
  latest: CryptoPricePoint | null,
): CryptoPricePoint[] {
  if (!latest) return history;
  const last = history[history.length - 1];
  if (!last || latest.timestamp > last.timestamp) {
    return [...history, latest];
  }
  if (latest.timestamp === last.timestamp && latest.price !== last.price) {
    return [...history.slice(0, -1), latest];
  }
  return history;
}

/**
 * Live/upcoming chart bootstrap: fetch the full market window (5m → 5 minutes,
 * 15m → 15 minutes) via /price-history (1m buckets) plus /latest for the
 * open minute.
 */
export async function fetchCryptoLivePriceHistory(
  meta: CryptoUpdownMetadata,
  nowMs = Date.now(),
): Promise<CryptoPricePoint[]> {
  const window = priceHistoryWindow(meta, nowMs);
  const [history, latest] = await Promise.all([
    fetchPriceHistoryRange(
      meta,
      window.openTimeMs,
      window.closeTimeMs,
      "1m",
    ),
    fetchCryptoLatest(meta, nowMs),
  ]);
  return mergeHistoryWithLatest(history, latest);
}

/** Current spot from Redis (live) or last closed 1m candle (stale). */
export async function fetchCryptoLatest(
  meta: CryptoUpdownMetadata,
  nowMs = Date.now(),
): Promise<CryptoPricePoint | null> {
  const params = new URLSearchParams({
    symbol: cryptoPriceHistorySymbol(meta),
  });
  const url = `${predictionServiceBase("price")}/crypto/latest?${params}`;
  const res = await fetch(url);
  if (!res.ok) return null;

  const data = (await res.json()) as {
    timestamp?: number;
    open_time?: number;
    price?: number | string;
    payload?: {
      timestamp?: number;
      value?: number;
    };
  };

  const payload = data.payload;
  if (payload && Number.isFinite(Number(payload.value))) {
    return {
      timestamp: Number(data.timestamp ?? payload.timestamp ?? nowMs),
      price: Number(payload.value),
    };
  }

  if (Number.isFinite(Number(data.price))) {
    return {
      timestamp: Number(data.open_time ?? nowMs),
      price: Number(data.price),
    };
  }

  return null;
}
