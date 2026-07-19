"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useTrading } from "@/components/providers/trading-provider";
import { invalidateAllCollateralBalances } from "@/lib/hooks/use-collateral-balance";

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
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["positions"] });
      invalidateAllCollateralBalances(queryClient);
    },
  });
}
