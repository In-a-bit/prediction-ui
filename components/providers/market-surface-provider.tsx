"use client";

import {
  createContext,
  useContext,
  useMemo,
  type ReactNode,
} from "react";

import {
  lpBrowserServiceBase,
  type LpGoService,
} from "@/lib/lp/direct-urls";
import {
  predictionServiceBase,
  type PredictionProxyService,
} from "@/lib/prediction-proxy";
import {
  predictionGoMarketWsUrl,
  predictionGoPricesWsUrl,
} from "@/lib/prediction-gateway-url";

export type MarketSurfaceId = "plaee" | "lp";

type ServiceName = PredictionProxyService | LpGoService;

export type MarketSurfaceValue = {
  id: MarketSurfaceId;
  /** Route prefix, e.g. `/plaee` or `/lp`. */
  basePath: string;
  /** Display name in breadcrumbs / titles. */
  label: string;
  /** HTTP base for a prediction-go service (gateway or LP proxy). */
  serviceBase: (service: ServiceName) => string;
  /** Market book WS URL (may be empty until LP ws-urls load). */
  marketWsUrl: string;
  pricesWsUrl: string;
};

const defaultSurface: MarketSurfaceValue = {
  id: "plaee",
  basePath: "/plaee",
  label: "Plaee",
  serviceBase: (service) =>
    predictionServiceBase(service as PredictionProxyService),
  marketWsUrl: predictionGoMarketWsUrl(),
  pricesWsUrl: predictionGoPricesWsUrl(),
};

const MarketSurfaceContext = createContext<MarketSurfaceValue>(defaultSurface);

export function MarketSurfaceProvider({
  id,
  basePath,
  label,
  marketWsUrl,
  pricesWsUrl,
  children,
}: {
  id: MarketSurfaceId;
  basePath: string;
  label: string;
  marketWsUrl?: string;
  pricesWsUrl?: string;
  children: ReactNode;
}) {
  const value = useMemo<MarketSurfaceValue>(() => {
    const serviceBase =
      id === "lp"
        ? (service: ServiceName) => lpBrowserServiceBase(service as LpGoService)
        : (service: ServiceName) =>
            predictionServiceBase(service as PredictionProxyService);

    return {
      id,
      basePath,
      label,
      serviceBase,
      marketWsUrl:
        marketWsUrl ??
        (id === "lp" ? "" : predictionGoMarketWsUrl()),
      pricesWsUrl:
        pricesWsUrl ??
        (id === "lp" ? "" : predictionGoPricesWsUrl()),
    };
  }, [id, basePath, label, marketWsUrl, pricesWsUrl]);

  return (
    <MarketSurfaceContext.Provider value={value}>
      {children}
    </MarketSurfaceContext.Provider>
  );
}

export function useMarketSurface() {
  return useContext(MarketSurfaceContext);
}
