"use client";

import { useMutation, useQueryClient, type QueryClient } from "@tanstack/react-query";
import { useTrading } from "@/components/providers/trading-provider";
import { invalidateAllCollateralBalances } from "@/lib/hooks/use-collateral-balance";

export type SplitMergeAction = "split" | "merge";

export interface SplitMergeParams {
  action: SplitMergeAction;
  conditionId: string;
  /** USDC decimal string, e.g. "10.5". Splitting mints this many of each outcome. */
  amountDecimal: string;
  /**
   * Sends the output elsewhere: both outcome tokens for a split, the released
   * collateral for a merge. Omit to keep it in the proxy wallet.
   */
  recipient?: string;
}

/**
 * Refresh what a split or merge moves. Both cross the USDC/outcome-token
 * boundary in one direction or the other, so neither side can be assumed stale.
 */
function refreshAfterSplitMerge(queryClient: QueryClient) {
  return Promise.all([
    queryClient.invalidateQueries({ queryKey: ["token-balances"] }),
    queryClient.invalidateQueries({ queryKey: ["positions"] }),
    invalidateAllCollateralBalances(queryClient),
  ]);
}

export function useSplitMerge() {
  const { dpmSdk } = useTrading();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      action,
      conditionId,
      amountDecimal,
      recipient,
    }: SplitMergeParams) => {
      if (!dpmSdk) throw new Error("DPM SDK not ready");
      console.log(`[useSplitMerge] ${action}: begin`, {
        conditionId,
        amountDecimal,
        recipient,
      });
      return action === "split"
        ? dpmSdk.submitSplitPosition(conditionId, amountDecimal, recipient)
        : dpmSdk.submitMergePositions(conditionId, amountDecimal, recipient);
    },
    onSuccess: async (_data, { action, conditionId }) => {
      console.log(`[useSplitMerge] ${action}: success`, { conditionId });
      await refreshAfterSplitMerge(queryClient);
      // The relayer confirms and indexes asynchronously, so the immediate
      // refetch can still read pre-transaction balances. Follow up once.
      window.setTimeout(() => {
        void refreshAfterSplitMerge(queryClient);
      }, 1500);
    },
  });
}
