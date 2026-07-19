"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useTrading } from "@/components/providers/trading-provider";
import { invalidateAllCollateralBalances } from "@/lib/hooks/use-collateral-balance";
import {
  markPositionRedeemed,
  removeRedeemedFromCache,
  syncPositionsAfterRedeem,
} from "@/lib/hooks/use-positions";

export interface RedeemPositionParams {
  conditionId: string;
}

export function useRedeemPosition() {
  const { dpmSdk } = useTrading();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ conditionId }: RedeemPositionParams) => {
      if (!dpmSdk) throw new Error("DPM SDK not ready");
      console.log("[useRedeemPosition] submitRedeemPositions: begin", { conditionId });
      return dpmSdk.submitRedeemPositions(conditionId);
    },
    onSuccess: (_data, { conditionId }) => {
      console.log("[useRedeemPosition] submitRedeemPositions: success", { conditionId });
      // Optimistically hide the redeemed market, then reconcile with the server.
      markPositionRedeemed(conditionId);
      removeRedeemedFromCache(queryClient, conditionId);
      invalidateAllCollateralBalances(queryClient);

      // The data-api indexes on-chain state asynchronously; follow up once more
      // so the row stays gone (or reappears only if redeem truly did not land).
      void syncPositionsAfterRedeem(queryClient, conditionId);
      window.setTimeout(() => {
        void syncPositionsAfterRedeem(queryClient, conditionId);
      }, 1500);
    },
  });
}
