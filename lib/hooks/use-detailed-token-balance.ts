"use client";

import { useQuery } from "@tanstack/react-query";
import { useDetailedBalance } from "@/lib/hooks/use-detailed-balance";
import {
  getUserTokenBalances,
  type TokenBalanceDetail,
} from "@/lib/dpm-api";

export function useDetailedTokenBalance(tokenId: string | undefined) {
  const { userId } = useDetailedBalance();

  const query = useQuery<TokenBalanceDetail | null, Error>({
    queryKey: ["detailed-token-balance", userId, tokenId],
    queryFn: async () => {
      const data = await getUserTokenBalances(userId!);
      if (!data) return null;
      return data.balances.find((b) => b.token_id === tokenId) ?? null;
    },
    enabled: Boolean(userId) && Boolean(tokenId),
    staleTime: 30_000,
  });

  return {
    tokenDetail: query.data ?? null,
    isPending: query.isPending,
    isFetching: query.isFetching,
    refetch: query.refetch,
  };
}
