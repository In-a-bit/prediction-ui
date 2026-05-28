"use client";

import { useEffect, useState } from "react";

import {
  countdownTargetSec,
  formatCryptoPriceToBeat,
  isUpcomingSlot,
  type CryptoChartMode,
  type CryptoUpdownMetadata,
} from "@/lib/crypto-updown";
import { cn } from "@/lib/utils";

function formatCountdown(secondsLeft: number): string {
  const s = Math.max(0, secondsLeft);
  const mins = Math.floor(s / 60);
  const secs = s % 60;
  return `${String(mins).padStart(2, "0")} MIN ${String(secs).padStart(2, "0")} SECS`;
}

interface CryptoPriceMetricsProps {
  meta: CryptoUpdownMetadata;
  chartMode: CryptoChartMode;
  priceToBeatRaw: string | null;
  priceToBeat: number | null;
  currentPrice: number | null;
  target?: string;
}

export function CryptoPriceMetrics({
  meta,
  chartMode,
  priceToBeatRaw,
  priceToBeat,
  currentPrice,
  target,
}: CryptoPriceMetricsProps) {
  const [nowMs, setNowMs] = useState(0);

  useEffect(() => {
    const id = setInterval(() => setNowMs(Date.now()), 1000);
    return () => clearInterval(id);
  }, []);

  const beatLabel =
    priceToBeatRaw != null
      ? formatCryptoPriceToBeat(priceToBeatRaw, target)
      : "—";

  const currentLabel =
    currentPrice != null
      ? formatCryptoPriceToBeat(String(currentPrice), target)
      : "—";

  const delta =
    currentPrice != null && priceToBeat != null
      ? currentPrice - priceToBeat
      : null;
  const deltaPositive = delta != null && delta >= 0;

  const effectiveNow = nowMs || 0;
  const targetSec = countdownTargetSec(meta, effectiveNow || undefined);
  const secondsLeft =
    effectiveNow > 0
      ? Math.max(0, Math.floor(targetSec - effectiveNow / 1000))
      : 0;
  const upcoming = effectiveNow > 0 && isUpcomingSlot(meta, effectiveNow);

  return (
    <div className="mb-4 grid gap-4 sm:grid-cols-3">
      <div>
        <p className="text-xs font-medium uppercase tracking-wide text-muted">
          Price to beat
        </p>
        <p className="mt-1 text-2xl font-bold text-foreground lg:text-3xl">
          {beatLabel}
        </p>
      </div>

      <div>
        <p className="text-xs font-medium uppercase tracking-wide text-brand">
          Current price
        </p>
        {delta != null && (
          <p
            className={cn(
              "text-xs font-medium",
              deltaPositive ? "text-green" : "text-red",
            )}
          >
            {deltaPositive ? "▲" : "▼"} $
            {Math.abs(delta).toLocaleString("en-US", {
              minimumFractionDigits: 0,
              maximumFractionDigits: 0,
            })}
          </p>
        )}
        <p className="mt-0.5 text-2xl font-bold text-brand lg:text-3xl">
          {currentLabel}
        </p>
      </div>

      <div className="sm:text-right">
        <p className="text-xs font-medium uppercase tracking-wide text-muted">
          {upcoming ? "Starts in" : chartMode === "past" ? "Ended" : "Time left"}
        </p>
        <p className="mt-1 text-xl font-bold tabular-nums text-brand lg:text-2xl">
          {chartMode === "past"
            ? "—"
            : formatCountdown(secondsLeft)}
        </p>
      </div>
    </div>
  );
}
