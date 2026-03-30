"use client";

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useMagic } from "@/components/providers/magic-provider";
import { getOrDeriveClobCredentials } from "@/lib/clob-auth";
import { buildHmacHeaders, signCancelMessage } from "@/lib/clob-order";

const CLOB_API_URL = process.env.NEXT_PUBLIC_CLOB_API_URL!;

export interface OpenOrder {
  id: string;
  status: string;
  owner: string;
  maker_address: string;
  market: string;
  asset_id: string;
  side: string;
  original_size: string;
  size_matched: string;
  price: string;
  outcome: string;
  expiration: string;
  order_type: string;
  associate_trades: string[];
  created_at: number;
}

interface OpenOrdersResponse {
  data: OpenOrder[];
  next_cursor: string;
  limit: number;
  count: number;
}

async function fetchOpenOrders(
  magic: Parameters<typeof getOrDeriveClobCredentials>[0],
): Promise<OpenOrder[]> {
  const creds = await getOrDeriveClobCredentials(magic);
  const headers = await buildHmacHeaders(creds, "GET", "/data/orders");

  const res = await fetch(`${CLOB_API_URL}/data/orders`, {
    headers: { ...headers, "Content-Type": "application/json" },
  });
  if (!res.ok) {
    const body = await res.text().catch(() => "");
    throw new Error(`Failed to fetch open orders (${res.status}): ${body}`);
  }
  const json: OpenOrdersResponse = await res.json();
  return json.data ?? [];
}

export function useOpenOrders() {
  const { magic, walletAddress } = useMagic();

  return useQuery({
    queryKey: ["open-orders", walletAddress?.toLowerCase()],
    queryFn: () => {
      if (!magic) throw new Error("Magic not initialized");
      return fetchOpenOrders(magic);
    },
    enabled: Boolean(magic) && Boolean(walletAddress),
  });
}

export interface CancelOrderParams {
  orderHash: string;
  marketId: string;
}

export function useCancelOrder() {
  const { magic } = useMagic();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ orderHash, marketId }: CancelOrderParams) => {
      if (!magic) throw new Error("Magic not initialized");

      const info = await magic.user.getInfo();
      const eoa = info.wallets?.ethereum?.publicAddress;
      if (!eoa) throw new Error("No wallet address");

      const signature = await signCancelMessage(
        magic.rpcProvider,
        eoa,
        marketId,
        [orderHash],
      );

      const creds = await getOrDeriveClobCredentials(magic);
      const headers = await buildHmacHeaders(creds, "DELETE", "/order");

      const res = await fetch(`${CLOB_API_URL}/order`, {
        method: "DELETE",
        headers: { "Content-Type": "application/json", ...headers },
        body: JSON.stringify({
          order_hash: orderHash,
          market_id: marketId,
          signature,
        }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({ error: res.statusText }));
        throw new Error(body.error || `Cancel failed: ${res.status}`);
      }
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["open-orders"] });
    },
  });
}
