"use client";

import { useQuery } from "@tanstack/react-query";
import { useMagic } from "@/components/providers/magic-provider";

const DATA_API_URL = process.env.NEXT_PUBLIC_DATA_API_URL!;

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

async function fetchPositions(proxyWallet: string): Promise<Position[]> {
  const res = await fetch(
    `${DATA_API_URL}/positions?user=${encodeURIComponent(proxyWallet)}`,
  );
  if (!res.ok) {
    const body = await res.text().catch(() => "");
    throw new Error(`Failed to fetch positions (${res.status}): ${body}`);
  }
  const json = await res.json();
  return Array.isArray(json) ? json : [];
}

export function usePositions() {
  const { walletAddress } = useMagic();

  return useQuery({
    queryKey: ["positions", walletAddress?.toLowerCase()],
    queryFn: () => {
      if (!walletAddress) throw new Error("No wallet address");
      return fetchPositions(walletAddress);
    },
    enabled: Boolean(walletAddress),
  });
}
