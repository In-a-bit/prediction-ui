"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
} from "react";

import {
  CryptoPricesWS,
  type CryptoPriceTick,
  type CryptoPriceTickCallback,
} from "@/lib/ws/crypto-prices-ws";

const DISCONNECT_GRACE_MS = 100;

interface CryptoPricesWSContextValue {
  connect: (symbol: string) => void;
  onTick: (callback: CryptoPriceTickCallback) => () => void;
}

const CryptoPricesWSContext = createContext<CryptoPricesWSContextValue | null>(
  null,
);

export function CryptoPricesWSProvider({
  children,
  wsUrl,
}: {
  children: React.ReactNode;
  wsUrl?: string;
}) {
  const wsRef = useRef<CryptoPricesWS | null>(null);
  const destroyTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (destroyTimerRef.current) {
      clearTimeout(destroyTimerRef.current);
      destroyTimerRef.current = null;
    }

    const ws = new CryptoPricesWS(wsUrl);
    wsRef.current = ws;

    return () => {
      const closing = ws;
      wsRef.current = null;
      destroyTimerRef.current = setTimeout(() => {
        destroyTimerRef.current = null;
        if (wsRef.current !== closing) {
          closing.destroy();
        }
      }, DISCONNECT_GRACE_MS);
    };
  }, [wsUrl]);

  const connect = useCallback((symbol: string) => {
    wsRef.current?.connect(symbol);
  }, []);

  const onTick = useCallback((callback: CryptoPriceTickCallback) => {
    const ws = wsRef.current;
    if (!ws) return () => {};
    return ws.onTick(callback);
  }, []);

  return (
    <CryptoPricesWSContext.Provider value={{ connect, onTick }}>
      {children}
    </CryptoPricesWSContext.Provider>
  );
}

export function useCryptoPricesWS(): CryptoPricesWSContextValue {
  const ctx = useContext(CryptoPricesWSContext);
  if (!ctx) {
    throw new Error(
      "useCryptoPricesWS must be used within a CryptoPricesWSProvider",
    );
  }
  return ctx;
}

export type { CryptoPriceTick };
