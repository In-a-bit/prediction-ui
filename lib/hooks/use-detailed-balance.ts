"use client";

import { useQuery } from "@tanstack/react-query";
import { useWallet } from "@/components/providers/wallet-provider";
import {
  getUserDetailedBalance,
  type UserDetailResponse,
} from "@/lib/dpm-api";

export type DetailedBalanceData = {
  onchain: string | null;
  db: string | null;
  engine: string | null;
  locked: string | null;
};

export function useDetailedBalance() {
  const { userProfile } = useWallet();
  const proxyWallet = userProfile?.proxyWallet ?? null;

  const query = useQuery<UserDetailResponse | null, Error>({
    queryKey: ["detailed-balance", proxyWallet?.toLowerCase()],
    queryFn: () => getUserDetailedBalance(proxyWallet!),
    enabled: Boolean(proxyWallet),
    staleTime: 30_000,
  });

  const user = query.data;

  const detailed: DetailedBalanceData = {
    onchain: null,
    db: user?.balance?.usdc_balance ?? null,
    engine: user?.engine_balance?.usdc_balance ?? null,
    locked: user?.engine_balance?.usdc_locked ?? null,
  };

  return {
    detailed,
    userId: user?.id ?? null,
    isPending: query.isPending,
    refetch: query.refetch,
  };
}
