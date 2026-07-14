"use client";

import {
  createContext,
  useContext,
  type ReactNode,
} from "react";
import type { DpmSdk, AuthSession, UserProfile } from "@inabit-com/dpm-sdk";

import { useWallet } from "@/components/providers/wallet-provider";

/**
 * Shared trading identity used by TradePanel / open-orders / balances.
 * Plaee uses Privy wallet SDK in-browser; LP overrides with a server-backed proxy.
 */
export type TradingContextValue = {
  mode: "privy" | "lp";
  /** When true, TradePanel requires NextAuth login. LP is false. */
  requiresAppLogin: boolean;
  dpmSdk: DpmSdk | null;
  session: AuthSession | null;
  walletAddress: string | null;
  userProfile: UserProfile | null;
  disconnect: () => Promise<void>;
  /** LP-only: truncated API key for header button. */
  apiKeyTruncated?: string | null;
  eoaAddress?: string | null;
};

const TradingOverrideContext = createContext<TradingContextValue | null>(null);

export function TradingOverrideProvider({
  value,
  children,
}: {
  value: TradingContextValue;
  children: ReactNode;
}) {
  return (
    <TradingOverrideContext.Provider value={value}>
      {children}
    </TradingOverrideContext.Provider>
  );
}

export function useTrading(): TradingContextValue {
  const override = useContext(TradingOverrideContext);
  // Hooks must run unconditionally; on LP, WalletProvider is skipped and this is defaults.
  const wallet = useWallet();

  if (override) return override;

  return {
    mode: "privy",
    requiresAppLogin: true,
    dpmSdk: wallet.dpmSdk,
    session: wallet.session,
    walletAddress: wallet.walletAddress,
    userProfile: wallet.userProfile,
    disconnect: wallet.disconnect,
  };
}
