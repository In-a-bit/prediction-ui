"use client";

import { useQuery, type QueryClient } from "@tanstack/react-query";
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

/**
 * Positions optimistically hidden after a successful redeem, while the data-api
 * catches up with on-chain state. Keyed by conditionId (redeem is per-market).
 */
const pendingRedeemedConditionIds = new Set<string>();

function filterPendingRedeemed(positions: Position[]): Position[] {
  if (pendingRedeemedConditionIds.size === 0) return positions;
  return positions.filter((p) => !pendingRedeemedConditionIds.has(p.conditionId));
}

/** Mark a market's positions as redeemed so they disappear immediately. */
export function markPositionRedeemed(conditionId: string): void {
  pendingRedeemedConditionIds.add(conditionId);
}

/** Drop the redeemed positions from every cached positions query right away. */
export function removeRedeemedFromCache(
  queryClient: QueryClient,
  conditionId: string,
): void {
  queryClient.setQueriesData<Position[]>(
    { queryKey: ["positions"] },
    (current) =>
      current ? current.filter((p) => p.conditionId !== conditionId) : current,
  );
}

/**
 * Refetch positions after a redeem, then stop hiding the market once the
 * server no longer returns it (otherwise keep it filtered out of the cache).
 */
export async function syncPositionsAfterRedeem(
  queryClient: QueryClient,
  conditionId: string,
): Promise<void> {
  console.log("[usePositions] syncPositionsAfterRedeem: refetch", { conditionId });
  await queryClient.refetchQueries({ queryKey: ["positions"] });

  const entries = queryClient.getQueriesData<Position[]>({ queryKey: ["positions"] });
  const stillPresent = entries.some(([, data]) =>
    data?.some((p) => p.conditionId === conditionId),
  );
  if (!stillPresent) {
    pendingRedeemedConditionIds.delete(conditionId);
    return;
  }
  removeRedeemedFromCache(queryClient, conditionId);
}

export function usePositions() {
  const { walletAddress } = useTrading();
  const { serviceBase, id } = useMarketSurface();
  const dataBase = serviceBase("data");

  return useQuery({
    queryKey: ["positions", id, dataBase, walletAddress?.toLowerCase()],
    queryFn: async () => {
      if (!walletAddress) throw new Error("No wallet address");
      const positions = await fetchPositions(dataBase, walletAddress);
      return filterPendingRedeemed(positions);
    },
    enabled: Boolean(walletAddress),
  });
}
