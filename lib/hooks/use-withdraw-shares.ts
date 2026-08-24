"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";

export interface WithdrawSharesParams {
  tokenId: string;
  amountDecimal: string;
  recipient: string;
}

export function useWithdrawShares() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      tokenId,
      amountDecimal,
      recipient,
    }: WithdrawSharesParams) => {
      const res = await fetch("/api/lp/withdraw-shares", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ tokenId, amount: amountDecimal, recipient }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? "withdraw failed");
      return json as { transactionHash: string; state: string };
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["token-balances"] });
      await queryClient.invalidateQueries({ queryKey: ["positions"] });
      window.setTimeout(() => {
        void queryClient.invalidateQueries({ queryKey: ["token-balances"] });
        void queryClient.invalidateQueries({ queryKey: ["positions"] });
      }, 1500);
    },
  });
}
