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

/** Visible live chart viewport — still 1 minute on screen. */
export const LIVE_CHART_WINDOW_MS = 60_000;

/**
 * /price-history with interval=1m only returns fully closed minute buckets.
 * A 60s request window often returns [] (current minute is still open).
 * Fetch at least 2 minutes so one closed bucket is usually included.
 */
const LIVE_HISTORY_FETCH_MS = 120_000;

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

  const url = `${predictionServiceBase("price")}/price-history?${params}`;
  const res = await fetch(url);
  if (!res.ok) {
    throw new Error(`price-history failed: ${res.status}`);
  }

  const data = (await res.json()) as CryptoPricePoint[];
  return Array.isArray(data) ? data : [];
}

/** Live chart bootstrap via /price-history (1m closed buckets) + /latest fallback. */
export async function fetchCryptoLivePriceHistory(
  meta: CryptoUpdownMetadata,
  nowMs = Date.now(),
): Promise<CryptoPricePoint[]> {
  const slotStartMs = meta.slot_start * 1000;
  const closeTimeMs = nowMs;
  const openTimeMs = Math.max(slotStartMs, closeTimeMs - LIVE_HISTORY_FETCH_MS);

  const history = await fetchPriceHistoryRange(meta, openTimeMs, closeTimeMs);
  const latest = await fetchCryptoLatest(meta, nowMs);

  if (!latest) {
    return history;
  }

  const last = history[history.length - 1];
  if (!last || latest.timestamp > last.timestamp) {
    return [...history, latest];
  }

  return history;
}

/** Current spot from Redis (live) or last closed 1m candle (stale). */
export async function fetchCryptoLatest(
  meta: CryptoUpdownMetadata,
  nowMs = Date.now(),
): Promise<CryptoPricePoint | null> {
  const params = new URLSearchParams({
    symbol: cryptoPriceHistorySymbol(meta),
  });
  const url = `${predictionServiceBase("price")}/latest?${params}`;
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
