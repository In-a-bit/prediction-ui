"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import { useQueryClient } from "@tanstack/react-query";
import type {
  AuthSession,
  ClobCredentials,
  DpmSdk,
  OpenOrder,
  OrderParams,
  SubmitOrderResult,
  UserProfile,
} from "@inabit-com/dpm-sdk/lp";

import { CryptoPricesWSProvider } from "@/components/providers/crypto-prices-ws-provider";
import { DataSourceProvider } from "@/components/providers/data-source-provider";
import { MarketSurfaceProvider } from "@/components/providers/market-surface-provider";
import { MarketWSProvider } from "@/components/providers/market-ws-provider";
import {
  TradingOverrideProvider,
  type TradingContextValue,
} from "@/components/providers/trading-provider";
import { lpBrowserServiceBase } from "@/lib/lp/direct-urls";
import type { LpPublicSession } from "@/lib/lp/types";

type WsUrls = { market: string; prices: string; user: string };

type LpConnectApi = {
  connect: (
    apiPrivateKey: string,
    eoaPrivateKey: string,
  ) => Promise<LpPublicSession>;
  refresh: () => Promise<void>;
  pub: LpPublicSession | null;
};

const LpConnectApiContext = createContext<LpConnectApi | null>(null);

export function useLpConnectApi() {
  const ctx = useContext(LpConnectApiContext);
  if (!ctx) {
    throw new Error("useLpConnectApi must be used within LpDemoProviders");
  }
  return ctx;
}

function createLpSdkProxy(): DpmSdk {
  const proxy = {
    async submitOrder(orderParams: OrderParams): Promise<SubmitOrderResult> {
      const res = await fetch("/api/lp/orders", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(orderParams),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? "submitOrder failed");
      return json as SubmitOrderResult;
    },
    async fetchOpenOrders(): Promise<OpenOrder[]> {
      const res = await fetch("/api/lp/orders");
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? "fetchOpenOrders failed");
      return (json.orders ?? []) as OpenOrder[];
    },
    async cancelOrder(orderHash: string, marketId: string): Promise<unknown> {
      const qs = new URLSearchParams({ marketId });
      const res = await fetch(
        `/api/lp/orders/${encodeURIComponent(orderHash)}?${qs}`,
        { method: "DELETE" },
      );
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? "cancelOrder failed");
      return json.result;
    },
    async submitUsdcCtfAllowance() {
      const res = await fetch("/api/lp/allowance", { method: "POST" });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? "allowance failed");
      return { transactionID: "lp-allowance", state: "submitted" };
    },
    async getOrDeriveClobCredentials(): Promise<ClobCredentials> {
      throw new Error("LP mode does not use CLOB L2 credentials");
    },
    auth: {
      async logout() {
        await fetch("/api/lp/session", { method: "DELETE" });
      },
    },
  };
  return proxy as unknown as DpmSdk;
}

function toAuthSession(pub: LpPublicSession): AuthSession | null {
  if (!pub.connected || !pub.eoaAddress || !pub.proxyWallet) return null;
  const user: UserProfile = {
    proxyWallet: pub.proxyWallet,
    email: null,
    name: null,
    allowanceStatus: pub.allowanceStatus,
  };
  return {
    providerId: "lp_eoa_proxy",
    eoaAddress: pub.eoaAddress,
    proxyWallet: pub.proxyWallet,
    user,
  };
}

export function LpDemoProviders({ children }: { children: ReactNode }) {
  const queryClient = useQueryClient();
  const [pub, setPub] = useState<LpPublicSession | null>(null);
  const [ws, setWs] = useState<WsUrls | null>(null);
  const sdkProxy = useMemo(() => createLpSdkProxy(), []);

  const refreshWs = useCallback(async (connected: boolean) => {
    if (!connected) {
      setWs(null);
      return;
    }
    const wsRes = await fetch("/api/lp/ws-urls");
    if (wsRes.ok) {
      setWs((await wsRes.json()) as WsUrls);
    } else {
      setWs(null);
    }
  }, []);

  const refresh = useCallback(async () => {
    const res = await fetch("/api/lp/session");
    if (!res.ok) {
      setPub({
        connected: false,
        apiKeyTruncated: null,
        eoaAddress: null,
        proxyWallet: null,
        allowanceStatus: null,
      });
      setWs(null);
      return;
    }
    const next = (await res.json()) as LpPublicSession;
    setPub(next);
    await refreshWs(next.connected);
  }, [refreshWs]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const disconnect = useCallback(async () => {
    await fetch("/api/lp/session", { method: "DELETE" });
    await refresh();
  }, [refresh]);

  const connect = useCallback(
    async (apiPrivateKey: string, eoaPrivateKey: string) => {
      const res = await fetch("/api/lp/session", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ apiPrivateKey, eoaPrivateKey }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? "Connect failed");
      setPub(json as LpPublicSession);
      await refreshWs(true);
      await queryClient.invalidateQueries({ queryKey: ["plae-events"] });
      return json as LpPublicSession;
    },
    [queryClient, refreshWs],
  );

  const session = pub ? toAuthSession(pub) : null;
  const connected = Boolean(pub?.connected);

  const trading = useMemo<TradingContextValue>(
    () => ({
      mode: "lp",
      requiresAppLogin: false,
      dpmSdk: connected ? sdkProxy : null,
      session,
      walletAddress: session?.proxyWallet ?? null,
      userProfile: session?.user ?? null,
      disconnect,
      apiKeyTruncated: pub?.apiKeyTruncated ?? null,
      eoaAddress: pub?.eoaAddress ?? null,
    }),
    [connected, sdkProxy, session, disconnect, pub],
  );

  const clobBase = lpBrowserServiceBase("clob");
  const buildClobUrl = useCallback(
    (endpoint: string, params: Record<string, string>) => {
      const sp = new URLSearchParams(params);
      return `${clobBase}/${endpoint}?${sp}`;
    },
    [clobBase],
  );

  const lpConnectApi = useMemo(
    () => ({ connect, refresh, pub }),
    [connect, refresh, pub],
  );

  return (
    <LpConnectApiContext.Provider value={lpConnectApi}>
      <MarketSurfaceProvider
        id="lp"
        basePath="/lp"
        label="LP"
        marketWsUrl={ws?.market}
        pricesWsUrl={ws?.prices}
      >
        <TradingOverrideProvider value={trading}>
          <DataSourceProvider buildClobUrl={buildClobUrl}>
            <MarketWSProvider wsUrl={ws?.market}>
              <CryptoPricesWSProvider wsUrl={ws?.prices}>
                {children}
              </CryptoPricesWSProvider>
            </MarketWSProvider>
          </DataSourceProvider>
        </TradingOverrideProvider>
      </MarketSurfaceProvider>
    </LpConnectApiContext.Provider>
  );
}
