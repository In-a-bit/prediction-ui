"use client";

import { useEffect, useState } from "react";

import {
  countdownTargetSec,
  formatCryptoPriceToBeat,
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
  const [nowMs, setNowMs] = useState<number | null>(null);
  const [countdownVisible, setCountdownVisible] = useState(false);

  useEffect(() => {
    setNowMs(Date.now());
    const id = setInterval(() => setNowMs(Date.now()), 1000);
    return () => clearInterval(id);
  }, []);

  useEffect(() => {
    if (nowMs == null || chartMode === "past") {
      setCountdownVisible(false);
      return;
    }
    setCountdownVisible(false);
    const frame = requestAnimationFrame(() => setCountdownVisible(true));
    return () => cancelAnimationFrame(frame);
  }, [nowMs, chartMode]);

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

  const countdownReady = nowMs != null;
  const targetSec = countdownReady
    ? countdownTargetSec(meta, nowMs)
    : 0;
  const secondsLeft = countdownReady
    ? Math.max(0, Math.floor(targetSec - nowMs / 1000))
    : 0;

  const countdownLabel =
    chartMode === "past"
      ? "Ended"
      : chartMode === "upcoming"
        ? "Starts in"
        : "Time left";

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
        <div className="flex items-center gap-2">
          <p className="text-xs font-medium uppercase tracking-wide text-brand">
            Current price
          </p>
          {delta != null && (
            <span
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
            </span>
          )}
        </div>
        <p className="mt-1 text-2xl font-bold text-brand lg:text-3xl">
          {currentLabel}
        </p>
      </div>

      <div className="sm:text-right">
        <p className="text-xs font-medium uppercase tracking-wide text-muted">
          {countdownLabel}
        </p>
        {chartMode === "past" ? (
          <p className="mt-1 text-xl font-bold tabular-nums text-brand lg:text-2xl">
            —
          </p>
        ) : countdownReady ? (
          <p
            className={cn(
              "mt-1 text-xl font-bold tabular-nums text-brand transition-opacity duration-500 ease-out lg:text-2xl",
              countdownVisible ? "opacity-100" : "opacity-0",
            )}
          >
            {formatCountdown(secondsLeft)}
          </p>
        ) : (
          <p
            className="mt-1 text-xl font-bold lg:text-2xl"
            aria-hidden
          >
            &nbsp;
          </p>
        )}
      </div>
    </div>
  );
}
