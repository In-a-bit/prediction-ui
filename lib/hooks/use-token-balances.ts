"use client";

import { useQuery } from "@tanstack/react-query";
import { useMagic } from "@/components/providers/magic-provider";
import { getConditionalTokenBalanceBatch } from "@/lib/dpm-api";

const ONE_E18 = BigInt("1000000000000000000");

/** Convert a raw 1e18 balance string to a human-readable number. */
function rawToShares(raw: string): number {
  try {
    const val = BigInt(raw);
    const whole = val / ONE_E18;
    const frac = val % ONE_E18;
    return Number(whole) + Number(frac) / 1e18;
  } catch {
    return 0;
  }
}

/**
 * Fetches YES and NO conditional token balances for the connected wallet.
 * Makes a single batch call on mount and caches via TanStack Query.
 */
export function useTokenBalances(
  yesTokenId: string | undefined,
  noTokenId: string | undefined,
) {
  const { walletAddress } = useMagic();

  const query = useQuery({
    queryKey: [
      "token-balances",
      walletAddress?.toLowerCase(),
      yesTokenId,
      noTokenId,
    ],
    queryFn: async () => {
      const ids: string[] = [];
      if (yesTokenId) ids.push(yesTokenId);
      if (noTokenId) ids.push(noTokenId);

      if (ids.length === 0) return { yes: 0, no: 0 };

      const owners = ids.map(() => walletAddress!);
      const data = await getConditionalTokenBalanceBatch(owners, ids);
      if (!data) return { yes: 0, no: 0 };

      let yes = 0;
      let no = 0;
      for (const item of data.balances) {
        if (item.token_id === yesTokenId) yes = rawToShares(item.balance);
        if (item.token_id === noTokenId) no = rawToShares(item.balance);
      }
      return { yes, no };
    },
    enabled: Boolean(walletAddress) && Boolean(yesTokenId || noTokenId),
    staleTime: 30_000,
  });

  return {
    yesBalance: query.data?.yes ?? 0,
    noBalance: query.data?.no ?? 0,
    isPending: query.isPending,
    refetch: query.refetch,
  };
}
