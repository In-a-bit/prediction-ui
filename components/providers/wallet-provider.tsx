"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { PrivyProvider } from "@privy-io/react-auth";
import { DpmSdk, type AuthSession, type UserProfile } from "@inabit-com/dpm-sdk";

import { checkAllowanceAndSignIfNeeded } from "@/lib/allowance";
import { useUserWs } from "@/lib/hooks/use-user-ws";
import { usePrivyAuthBridge } from "@/lib/privy-bridge";
import { isPrivyOAuthReturn, stripPrivyOAuthParams } from "@/lib/privy-oauth";
import { predictionServiceBase } from "@/lib/prediction-proxy";

const DPM_PROXY_BASE = predictionServiceBase("dpm");

export type { UserProfile };

type WalletContextType = {
  dpmSdk: DpmSdk | null;
  session: AuthSession | null;
  walletAddress: string | null;
  userProfile: UserProfile | null;
  disconnect: () => Promise<void>;
};

const WalletContext = createContext<WalletContextType>({
  dpmSdk: null,
  session: null,
  walletAddress: null,
  userProfile: null,
  disconnect: async () => {},
});

export function useWallet() {
  return useContext(WalletContext);
}

/** @deprecated Use {@link useWallet}. */
export function useMagic() {
  return useWallet();
}

export function WalletProvider({ children }: { children: ReactNode }) {
  const [appId, setAppId] = useState<string | null>(null);
  const [appIdError, setAppIdError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    void resolvePrivyAppId()
      .then((id) => {
        if (!cancelled) setAppId(id);
      })
      .catch((err: unknown) => {
        if (!cancelled) {
          setAppIdError(err instanceof Error ? err.message : String(err));
        }
      });
    return () => {
      cancelled = true;
    };
  }, []);

  if (appIdError) {
    return (
      <div className="p-4 text-sm text-red">
        Failed to load Privy configuration: {appIdError}
      </div>
    );
  }
  if (!appId) {
    return null;
  }

  return (
    <PrivyProvider
      appId={appId}
      config={{
        embeddedWallets: {
          ethereum: { createOnLogin: "users-without-wallets" },
          showWalletUIs: false,
        },
        loginMethods: ["email", "google"],
      }}
    >
      <WalletProviderInner>{children}</WalletProviderInner>
    </PrivyProvider>
  );
}

/** @deprecated Use {@link WalletProvider}. */
export const MagicProvider = WalletProvider;

function WalletProviderInner({ children }: { children: ReactNode }) {
  const bridge = usePrivyAuthBridge();
  const [dpmSdk, setDpmSdk] = useState<DpmSdk | null>(null);
  const [session, setSession] = useState<AuthSession | null>(null);
  const [clobReady, setClobReady] = useState(false);
  const oauthReturnHandled = useRef(false);
  const primeGen = useRef(0);

  useEffect(() => {
    let cancelled = false;
    let unsubscribe: (() => void) | undefined;

    void DpmSdk.create({
      urls: {
        gammaUrl: predictionServiceBase("gamma"),
        clobUrl: predictionServiceBase("clob"),
        relayerUrl: predictionServiceBase("relayer"),
      },
      chainId: chainIdFromEnv(),
      auth: {
        providers: [{ id: "privy", bridge }],
      },
      builderApiPublicKey: builderApiPublicKeyFromEnv() ?? undefined,
    })
      .then(async (sdk) => {
        if (cancelled) return;
        setDpmSdk(sdk);
        unsubscribe = sdk.auth.on("change", (event) => {
          if (event.type === "connected" || event.type === "accountChanged") {
            setSession(event.session);
            setClobReady(false);
            const gen = ++primeGen.current;
            void primeAfterLogin(sdk, event.session.user).then((ok) => {
              if (!cancelled && gen === primeGen.current) setClobReady(ok);
            });
          } else if (event.type === "disconnected") {
            primeGen.current += 1;
            setSession(null);
            setClobReady(false);
          }
        });
        await sdk.auth.restore();
      })
      .catch((err: unknown) => {
        console.error("[wallet-provider] DpmSdk.create failed:", err);
        if (!cancelled) {
          setDpmSdk(null);
          setSession(null);
          setClobReady(false);
        }
      });

    return () => {
      cancelled = true;
      unsubscribe?.();
    };
    // bridge is stable (refs inside usePrivyAuthBridge); init once.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (!dpmSdk || !isPrivyOAuthReturn() || oauthReturnHandled.current) return;
    oauthReturnHandled.current = true;

    let cancelled = false;
    void dpmSdk.auth
      .completeRedirect()
      .then(() => {
        if (cancelled) return;
        stripPrivyOAuthParams();
      })
      .catch(async (err: unknown) => {
        if (cancelled) return;
        try {
          await dpmSdk.auth.connectExisting("privy");
          stripPrivyOAuthParams();
        } catch (fallbackErr) {
          console.error("[wallet-provider] Privy OAuth return failed:", err, fallbackErr);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [dpmSdk]);

  const disconnect = useCallback(async () => {
    if (!dpmSdk) return;
    try {
      await dpmSdk.auth.logout();
    } catch (err) {
      console.error("[wallet-provider.disconnect] logout failed:", err);
    }
  }, [dpmSdk]);

  const walletAddress = session?.proxyWallet ?? null;
  const userProfile = session?.user ?? null;

  const value = useMemo(
    () => ({
      dpmSdk,
      session,
      walletAddress,
      userProfile,
      disconnect,
    }),
    [dpmSdk, session, walletAddress, userProfile, disconnect],
  );

  // Wait for CLOB credential derive so useUserWs hits cache instead of racing a second sign.
  useUserWs(dpmSdk, !!walletAddress && clobReady);

  return (
    <WalletContext.Provider value={value}>{children}</WalletContext.Provider>
  );
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
