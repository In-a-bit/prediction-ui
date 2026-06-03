"use client";

import { CryptoPriceMetrics } from "@/components/crypto/crypto-price-metrics";
import { CryptoSpotPriceChart } from "@/components/crypto/crypto-spot-price-chart";
import {
  cryptoChartMode,
  getCryptoPriceToBeat,
  parseCryptoMetadata,
} from "@/lib/crypto-updown";
import { useCryptoSpotChart } from "@/lib/hooks/use-crypto-spot-chart";
import type { GammaEvent } from "@/lib/types/event";

interface CryptoSpotChartSectionProps {
  /** Selected slot — drives countdown / price-to-beat labels. */
  tradeEvent: GammaEvent;
  /** Spot chart data source — live slot when tradeEvent is upcoming. */
  chartEvent: GammaEvent;
  market?: { metadata?: Record<string, unknown> };
  chartMarket?: { metadata?: Record<string, unknown> };
}

export function CryptoSpotChartSection({
  tradeEvent,
  chartEvent,
  market,
  chartMarket,
}: CryptoSpotChartSectionProps) {
  const displayMeta = parseCryptoMetadata(tradeEvent);
  const chartMeta = parseCryptoMetadata(chartEvent);
  const spotChart = useCryptoSpotChart(chartEvent, chartMarket ?? market);

  if (!displayMeta || !chartMeta) return null;

  const displayChartMode = cryptoChartMode(displayMeta);
  const priceToBeatRaw = getCryptoPriceToBeat(tradeEvent, market);
  const priceToBeatNum = priceToBeatRaw ? Number(priceToBeatRaw) : null;

  return (
    <div className="border-t border-card-border pt-4">
      <CryptoPriceMetrics
        meta={displayMeta}
        chartMode={displayChartMode}
        priceToBeatRaw={priceToBeatRaw}
        priceToBeat={priceToBeatNum}
        currentPrice={spotChart.currentPrice}
        target={displayMeta.target}
      />
      <CryptoSpotPriceChart
        points={spotChart.points}
        priceToBeat={
          displayChartMode === "upcoming" ? null : spotChart.priceToBeat
        }
        liveMode={spotChart.liveMode}
        frozenAtMs={spotChart.frozenAtMs}
        slotStartSec={chartMeta.slot_start}
        intervalMinutes={chartMeta.interval_minutes}
        loading={spotChart.loading}
        error={spotChart.error}
        target={chartMeta.target}
      />
    </div>
  );
}
