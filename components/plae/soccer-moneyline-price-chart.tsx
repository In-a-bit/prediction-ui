"use client";

import { useMemo, useState, useEffect, useRef } from "react";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
} from "recharts";
import { usePriceHistory } from "@/lib/hooks/use-prices";
import { parseTokenIds } from "@/lib/market/gamma-helpers";
import {
  SOCCER_OUTCOME_ORDER,
  teamAbbrev,
  type SoccerMarketGroup,
  type SoccerOutcomeKey,
  type SoccerTeam,
} from "@/lib/sports-soccer";
import { cn } from "@/lib/utils";

const timeRanges = [
  { label: "24H", days: 1, fidelity: 5 },
  { label: "7D", days: 7, fidelity: 5 },
  { label: "30D", days: 30, fidelity: 60 },
  { label: "ALL", days: 365, fidelity: 360 },
];

function bucketTimestamp(tsSeconds: number, fidelityMinutes: number): number {
  const bucketSec = Math.max(fidelityMinutes, 1) * 60;
  return Math.floor(tsSeconds / bucketSec) * bucketSec;
}

function mergeMoneylineChartData(
  series: { label: string; points: { t: number; p: number }[] | undefined }[],
  fidelityMinutes: number,
): Record<string, number | string>[] {
  const rows = new Map<number, Record<string, number | string>>();

  for (const { label, points } of series) {
    const sorted = [...(points ?? [])].sort((a, b) => a.t - b.t);
    for (const point of sorted) {
      const key = bucketTimestamp(point.t, fidelityMinutes);
      const row = rows.get(key) ?? { time: key * 1000 };
      row[label] = Math.round(point.p * 100);
      rows.set(key, row);
    }
  }

  return Array.from(rows.values()).sort(
    (a, b) => Number(a.time) - Number(b.time),
  );
}

function extendChartToNow(
  chartData: Record<string, number | string>[],
  now: number,
  labels: string[],
): Record<string, number | string>[] {
  if (!chartData.length || !labels.length) return chartData;

  const tail: Record<string, number | string> = { time: now };
  for (const label of labels) {
    for (let i = chartData.length - 1; i >= 0; i--) {
      const value = chartData[i][label];
      if (typeof value === "number") {
        tail[label] = value;
        break;
      }
    }
  }

  if (Object.keys(tail).length <= 1) return chartData;
  return [...chartData, tail];
}

const LINE_COLORS: Record<SoccerOutcomeKey, string> = {
  home: "#3b82f6",
  draw: "#94a3b8",
  away: "#f59e0b",
};

function lineLabel(
  outcomeKey: SoccerOutcomeKey,
  home: SoccerTeam,
  away: SoccerTeam,
): string {
  if (outcomeKey === "draw") return "DRAW";
  return teamAbbrev(outcomeKey === "home" ? home : away);
}

function useMergedMoneylineHistory(
  moneyline: SoccerMarketGroup,
  home: SoccerTeam,
  away: SoccerTeam,
  fidelity: number,
  days: number,
) {
  const homeToken = moneyline.home
    ? parseTokenIds(moneyline.home)[0]
    : undefined;
  const drawToken = moneyline.draw
    ? parseTokenIds(moneyline.draw)[0]
    : undefined;
  const awayToken = moneyline.away
    ? parseTokenIds(moneyline.away)[0]
    : undefined;

  const homeHistory = usePriceHistory(homeToken, fidelity, days);
  const drawHistory = usePriceHistory(drawToken, fidelity, days);
  const awayHistory = usePriceHistory(awayToken, fidelity, days);

  return useMemo(() => {
    const labels = SOCCER_OUTCOME_ORDER.flatMap((outcomeKey) => {
      if (!moneyline[outcomeKey]) return [];
      return [lineLabel(outcomeKey, home, away)];
    });

    const chartData = mergeMoneylineChartData(
      SOCCER_OUTCOME_ORDER.flatMap((outcomeKey) => {
        if (!moneyline[outcomeKey]) return [];
        const points =
          outcomeKey === "home"
            ? homeHistory.data
            : outcomeKey === "draw"
              ? drawHistory.data
              : awayHistory.data;
        return [{ label: lineLabel(outcomeKey, home, away), points }];
      }),
      fidelity,
    );

    const hasAnyData =
      (homeHistory.data?.length ?? 0) > 0 ||
      (drawHistory.data?.length ?? 0) > 0 ||
      (awayHistory.data?.length ?? 0) > 0;

    return {
      chartData,
      labels,
      isLoading:
        !hasAnyData &&
        (homeHistory.isFetching ||
          drawHistory.isFetching ||
          awayHistory.isFetching),
    };
  }, [
    away,
    awayHistory.data,
    awayHistory.isFetching,
    drawHistory.data,
    drawHistory.isFetching,
    fidelity,
    home,
    homeHistory.data,
    homeHistory.isFetching,
    moneyline,
  ]);
}

export function SoccerMoneylinePriceChart({
  moneyline,
  home,
  away,
}: {
  moneyline: SoccerMarketGroup;
  home: SoccerTeam;
  away: SoccerTeam;
}) {
  const [rangeIdx, setRangeIdx] = useState(0);
  const range = timeRanges[rangeIdx];
  const [now, setNow] = useState(Date.now());
  const tickRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    tickRef.current = setInterval(() => setNow(Date.now()), 1000);
    return () => {
      if (tickRef.current) clearInterval(tickRef.current);
    };
  }, []);

  const { chartData, labels, isLoading } = useMergedMoneylineHistory(
    moneyline,
    home,
    away,
    range.fidelity,
    range.days,
  );

  const hasAnyMarket = SOCCER_OUTCOME_ORDER.some((key) => moneyline[key]);
  const extendedData = useMemo(
    () => extendChartToNow(chartData, now, labels),
    [chartData, now, labels],
  );

  if (!hasAnyMarket) {
    return (
      <div className="flex h-64 items-center justify-center text-sm text-muted">
        No moneyline markets available
      </div>
    );
  }

  return (
    <div>
      <div className="mb-4 flex items-center justify-end">
        <div className="flex gap-1 rounded-xl bg-input p-1">
          {timeRanges.map((item, index) => (
            <button
              key={item.label}
              type="button"
              onClick={() => setRangeIdx(index)}
              className={cn(
                "rounded-lg px-3 py-1 text-xs font-medium transition-colors",
                index === rangeIdx
                  ? "bg-card-border text-foreground"
                  : "text-muted hover:text-foreground",
              )}
            >
              {item.label}
            </button>
          ))}
        </div>
      </div>

      {isLoading ? (
        <div className="flex h-64 items-center justify-center">
          <div className="h-5 w-5 animate-spin rounded-full border-2 border-brand border-t-transparent" />
        </div>
      ) : extendedData.length === 0 ? (
        <div className="flex h-64 items-center justify-center text-sm text-muted">
          No data for this period
        </div>
      ) : (
        <ResponsiveContainer width="100%" height={280}>
          <LineChart data={extendedData}>
            <XAxis
              dataKey="time"
              type="number"
              domain={["dataMin", "dataMax"]}
              tickFormatter={(ts) => {
                const date = new Date(ts);
                return range.days <= 1
                  ? date.toLocaleTimeString([], {
                      hour: "2-digit",
                      minute: "2-digit",
                    })
                  : date.toLocaleDateString([], {
                      month: "short",
                      day: "numeric",
                    });
              }}
              axisLine={false}
              tickLine={false}
              tick={{ fill: "#7b8aa3", fontSize: 11 }}
              minTickGap={50}
            />
            <YAxis
              domain={[0, 100]}
              axisLine={false}
              tickLine={false}
              tick={{ fill: "#7b8aa3", fontSize: 11 }}
              tickFormatter={(value) => `${value}¢`}
              width={45}
            />
            <Tooltip
              contentStyle={{
                background: "#0d1b3e",
                border: "1px solid #1a2a52",
                borderRadius: "12px",
                padding: "8px 12px",
              }}
              labelFormatter={(ts) =>
                new Date(ts).toLocaleString([], {
                  month: "short",
                  day: "numeric",
                  hour: "2-digit",
                  minute: "2-digit",
                })
              }
              formatter={(value: number | undefined, name) => [
                `${value ?? 0}¢`,
                name,
              ]}
            />
            {SOCCER_OUTCOME_ORDER.map((outcomeKey) => {
              const market = moneyline[outcomeKey];
              if (!market) return null;
              const label = lineLabel(outcomeKey, home, away);
              return (
                <Line
                  key={outcomeKey}
                  type="monotone"
                  dataKey={label}
                  stroke={LINE_COLORS[outcomeKey]}
                  strokeWidth={2}
                  dot={false}
                  connectNulls
                />
              );
            })}
          </LineChart>
        </ResponsiveContainer>
      )}

      {extendedData.length > 0 && (
        <div className="mt-3 flex flex-wrap items-center justify-center gap-x-5 gap-y-2">
          {SOCCER_OUTCOME_ORDER.map((outcomeKey) => {
            const market = moneyline[outcomeKey];
            if (!market) return null;
            const label = lineLabel(outcomeKey, home, away);
            const color = LINE_COLORS[outcomeKey];
            return (
              <div
                key={outcomeKey}
                className="flex items-center gap-2 text-xs font-medium"
              >
                <span
                  className="inline-block h-0.5 w-5 rounded-full"
                  style={{ backgroundColor: color }}
                />
                <span style={{ color }}>{label}</span>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
