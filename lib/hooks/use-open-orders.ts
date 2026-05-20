"use client";

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useMagic } from "@/components/providers/magic-provider";
import type { OpenOrder } from "@inabit-com/dpm-sdk";

export type { OpenOrder };

export function useOpenOrders() {
  const { dpmSdk, walletAddress } = useMagic();

  return useQuery({
    queryKey: ["open-orders", walletAddress?.toLowerCase()],
    queryFn: async () => {
      if (!dpmSdk) throw new Error("DPM SDK not ready");
      console.log("[useOpenOrders] fetchOpenOrders: begin");
      return dpmSdk.fetchOpenOrders();
    },
    enabled: Boolean(dpmSdk) && Boolean(walletAddress),
  });
}

export interface CancelOrderParams {
  orderHash: string;
  marketId: string;
}

export function useCancelOrder() {
  const { dpmSdk } = useMagic();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ orderHash, marketId }: CancelOrderParams) => {
      if (!dpmSdk) throw new Error("DPM SDK not ready");
      console.log("[useCancelOrder] cancelOrder: begin", { orderHash, marketId });
      return dpmSdk.cancelOrder(orderHash, marketId);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["open-orders"] });
    },
  });
}
