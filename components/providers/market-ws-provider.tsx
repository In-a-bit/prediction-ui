"use client";

import {
  createContext,
  useContext,
  useEffect,
  useRef,
  useState,
  useCallback,
} from "react";
import {
  MarketWS,
  type MarketEventType,
  type MarketEventCallback,
} from "@/lib/ws/market-ws";

interface MarketWSContextValue {
  subscribe: (tokenId: string) => void;
  unsubscribe: (tokenId: string) => void;
  on: (eventType: MarketEventType, callback: MarketEventCallback) => void;
  off: (eventType: MarketEventType, callback: MarketEventCallback) => void;
  isConnected: boolean;
}

const MarketWSContext = createContext<MarketWSContextValue | null>(null);

export function MarketWSProvider({
  children,
  wsUrl,
}: {
  children: React.ReactNode;
  wsUrl?: string;
}) {
  const wsRef = useRef<MarketWS | null>(null);
  const refCounts = useRef(new Map<string, number>());
  const [isConnected, setIsConnected] = useState(false);

  useEffect(() => {
    const ws = new MarketWS(wsUrl);
    wsRef.current = ws;

    // Poll connection status (lightweight since it just checks readyState)
    const statusInterval = setInterval(() => {
      setIsConnected(ws.isConnected);
    }, 1000);

    return () => {
      clearInterval(statusInterval);
      ws.destroy();
      wsRef.current = null;
    };
  }, [wsUrl]);

  const subscribe = useCallback((tokenId: string) => {
    const ws = wsRef.current;
    if (!ws) return;

    const counts = refCounts.current;
    const current = counts.get(tokenId) ?? 0;
    counts.set(tokenId, current + 1);

    if (current === 0) {
      // First subscriber for this token — actually subscribe on WS
      if (ws.isConnected) {
        ws.subscribe([tokenId]);
      } else {
        ws.connect([tokenId]);
      }
    }
  }, []);

  const unsubscribe = useCallback((tokenId: string) => {
    const ws = wsRef.current;
    if (!ws) return;

    const counts = refCounts.current;
    const current = counts.get(tokenId) ?? 0;
    if (current <= 1) {
      counts.delete(tokenId);
      ws.unsubscribe([tokenId]);
    } else {
      counts.set(tokenId, current - 1);
    }
  }, []);

  const on = useCallback(
    (eventType: MarketEventType, callback: MarketEventCallback) => {
      wsRef.current?.on(eventType, callback);
    },
    []
  );

  const off = useCallback(
    (eventType: MarketEventType, callback: MarketEventCallback) => {
      wsRef.current?.off(eventType, callback);
    },
    []
  );

  return (
    <MarketWSContext.Provider
      value={{ subscribe, unsubscribe, on, off, isConnected }}
    >
      {children}
    </MarketWSContext.Provider>
  );
}

export function useMarketWS() {
  const ctx = useContext(MarketWSContext);
  if (!ctx) {
    throw new Error("useMarketWS must be used within a MarketWSProvider");
  }
  return ctx;
}
