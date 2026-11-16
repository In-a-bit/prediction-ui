"use client";

import { useEffect, useMemo, useState } from "react";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  ReferenceLine,
} from "recharts";

import type { SpotChartPoint } from "@/lib/hooks/use-crypto-spot-chart";
import { formatUpdownPrice, type UpdownPriceFeed } from "@/lib/crypto-updown";

const CHART_RESAMPLE_MS = 250;

/** A drawn point; price null breaks the line (closed hours). */
type ChartPoint = { time: number; price: number | null };

interface CryptoSpotPriceChartProps {
  points: SpotChartPoint[];
  priceToBeat: number | null;
  liveMode: boolean;
  frozenAtMs?: number | null;
  slotStartSec?: number;
  intervalMinutes?: number;
  loading: boolean;
  error: string | null;
  feed?: UpdownPriceFeed;
  /**
   * Feeds with closed hours: a step between points longer than this is a
   * closure, drawn as a gap. Null/undefined draws one continuous line (crypto).
   */
  gapThresholdMs?: number | null;
}

function liveXDomain(
  now: number,
  slotStartSec: number,
  intervalMinutes: number,
): [number, number] {
  const slotStartMs = slotStartSec * 1000;
  const windowMs = intervalMinutes * 60 * 1000;
  const elapsed = now - slotStartMs;
  if (elapsed <= windowMs) {
    return [slotStartMs, now];
  }
  return [now - windowMs, now];
}

/**
 * Build a line that always spans the full X window; only grows forward.
 * With gapMs (feeds with closed hours) nothing is carried across a closure:
 * the line starts at the last price before the window only when it is recent.
 */
function buildLiveChartData(
  points: SpotChartPoint[],
  now: number,
  slotStartSec: number,
  intervalMinutes: number,
  gapMs: number | null,
): ChartPoint[] {
  if (points.length === 0 || now === 0) return [];

  const sorted = [...points].sort((a, b) => a.time - b.time);
  const [windowStart, windowEnd] = liveXDomain(now, slotStartSec, intervalMinutes);

  const inWindow = sorted.filter(
    (p) => p.time >= windowStart && p.time <= windowEnd,
  );
  const beforeWindow = sorted.filter((p) => p.time < windowStart);

  if (gapMs != null) {
    const lastBefore = beforeWindow[beforeWindow.length - 1];
    const data = lastBefore ? [lastBefore, ...inWindow] : inWindow;
    return resampleForDisplay(data, windowStart, windowEnd, gapMs);
  }

  const carryPrice =
    beforeWindow.length > 0
      ? beforeWindow[beforeWindow.length - 1].price
      : inWindow[0]?.price;

  if (carryPrice == null) return [];

  const data: SpotChartPoint[] = [{ time: windowStart, price: carryPrice }];

  for (const p of inWindow) {
    if (p.time > data[data.length - 1].time) {
      data.push(p);
    }
  }

  return resampleForDisplay(data, windowStart, windowEnd, null);
}

/** Past chart: a null point inside every step longer than gapMs breaks the line. */
function breakLineAtGaps(
  sorted: SpotChartPoint[],
  gapMs: number | null,
): ChartPoint[] {
  if (gapMs == null) return sorted;
  const out: ChartPoint[] = [];
  for (const p of sorted) {
    const prev = out[out.length - 1];
    if (prev && p.time - prev.time > gapMs) {
      out.push({ time: (prev.time + p.time) / 2, price: null });
    }
    out.push(p);
  }
  return out;
}

function easeInOutSmooth(t: number): number {
  const x = Math.max(0, Math.min(1, t));
  return x * x * (3 - 2 * x);
}

/** Price at timeMs; null inside a closure (a step longer than gapMs). */
function interpolatePriceAt(
  points: SpotChartPoint[],
  timeMs: number,
  gapMs: number | null,
): number | null {
  const first = points[0];
  const last = points[points.length - 1];
  if (timeMs <= first.time) {
    return gapMs != null && timeMs < first.time ? null : first.price;
  }
  if (timeMs >= last.time) {
    return gapMs != null && timeMs - last.time > gapMs ? null : last.price;
  }

  for (let i = 1; i < points.length; i++) {
    const left = points[i - 1];
    const right = points[i];
    if (timeMs >= left.time && timeMs <= right.time) {
      const span = right.time - left.time;
      if (span <= 0) return right.price;
      if (gapMs != null && span > gapMs) return null;
      const ratio = easeInOutSmooth((timeMs - left.time) / span);
      return left.price + ratio * (right.price - left.price);
    }
  }

  return last.price;
}

/** Dense, eased samples so monotone curves stay fluid between ticks. */
function resampleForDisplay(
  points: SpotChartPoint[],
  fromMs: number,
  toMs: number,
  gapMs: number | null,
): ChartPoint[] {
  if (points.length === 0 || toMs <= fromMs) return [];

  const start = Math.ceil(fromMs / CHART_RESAMPLE_MS) * CHART_RESAMPLE_MS;
  const out: ChartPoint[] = [];

  for (let t = start; t <= toMs; t += CHART_RESAMPLE_MS) {
    out.push({ time: t, price: interpolatePriceAt(points, t, gapMs) });
  }

  if (out.length === 0) return [{ time: fromMs, price: points[0].price }];
  return out.some((p) => p.price != null) ? out : [];
}

export function CryptoSpotPriceChart({
  points,
  priceToBeat,
  liveMode,
  frozenAtMs,
  slotStartSec,
  intervalMinutes = 5,
  loading,
  error,
  feed,
  gapThresholdMs = null,
}: CryptoSpotPriceChartProps) {
  const [now, setNow] = useState(0);
  const isFrozen = frozenAtMs != null;

  useEffect(() => {
    if (!liveMode || isFrozen) return;
    setNow(Date.now());
    const id = setInterval(() => setNow(Date.now()), CHART_RESAMPLE_MS);
    return () => clearInterval(id);
  }, [liveMode, isFrozen]);

  const displayNow = isFrozen ? frozenAtMs : now;

  const { chartData, xDomain } = useMemo(() => {
    if (points.length === 0) {
      return { chartData: [] as ChartPoint[], xDomain: undefined as [number, number] | undefined };
    }

    if (liveMode && displayNow > 0 && slotStartSec != null) {
      return {
        chartData: buildLiveChartData(
          points,
          displayNow,
          slotStartSec,
          intervalMinutes,
          gapThresholdMs,
        ),
        xDomain: liveXDomain(displayNow, slotStartSec, intervalMinutes),
      };
    }

    return {
      chartData: breakLineAtGaps(
        [...points].sort((a, b) => a.time - b.time),
        gapThresholdMs,
      ),
      xDomain: undefined,
    };
  }, [points, liveMode, displayNow, slotStartSec, intervalMinutes, gapThresholdMs]);

  const yDomain = useMemo<[number, number]>(() => {
    if (chartData.length === 0) return [0, 1];

    let min = Number.POSITIVE_INFINITY;
    let max = Number.NEGATIVE_INFINITY;
    for (const p of chartData) {
      if (p.price == null) continue;
      if (p.price < min) min = p.price;
      if (p.price > max) max = p.price;
    }
    if (priceToBeat != null && Number.isFinite(priceToBeat)) {
      if (priceToBeat < min) min = priceToBeat;
      if (priceToBeat > max) max = priceToBeat;
    }

    if (!Number.isFinite(min) || !Number.isFinite(max)) return [0, 1];
    if (min === max) {
      const pad = Math.max(0.1, Math.abs(min) * 0.001);
      return [min - pad, max + pad];
    }
    const pad = (max - min) * 0.15;
    return [min - pad, max + pad];
  }, [chartData, priceToBeat]);

  const formatUsd = (value: number) => formatUpdownPrice(String(value), feed);

  if (loading) {
    return (
      <div className="flex h-64 items-center justify-center">
        <div className="h-5 w-5 animate-spin rounded-full border-2 border-brand border-t-transparent" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex h-64 items-center justify-center text-sm text-red">
        {error}
      </div>
    );
  }

  if (chartData.length === 0) {
    return (
      <div className="flex h-64 items-center justify-center text-sm text-muted">
        No price data for this period
      </div>
    );
  }

  return (
    <ResponsiveContainer width="100%" height={280}>
      <LineChart data={chartData} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
        <XAxis
          dataKey="time"
          type="number"
          domain={xDomain ?? ["dataMin", "dataMax"]}
          allowDataOverflow
          tickFormatter={(ts) =>
            new Date(ts).toLocaleTimeString([], {
              hour: "numeric",
              minute: "2-digit",
              second: "2-digit",
            })
          }
          axisLine={false}
          tickLine={false}
          tick={{ fill: "#7b8aa3", fontSize: 11 }}
          minTickGap={40}
        />
        <YAxis
          domain={yDomain}
          allowDataOverflow
          axisLine={false}
          tickLine={false}
          tick={{ fill: "#7b8aa3", fontSize: 11 }}
          tickFormatter={(v) => formatUsd(Number(v))}
          width={72}
        />
        <Tooltip
          cursor={{
            stroke: "#7b8aa3",
            strokeDasharray: "4 4",
            strokeOpacity: 0.6,
          }}
          contentStyle={{
            background: "#0d1b3e",
            border: "1px solid #1a2a52",
            borderRadius: "12px",
            padding: "8px 12px",
          }}
          labelFormatter={(ts) =>
            new Date(Number(ts)).toLocaleTimeString([], {
              hour: "2-digit",
              minute: "2-digit",
              second: "2-digit",
            })
          }
          formatter={(value: number | undefined) => [
            value == null ? "—" : formatUsd(value),
            "Price",
          ]}
        />
        {priceToBeat != null && Number.isFinite(priceToBeat) && (
          <ReferenceLine
            y={priceToBeat}
            stroke="#7b8aa3"
            strokeDasharray="4 4"
            label={{
              value: "Target",
              position: "insideTopRight",
              fill: "#7b8aa3",
              fontSize: 11,
            }}
          />
        )}
        <Line
          type="monotone"
          dataKey="price"
          stroke="#f97316"
          strokeWidth={2}
          isAnimationActive={false}
          connectNulls={gapThresholdMs == null}
          strokeLinecap="round"
          strokeLinejoin="round"
          dot={false}
          activeDot={{
            r: 4,
            fill: "#f97316",
            stroke: "#0d1b3e",
            strokeWidth: 2,
          }}
        />
      </LineChart>
    </ResponsiveContainer>
  );
}
