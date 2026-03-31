"use client";

import { usePriceHistory } from "@/lib/hooks/use-prices";
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
} from "recharts";
import { useState, useEffect, useRef } from "react";
import { cn } from "@/lib/utils";

const timeRanges = [
  { label: "24H", days: 1, fidelity: 5 },
  { label: "7D", days: 7, fidelity: 60 },
  { label: "30D", days: 30, fidelity: 360 },
  { label: "ALL", days: 365, fidelity: 1440 },
];

export function PriceChart({ tokenId }: { tokenId: string | undefined }) {
  const [rangeIdx, setRangeIdx] = useState(1); // default 7D
  const range = timeRanges[rangeIdx];

  const { data: history, isLoading } = usePriceHistory(
    tokenId,
    range.fidelity,
    range.days
  );

  // Tick every second so the chart's right edge always shows "now",
  // extending the last known price to the current timestamp.
  const [now, setNow] = useState(Date.now());
  const tickRef = useRef<ReturnType<typeof setInterval> | null>(null);
  useEffect(() => {
    tickRef.current = setInterval(() => setNow(Date.now()), 1000);
    return () => { if (tickRef.current) clearInterval(tickRef.current); };
  }, []);

  if (!tokenId) {
    return (
      <div className="flex h-64 items-center justify-center text-sm text-muted">
        No price data available
      </div>
    );
  }

  const baseData = (history ?? []).map((point) => ({
    time: point.t * 1000,
    price: Math.round(point.p * 100),
  }));

  // Append a "now" point carrying the last known price so the line
  // stretches to the current second.
  const lastPoint = baseData.length ? baseData[baseData.length - 1] : null;
  const chartData = lastPoint
    ? [...baseData, { time: now, price: lastPoint.price }]
    : baseData;

  const currentPrice = lastPoint?.price ?? 0;
  const firstPrice = baseData.length ? baseData[0].price : 0;
  const priceChange = currentPrice - firstPrice;
  const isPositive = priceChange >= 0;

  return (
    <div>
      {/* Range selector */}
      <div className="mb-4 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="text-2xl font-bold text-foreground">
            {currentPrice}¢
          </span>
          <span
            className={cn(
              "text-sm font-medium",
              isPositive ? "text-green" : "text-red"
            )}
          >
            {isPositive ? "+" : ""}
            {priceChange}¢
          </span>
        </div>
        <div className="flex gap-1 rounded-xl bg-input p-1">
          {timeRanges.map((r, i) => (
            <button
              key={r.label}
              onClick={() => setRangeIdx(i)}
              className={cn(
                "rounded-lg px-3 py-1 text-xs font-medium transition-colors",
                i === rangeIdx
                  ? "bg-card-border text-foreground"
                  : "text-muted hover:text-foreground"
              )}
            >
              {r.label}
            </button>
          ))}
        </div>
      </div>

      {/* Chart */}
      {isLoading ? (
        <div className="flex h-64 items-center justify-center">
          <div className="h-5 w-5 animate-spin rounded-full border-2 border-brand border-t-transparent" />
        </div>
      ) : chartData.length === 0 ? (
        <div className="flex h-64 items-center justify-center text-sm text-muted">
          No data for this period
        </div>
      ) : (
        <ResponsiveContainer width="100%" height={260}>
          <AreaChart data={chartData}>
            <defs>
              <linearGradient id="priceGradient" x1="0" y1="0" x2="0" y2="1">
                <stop
                  offset="0%"
                  stopColor={isPositive ? "#00ab67" : "#ff4d4d"}
                  stopOpacity={0.3}
                />
                <stop
                  offset="100%"
                  stopColor={isPositive ? "#00ab67" : "#ff4d4d"}
                  stopOpacity={0}
                />
              </linearGradient>
            </defs>
            <XAxis
              dataKey="time"
              type="number"
              domain={["dataMin", "dataMax"]}
              tickFormatter={(ts) => {
                const d = new Date(ts);
                return range.days <= 1
                  ? d.toLocaleTimeString([], {
                      hour: "2-digit",
                      minute: "2-digit",
                    })
                  : d.toLocaleDateString([], {
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
              domain={["auto", "auto"]}
              axisLine={false}
              tickLine={false}
              tick={{ fill: "#7b8aa3", fontSize: 11 }}
              tickFormatter={(v) => `${v}¢`}
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
              formatter={(value: number | undefined) => [
                `${value ?? 0}¢`,
                "Price",
              ]}
            />
            <Area
              type="monotone"
              dataKey="price"
              stroke={isPositive ? "#00ab67" : "#ff4d4d"}
              strokeWidth={2}
              fill="url(#priceGradient)"
              dot={false}
              activeDot={{
                r: 4,
                fill: isPositive ? "#00ab67" : "#ff4d4d",
                stroke: "#0d1b3e",
                strokeWidth: 2,
              }}
            />
          </AreaChart>
        </ResponsiveContainer>
      )}
    </div>
  );
}
