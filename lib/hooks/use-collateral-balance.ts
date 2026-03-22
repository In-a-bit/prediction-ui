"use client";

import { useQuery, type QueryClient } from "@tanstack/react-query";
import { useMagic } from "@/components/providers/magic-provider";
import {
  getCollateralBalance,
  type CollateralBalanceResponse,
} from "@/lib/dpm-api";

/** Root segment for query keys — use with `invalidateQueries` to refresh every consumer. */
export const COLLATERAL_BALANCE_QUERY_ROOT = "collateral-balance" as const;

export function collateralBalanceQueryKey(
  walletAddress: string | null | undefined,
) {
  return walletAddress
    ? ([COLLATERAL_BALANCE_QUERY_ROOT, walletAddress.toLowerCase()] as const)
    : ([COLLATERAL_BALANCE_QUERY_ROOT, "disconnected"] as const);
}

/** Invalidate all collateral balance queries (header, portfolio, modals, etc.). */
export function invalidateAllCollateralBalances(queryClient: QueryClient) {
  return queryClient.invalidateQueries({
    queryKey: [COLLATERAL_BALANCE_QUERY_ROOT],
  });
}

/**
 * Shared on-chain collateral (USDC) balance for the Magic proxy wallet address.
 * All components should use this hook so refetch / invalidate stays in sync.
 */
export function useCollateralBalance() {
  const { walletAddress } = useMagic();

  const query = useQuery<CollateralBalanceResponse, Error>({
    queryKey: collateralBalanceQueryKey(walletAddress),
    queryFn: async () => {
      const data = await getCollateralBalance(walletAddress!);
      if (!data) {
        throw new Error("Failed to load collateral balance");
      }
      return data;
    },
    enabled: Boolean(walletAddress),
  });

  return {
    walletAddress,
    balanceNormalized: query.data?.balance_normalized ?? null,
    /** True until the first successful fetch for this address. */
    isPending: query.isPending,
    /** True during any fetch (initial or refetch). */
    isFetching: query.isFetching,
    isError: query.isError,
    refetch: query.refetch,
  };
}
