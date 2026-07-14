"use client";

import {
  createContext,
  Suspense,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import { usePathname } from "next/navigation";
import {
  DpmWalletProvider,
  useDpmWallet,
} from "@inabit-com/dpm-sdk/react";
import { type AuthSession, type DpmSdk, type UserProfile } from "@inabit-com/dpm-sdk";

import { checkAllowanceAndSignIfNeeded } from "@/lib/allowance";
import { useUserWs } from "@/lib/hooks/use-user-ws";
import { predictionServiceBase } from "@/lib/prediction-proxy";

const DPM_PROXY_BASE = predictionServiceBase("dpm");

export type { UserProfile };

type WalletContextType = {
  dpmSdk: DpmSdk | null;
  session: AuthSession | null;
  walletAddress: string | null;
  userProfile: UserProfile | null;
  /** True while an OAuth return (or email code) login is in flight. */
  isConnecting: boolean;
  disconnect: () => Promise<void>;
};

const WalletContext = createContext<WalletContextType>({
  dpmSdk: null,
  session: null,
  walletAddress: null,
  userProfile: null,
  isConnecting: false,
  disconnect: async () => {},
});

export function useWallet() {
  return useContext(WalletContext);
}

function isLpPath(pathname: string) {
  return pathname === "/lp" || pathname.startsWith("/lp/");
}

/**
 * LP demo does not use Privy / prediction-gateway. Skip wallet bootstrap there so
 * `/lp` still loads when the gateway is down.
 */
export function WalletProvider({ children }: { children: ReactNode }) {
  const builderApiPublicKey = builderApiPublicKeyFromEnv();
  if (!builderApiPublicKey) {
    return (
      <div className="p-4 text-sm text-red">
        NEXT_PUBLIC_BUILDER_API_PUBLIC_KEY is required
      </div>
    );
  }

  return (
    <Suspense fallback={<>{children}</>}>
      <WalletProviderGate builderApiPublicKey={builderApiPublicKey}>
        {children}
      </WalletProviderGate>
    </Suspense>
  );
}

function WalletProviderGate({
  children,
  builderApiPublicKey,
}: {
  children: ReactNode;
  builderApiPublicKey: string;
}) {
  const pathname = usePathname();
  if (isLpPath(pathname)) {
    return <>{children}</>;
  }
  return (
    <WalletProviderWithPrivy builderApiPublicKey={builderApiPublicKey}>
      {children}
    </WalletProviderWithPrivy>
  );
}

function WalletProviderWithPrivy({
  children,
  builderApiPublicKey,
}: {
  children: ReactNode;
  builderApiPublicKey: string;
}) {
  return (
    <DpmWalletProvider
      urls={{
        gammaUrl: predictionServiceBase("gamma"),
        clobUrl: predictionServiceBase("clob"),
        relayerUrl: predictionServiceBase("relayer"),
      }}
      chainId={chainIdFromEnv()}
      builderApiPublicKey={builderApiPublicKey}
      privyAppId={resolvePrivyAppId}
      errorFallback={(error: any) => (
        <div className="p-4 text-sm text-red">
          Failed to load Privy configuration: {error}
        </div>
      )}
    >
      <AppWalletBridge>{children}</AppWalletBridge>
    </DpmWalletProvider>
  );
}

/**
 * Adapts the SDK's turnkey wallet context into this app's `useWallet` shape and
 * runs app-specific priming (allowance + CLOB credentials) after login.
 */
function AppWalletBridge({ children }: { children: ReactNode }) {
  const { sdk, session, address, user, isConnecting, logout } = useDpmWallet();
  const clobReady = usePrimeAfterLogin(sdk, session);

  const disconnect = useCallback(async () => {
    try {
      await logout();
    } catch (err) {
      console.error("[wallet-provider.disconnect] logout failed:", err);
    }
  }, [logout]);

  const value = useMemo<WalletContextType>(
    () => ({
      dpmSdk: sdk,
      session,
      walletAddress: address,
      userProfile: user,
      isConnecting,
      disconnect,
    }),
    [sdk, session, address, user, isConnecting, disconnect],
  );

  // Wait for CLOB credential derive so useUserWs hits cache instead of racing a second sign.
  useUserWs(sdk, !!address && clobReady);

  return (
    <WalletContext.Provider value={value}>{children}</WalletContext.Provider>
  );
}

/** Derive CLOB credentials once per session; returns true when ready.
 *  Tracks the primed session by identity so no state is reset synchronously
 *  inside the effect (which would trigger cascading renders). */
function usePrimeAfterLogin(
  sdk: DpmSdk | null,
  session: AuthSession | null,
): boolean {
  const [primedSession, setPrimedSession] = useState<AuthSession | null>(null);

  useEffect(() => {
    if (!sdk || !session) return;
    let cancelled = false;
    void primeAfterLogin(sdk, session.user).then((ok) => {
      if (!cancelled && ok) setPrimedSession(session);
    });
    return () => {
      cancelled = true;
    };
  }, [sdk, session]);

  return session !== null && primedSession === session;
}

function chainIdFromEnv(): number {
  const raw = process.env.NEXT_PUBLIC_CHAIN_ID?.trim();
  if (raw) {
    const n = Number(raw);
    if (Number.isFinite(n) && n > 0) return Math.trunc(n);
  }
  return 80002;
}

function builderApiPublicKeyFromEnv(): string | null {
  const raw = process.env.NEXT_PUBLIC_BUILDER_API_PUBLIC_KEY?.trim();
  return raw || null;
}

function fallbackPrivyAppId(): string {
  return process.env.NEXT_PUBLIC_PRIVY_APP_ID?.trim() ?? "";
}

async function resolvePrivyAppId(): Promise<string> {
  const apiKey = builderApiPublicKeyFromEnv();
  if (apiKey === null) {
    const id = fallbackPrivyAppId();
    if (!id) throw new Error("NEXT_PUBLIC_PRIVY_APP_ID is required");
    return id;
  }
  const res = await fetch(
    `${DPM_PROXY_BASE}/builders/by-api-key/${encodeURIComponent(apiKey)}`,
  );
  if (!res.ok) {
    throw new Error(`Failed to fetch builder by api_public_key (${res.status})`);
  }
  const body = (await res.json()) as {
    wallet_type?: string | null;
    wallet_public_key?: string | null;
  };
  if (body.wallet_type && body.wallet_type !== "privy_proxy") {
    throw new Error(`Builder wallet_type is ${body.wallet_type}, expected privy_proxy`);
  }
  const id = body.wallet_public_key?.trim() ?? "";
  if (!id) throw new Error("DPM response missing wallet_public_key");
  return id;
}

/** Returns true once CLOB credentials are available (derived or cached). */
async function primeAfterLogin(sdk: DpmSdk, user: UserProfile): Promise<boolean> {
  checkAllowanceAndSignIfNeeded(sdk, user).catch((err) => {
    console.warn("[wallet-provider.primeAfterLogin] allowance check failed:", err);
  });
  try {
    await sdk.getOrDeriveClobCredentials();
    return true;
  } catch (err) {
    console.warn("[wallet-provider.primeAfterLogin] CLOB credential derive failed:", err);
    return false;
  }
}
