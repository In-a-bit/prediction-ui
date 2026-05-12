"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useMagic } from "@/components/providers/magic-provider";
import { invalidateAllCollateralBalances } from "@/lib/hooks/use-collateral-balance";

export interface RedeemPositionParams {
  conditionId: string;
}

export function useRedeemPosition() {
  const { dpmSdk, userProfile, walletAddress } = useMagic();
  const queryClient = useQueryClient();
  const proxyWallet = userProfile?.proxyWallet ?? walletAddress ?? "";

  return useMutation({
    mutationFn: async ({ conditionId }: RedeemPositionParams) => {
      if (!dpmSdk) throw new Error("DPM SDK not ready");
      if (!proxyWallet) throw new Error("No proxy wallet");
      console.log("[useRedeemPosition] submitRedeemPositions: begin", { conditionId });
      return dpmSdk.submitRedeemPositions(proxyWallet, conditionId);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["positions"] });
      invalidateAllCollateralBalances(queryClient);
    },
  });
}
