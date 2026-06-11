"use client";

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useMagic } from "@/components/providers/magic-provider";
import type { OpenOrder } from "@inabit-com/dpm-sdk";

export type { OpenOrder };

/** Orders removed after a successful cancel while the engine catches up. */
const pendingCancelledOrderIds = new Set<string>();

function openOrdersQueryKey(walletAddress: string | null | undefined) {
  return ["open-orders", walletAddress?.toLowerCase()] as const;
}

function filterPendingCancelled(orders: OpenOrder[]): OpenOrder[] {
  if (pendingCancelledOrderIds.size === 0) return orders;
  return orders.filter((order) => !pendingCancelledOrderIds.has(order.id));
}

function clearPendingIfGone(
  orders: OpenOrder[] | undefined,
  orderHash: string,
) {
  if (!orders?.some((order) => order.id === orderHash)) {
    pendingCancelledOrderIds.delete(orderHash);
  }
}

async function syncOpenOrdersAfterCancel(
  queryClient: ReturnType<typeof useQueryClient>,
  queryKey: ReturnType<typeof openOrdersQueryKey>,
  orderHash: string,
) {
  await queryClient.refetchQueries({ queryKey });
  const orders = queryClient.getQueryData<OpenOrder[]>(queryKey);
  clearPendingIfGone(orders, orderHash);
  queryClient.setQueryData<OpenOrder[]>(queryKey, (current) =>
    filterPendingCancelled(current ?? []),
  );
}

export function useOpenOrders() {
  const { dpmSdk, walletAddress } = useMagic();
  const queryKey = openOrdersQueryKey(walletAddress);

  return useQuery({
    queryKey,
    queryFn: async () => {
      if (!dpmSdk) throw new Error("DPM SDK not ready");
      console.log("[useOpenOrders] fetchOpenOrders: begin");
      const orders = await dpmSdk.fetchOpenOrders();
      return filterPendingCancelled(orders);
    },
    enabled: Boolean(dpmSdk) && Boolean(walletAddress),
  });
}

export interface CancelOrderParams {
  orderHash: string;
  marketId: string;
}

export function useCancelOrder() {
  const { dpmSdk, walletAddress } = useMagic();
  const queryClient = useQueryClient();
  const queryKey = openOrdersQueryKey(walletAddress);

  return useMutation({
    mutationFn: async ({ orderHash, marketId }: CancelOrderParams) => {
      if (!dpmSdk) throw new Error("DPM SDK not ready");
      console.log("[useCancelOrder] cancelOrder: begin", { orderHash, marketId });
      return dpmSdk.cancelOrder(orderHash, marketId);
    },
    onSuccess: async (_data, { orderHash }) => {
      pendingCancelledOrderIds.add(orderHash);
      queryClient.setQueryData<OpenOrder[]>(queryKey, (current) =>
        (current ?? []).filter((order) => order.id !== orderHash),
      );

      await syncOpenOrdersAfterCancel(queryClient, queryKey, orderHash);

      // Cancel is async in the engine; follow up once more.
      window.setTimeout(() => {
        void syncOpenOrdersAfterCancel(queryClient, queryKey, orderHash);
      }, 1500);
    },
  });
}
