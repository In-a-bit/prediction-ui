"use client";

import { useQuery } from "@tanstack/react-query";
import { useTrading } from "@/components/providers/trading-provider";
import { useMarketSurface } from "@/components/providers/market-surface-provider";

export interface Position {
  proxyWallet: string;
  asset: string;
  conditionId: string;
  size: number;
  avgPrice: number;
  initialValue: number;
  currentValue: number;
  cashPnl: number;
  percentPnl: number;
  totalBought: number;
  realizedPnl: number;
  percentRealizedPnl: number;
  curPrice: number;
  redeemable: boolean;
  mergeable: boolean;
  title: string;
  question: string;
  slug: string;
  icon: string;
  eventId: string;
  eventSlug: string;
  outcome: string;
  outcomeIndex: number;
  oppositeOutcome: string;
  oppositeAsset: string;
  endDate: string;
  negativeRisk: boolean;
}

async function fetchPositions(
  dataBase: string,
  proxyWallet: string,
): Promise<Position[]> {
  const res = await fetch(
    `${dataBase}/positions?user=${encodeURIComponent(proxyWallet)}`,
  );
  if (!res.ok) {
    const body = await res.text().catch(() => "");
    throw new Error(`Failed to fetch positions (${res.status}): ${body}`);
  }
  const json = await res.json();
  return Array.isArray(json) ? json : [];
}

export function usePositions() {
  const { walletAddress } = useTrading();
  const { serviceBase, id } = useMarketSurface();
  const dataBase = serviceBase("data");

  return useQuery({
    queryKey: ["positions", id, dataBase, walletAddress?.toLowerCase()],
    queryFn: () => {
      if (!walletAddress) throw new Error("No wallet address");
      return fetchPositions(dataBase, walletAddress);
    },
    enabled: Boolean(walletAddress),
  });
}
