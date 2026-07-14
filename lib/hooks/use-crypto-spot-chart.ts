"use client";

import { useEffect, useRef, useState } from "react";

import {
  fetchCryptoLatest,
  fetchCryptoLivePriceHistory,
  fetchCryptoPriceHistory,
} from "@/lib/api/crypto-prices";
import {
  cryptoChartMode,
  cryptoWsSymbol,
  getCryptoPriceToBeat,
  isChartLiveMode,
  parseCryptoMetadata,
  type CryptoChartMode,
} from "@/lib/crypto-updown";
import { useCryptoPricesWS } from "@/components/providers/crypto-prices-ws-provider";
import { useMarketSurface } from "@/components/providers/market-surface-provider";
import type { GammaEvent } from "@/lib/types/event";

export type SpotChartPoint = { time: number; price: number };

const MAX_POINTS = 600;
const LIVE_SAMPLE_INTERVAL_MS = 250;
/** Ease display price toward WS target over ~800ms. */
const PRICE_SMOOTH_HALF_LIFE_MS = 800;

/** Append only forward in time — never rewrite earlier points. */
function appendForward(
  existing: SpotChartPoint[],
  incoming: SpotChartPoint[],
): SpotChartPoint[] {
  if (incoming.length === 0) return existing;
  const lastTime = existing.length > 0 ? existing[existing.length - 1].time : -1;
  const appended = incoming
    .filter((p) => Number.isFinite(p.time) && Number.isFinite(p.price))
    .filter((p) => p.time > lastTime)
    .sort((a, b) => a.time - b.time);
  if (appended.length === 0) return existing;
  const merged = [...existing, ...appended];
  return merged.length > MAX_POINTS ? merged.slice(merged.length - MAX_POINTS) : merged;
}

function historyToPoints(
  history: { timestamp: number; price: number }[],
): SpotChartPoint[] {
  return history
    .filter((p) => Number.isFinite(p.timestamp) && Number.isFinite(p.price))
    .map((p) => ({ time: p.timestamp, price: p.price }))
    .sort((a, b) => a.time - b.time);
}

/** Stable key for a slot — only changes when the market window or asset changes. */
export function cryptoSpotHistoryKey(event: GammaEvent): string {
  const meta = parseCryptoMetadata(event);
  if (!meta) return "";
  return `${event.slug}:${meta.slot_start}:${meta.slot_end}:${meta.base}:${meta.target}`;
}

export function useCryptoSpotChart(
  event: GammaEvent,
  market?: { metadata?: Record<string, unknown> },
) {
  const { serviceBase } = useMarketSurface();
  const priceBase = serviceBase("price");
  const meta = parseCryptoMetadata(event);

  const chartMode: CryptoChartMode = meta
    ? cryptoChartMode(meta)
    : "past";

  const [frozenAtMs, setFrozenAtMs] = useState<number | null>(null);
  const startedLiveRef = useRef(false);
  if (chartMode === "live") {
    startedLiveRef.current = true;
  }

  const liveDisplayMode = chartMode === "live" || frozenAtMs != null;
  const wsSymbol =
    meta && chartMode === "live" ? cryptoWsSymbol(meta) : null;

  const priceToBeatRaw = meta
    ? getCryptoPriceToBeat(event, market)
    : null;
  const priceToBeatNum = priceToBeatRaw ? Number(priceToBeatRaw) : null;

  const [points, setPoints] = useState<SpotChartPoint[]>([]);
  const [currentPrice, setCurrentPrice] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const cryptoPricesWs = useCryptoPricesWS();
  const targetPriceRef = useRef<number | null>(null);
  const smoothedPriceRef = useRef<number | null>(null);

  const seedLivePrice = (price: number) => {
    targetPriceRef.current = price;
    smoothedPriceRef.current = price;
    setCurrentPrice(price);
  };

  useEffect(() => {
    const slotMeta = parseCryptoMetadata(event);
    if (!slotMeta) return;

    let cancelled = false;
    const loadTimeMs = Date.now();
    const live = isChartLiveMode(slotMeta);

    const seedFromLatest = async () => {
      const latest = await fetchCryptoLatest(slotMeta, loadTimeMs, priceBase);
      if (cancelled || !latest) return;
      setPoints([{ time: latest.timestamp, price: latest.price }]);
      seedLivePrice(latest.price);
    };

    const loadPromise = live
      ? fetchCryptoLivePriceHistory(slotMeta, loadTimeMs, priceBase).then(async (history) => {
          if (cancelled) return;
          if (history.length === 0) {
            await seedFromLatest();
            return;
          }
          setPoints(historyToPoints(history));
          const last = history[history.length - 1];
          if (last) seedLivePrice(last.price);
        })
      : fetchCryptoPriceHistory(slotMeta, loadTimeMs, priceBase).then((history) => {
          if (cancelled) return;
          const initial = historyToPoints(history);
          setPoints(initial);
          const last = initial[initial.length - 1];
          if (last) setCurrentPrice(last.price);
        });

    loadPromise
      .catch((err) => {
        if (cancelled) return;
        setError(err instanceof Error ? err.message : "Failed to load prices");
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- remount via parent key per slot
  }, []);

  useEffect(() => {
    if (!meta || frozenAtMs != null) return;

    const maybeFreeze = () => {
      if (!startedLiveRef.current) return;
      if (cryptoChartMode(meta) !== "past") return;
      setFrozenAtMs(meta.slot_end * 1000);
    };

    maybeFreeze();
    const id = setInterval(maybeFreeze, 1000);
    return () => clearInterval(id);
  }, [meta, frozenAtMs]);

  useEffect(() => {
    if (!wsSymbol) return;

    cryptoPricesWs.connect(wsSymbol);

    const unsub = cryptoPricesWs.onTick((tick) => {
      targetPriceRef.current = tick.value;
      setCurrentPrice(tick.value);
    });

    return unsub;
  }, [cryptoPricesWs, wsSymbol]);

  useEffect(() => {
    if (!wsSymbol) return;

    const sampleSmoothedPrice = () => {
      const target = targetPriceRef.current;
      if (target == null) return;

      const prev = smoothedPriceRef.current ?? target;
      const alpha =
        1 - Math.exp(-LIVE_SAMPLE_INTERVAL_MS / PRICE_SMOOTH_HALF_LIFE_MS);
      const smoothed = prev + alpha * (target - prev);
      smoothedPriceRef.current = smoothed;

      setPoints((prevPoints) =>
        appendForward(prevPoints, [{ time: Date.now(), price: smoothed }]),
      );
    };

    sampleSmoothedPrice();
    const id = setInterval(sampleSmoothedPrice, LIVE_SAMPLE_INTERVAL_MS);
    return () => clearInterval(id);
  }, [wsSymbol]);

  return {
    meta,
    chartMode,
    liveMode: liveDisplayMode,
    frozenAtMs,
    points,
    currentPrice,
    priceToBeat: priceToBeatNum,
    priceToBeatRaw,
    loading,
    error,
  };
}
