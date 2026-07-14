"use client";

import {
  createContext,
  useContext,
  useEffect,
  useRef,
  useState,
  useCallback,
  useMemo,
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
  /** Bumps when the underlying socket is (re)created so listeners re-bind. */
  connectionGeneration: number;
}

const MarketWSContext = createContext<MarketWSContextValue | null>(null);

export function MarketWSProvider({
  children,
  wsUrl,
}: {
  children: React.ReactNode;
  /** Empty/undefined = not ready yet (do not fall back to Polymarket). */
  wsUrl?: string;
}) {
  const wsRef = useRef<MarketWS | null>(null);
  const refCounts = useRef(new Map<string, number>());
  const [isConnected, setIsConnected] = useState(false);
  const [connectionGeneration, setConnectionGeneration] = useState(0);

  useEffect(() => {
    const url = wsUrl?.trim();
    // Wait for a real URL. `new MarketWS("")` would use Polymarket's default host.
    if (!url) {
      wsRef.current?.destroy();
      wsRef.current = null;
      setIsConnected(false);
      return;
    }

    const ws = new MarketWS(url);
    wsRef.current = ws;
    setConnectionGeneration((g) => g + 1);

    const pending = [...refCounts.current.keys()];
    if (pending.length > 0) {
      ws.connect(pending);
    }

    const statusInterval = setInterval(() => {
      setIsConnected(ws.isConnected);
    }, 1000);

    return () => {
      clearInterval(statusInterval);
      ws.destroy();
      if (wsRef.current === ws) {
        wsRef.current = null;
      }
    };
  }, [wsUrl]);

  const subscribe = useCallback((tokenId: string) => {
    const counts = refCounts.current;
    const current = counts.get(tokenId) ?? 0;
    counts.set(tokenId, current + 1);

    const ws = wsRef.current;
    if (!ws || current > 0) return;

    if (ws.isConnected) {
      ws.subscribe([tokenId]);
    } else {
      ws.connect([tokenId]);
    }
  }, []);

  const unsubscribe = useCallback((tokenId: string) => {
    const counts = refCounts.current;
    const current = counts.get(tokenId) ?? 0;
    if (current <= 1) {
      counts.delete(tokenId);
      wsRef.current?.unsubscribe([tokenId]);
    } else {
      counts.set(tokenId, current - 1);
    }
  }, []);

  const on = useCallback(
    (eventType: MarketEventType, callback: MarketEventCallback) => {
      wsRef.current?.on(eventType, callback);
    },
    [],
  );

  const off = useCallback(
    (eventType: MarketEventType, callback: MarketEventCallback) => {
      wsRef.current?.off(eventType, callback);
    },
    [],
  );

  const value = useMemo(
    () => ({
      subscribe,
      unsubscribe,
      on,
      off,
      isConnected,
      connectionGeneration,
    }),
    [subscribe, unsubscribe, on, off, isConnected, connectionGeneration],
  );

  return (
    <MarketWSContext.Provider value={value}>{children}</MarketWSContext.Provider>
  );
}

export function useMarketWS() {
  const ctx = useContext(MarketWSContext);
  if (!ctx) {
    throw new Error("useMarketWS must be used within a MarketWSProvider");
  }
  return ctx;
}
