"use client";

import { CryptoPriceMetrics } from "@/components/crypto/crypto-price-metrics";
import { CryptoSpotPriceChart } from "@/components/crypto/crypto-spot-price-chart";
import { parseCryptoMetadata } from "@/lib/crypto-updown";
import { useCryptoSpotChart } from "@/lib/hooks/use-crypto-spot-chart";
import type { GammaEvent } from "@/lib/types/event";

interface CryptoSpotChartSectionProps {
  tradeEvent: GammaEvent;
  market?: { metadata?: Record<string, unknown> };
}

export function CryptoSpotChartSection({
  tradeEvent,
  market,
}: CryptoSpotChartSectionProps) {
  const meta = parseCryptoMetadata(tradeEvent);
  const spotChart = useCryptoSpotChart(tradeEvent, market);

  if (!meta) return null;

  return (
    <div className="border-t border-card-border pt-4">
      <CryptoPriceMetrics
        meta={meta}
        chartMode={spotChart.chartMode}
        priceToBeatRaw={spotChart.priceToBeatRaw}
        priceToBeat={spotChart.priceToBeat}
        currentPrice={spotChart.currentPrice}
        target={meta.target}
      />
      <CryptoSpotPriceChart
        points={spotChart.points}
        priceToBeat={spotChart.priceToBeat}
        liveMode={spotChart.liveMode}
        frozenAtMs={spotChart.frozenAtMs}
        slotStartSec={meta.slot_start}
        loading={spotChart.loading}
        error={spotChart.error}
        target={meta.target}
      />
    </div>
  );
}
