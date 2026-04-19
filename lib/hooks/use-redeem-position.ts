"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useMagic } from "@/components/providers/magic-provider";
import type { MagicLike } from "@/lib/allowance-relayer";
import { submitRedeemPositions } from "@/lib/redeem-relayer";
import { invalidateAllCollateralBalances } from "@/lib/hooks/use-collateral-balance";

export interface RedeemPositionParams {
  conditionId: string;
}

export function useRedeemPosition() {
  const { magic, userProfile, walletAddress } = useMagic();
  const queryClient = useQueryClient();
  const proxyWallet = userProfile?.proxyWallet ?? walletAddress ?? "";

  return useMutation({
    mutationFn: async ({ conditionId }: RedeemPositionParams) => {
      if (!magic) throw new Error("Magic not initialized");
      if (!proxyWallet) throw new Error("No proxy wallet");

      const relayerUrl = process.env.NEXT_PUBLIC_RELAYER_API_URL;
      return submitRedeemPositions(
        magic as unknown as MagicLike,
        relayerUrl,
        proxyWallet,
        conditionId,
      );
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["positions"] });
      invalidateAllCollateralBalances(queryClient);
    },
  });
}
