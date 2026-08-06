"use client";

import { createContext, useContext, type ReactNode } from "react";
import { usePrivyAuthBridge } from "@inabit-com/dpm-sdk/react";

import type { PersonalSignFn } from "@/lib/native-proxy-withdraw";

const PrivySignContext = createContext<PersonalSignFn | null>(null);

/** Provides Privy personalSign to descendants. Mount only under DpmWalletProvider. */
export function PrivySignProvider({ children }: { children: ReactNode }) {
  const bridge = usePrivyAuthBridge();
  return (
    <PrivySignContext.Provider value={bridge.personalSign}>
      {children}
    </PrivySignContext.Provider>
  );
}

/** Null on LP (no Privy). Sandbox native POL withdraw needs a non-null value. */
export function usePrivyPersonalSign(): PersonalSignFn | null {
  return useContext(PrivySignContext);
}
