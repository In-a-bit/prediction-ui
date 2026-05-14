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
import { DpmSdk, type AuthSession, type UserProfile } from "dpm-sdk";

import { checkAllowanceAndSignIfNeeded } from "@/lib/allowance";
import { useUserWs } from "@/lib/hooks/use-user-ws";
import { predictionServiceBase } from "@/lib/prediction-proxy";

const DPM_PROXY_BASE = predictionServiceBase("dpm");

export type { UserProfile };

type MagicContextType = {
  /** Ready after relayer `GET /contract-info` succeeds; use for trading and gamma session calls. */
  dpmSdk: DpmSdk | null;
  /** Active session, or null if not authenticated. */
  session: AuthSession | null;
  /** Proxy wallet address (alias of `session.proxyWallet`). */
  walletAddress: string | null;
  /** Authenticated profile (alias of `session.user`). */
  userProfile: UserProfile | null;
  /** Logs out via `sdk.auth.logout()` (no-op if already logged out). */
  disconnect: () => Promise<void>;
};

const MagicContext = createContext<MagicContextType>({
  dpmSdk: null,
  session: null,
  walletAddress: null,
  userProfile: null,
  disconnect: async () => {},
});

export function useMagic() {
  return useContext(MagicContext);
}

export function MagicProvider({ children }: { children: ReactNode }) {
  const [dpmSdk, setDpmSdk] = useState<DpmSdk | null>(null);
  const [session, setSession] = useState<AuthSession | null>(null);

  useEffect(() => {
    let cancelled = false;
    let unsubscribe: (() => void) | undefined;
    console.log("[magic-provider] DpmSdk.create: begin", {
      gammaUrl: predictionServiceBase("gamma"),
      clobUrl: predictionServiceBase("clob"),
      relayerUrl: predictionServiceBase("relayer"),
    });

    void DpmSdk.create({
      urls: {
        gammaUrl: predictionServiceBase("gamma"),
        clobUrl: predictionServiceBase("clob"),
        relayerUrl: predictionServiceBase("relayer"),
      },
      chainId: chainIdFromEnv(),
      auth: {
        providers: [
          {
            id: "magic",
            publishableKey: resolveMagicPublishableKey,
            rpcUrl: magicRpcUrlFromEnv(),
          },
        ],
      },
      builderApiPublicKey: builderApiPublicKeyFromEnv() ?? undefined,
    })
      .then(async (sdk) => {
        if (cancelled) return;
        console.log("[magic-provider] DpmSdk.create: success");
        setDpmSdk(sdk);
        unsubscribe = sdk.auth.on("change", (event) => {
          if (event.type === "connected" || event.type === "accountChanged") {
            console.log("[magic-provider] auth change: connected", {
              providerId: event.session.providerId,
              proxyWallet: event.session.proxyWallet,
            });
            setSession(event.session);
            primeAfterLogin(sdk, event.session.user);
          } else if (event.type === "disconnected") {
            console.log("[magic-provider] auth change: disconnected");
            setSession(null);
          }
        });
        // restore() emits a "connected" event on success — listener above handles
        // setSession + priming, so we don't double-prime here.
        await sdk.auth.restore();
      })
      .catch((err: unknown) => {
        console.error("[magic-provider] DpmSdk.create failed:", err);
        if (!cancelled) {
          setDpmSdk(null);
          setSession(null);
        }
      });

    return () => {
      cancelled = true;
      unsubscribe?.();
    };
  }, []);

  const disconnect = useCallback(async () => {
    if (!dpmSdk) return;
    console.log("[magic-provider.disconnect] begin");
    try {
      await dpmSdk.auth.logout();
    } catch (err) {
      console.error("[magic-provider.disconnect] logout failed (continuing):", err);
    }
    console.log("[magic-provider.disconnect] success");
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

  useUserWs(dpmSdk, !!walletAddress);

  return <MagicContext.Provider value={value}>{children}</MagicContext.Provider>;
}

/** EVM chain id for Magic + CLOB signing; must match `NEXT_PUBLIC_RPC_URL` and deployed contracts. */
function chainIdFromEnv(): number {
  const raw = process.env.NEXT_PUBLIC_CHAIN_ID?.trim();
  if (raw) {
    const n = Number(raw);
    if (Number.isFinite(n) && n > 0) {
      return Math.trunc(n);
    }
  }
  return 80002;
}

/** Magic `network.rpcUrl`; must match {@link chainIdFromEnv}. */
function magicRpcUrlFromEnv(): string {
  return (
    process.env.NEXT_PUBLIC_RPC_URL?.trim() ||
    "https://rpc-amoy.polygon.technology"
  );
}

function builderApiPublicKeyFromEnv(): string | null {
  const raw = process.env.NEXT_PUBLIC_BUILDER_API_PUBLIC_KEY?.trim();
  return raw || null;
}

function fallbackMagicKey(): string {
  return process.env.NEXT_PUBLIC_MAGIC_PUBLISHABLE_KEY ?? "";
}

/** Fire-and-forget post-login side effects: USDC/CTF allowance check and
 *  CLOB credential derivation. Both are safe to fail silently — they retry
 *  on the next signing action. */
function primeAfterLogin(sdk: DpmSdk, user: UserProfile): void {
  checkAllowanceAndSignIfNeeded(sdk, user).catch((err) => {
    console.warn("[magic-provider.primeAfterLogin] allowance check failed:", err);
  });
  void sdk.getOrDeriveClobCredentials().catch((err) => {
    console.warn("[magic-provider.primeAfterLogin] CLOB credential derive failed:", err);
  });
}

async function resolveMagicPublishableKey(): Promise<string> {
  const apiKey = builderApiPublicKeyFromEnv();
  if (apiKey === null) return fallbackMagicKey();
  const res = await fetch(
    `${DPM_PROXY_BASE}/builders/by-api-key/${encodeURIComponent(apiKey)}`,
  );
  if (!res.ok) {
    throw new Error(`Failed to fetch builder by api_public_key (${res.status})`);
  }
  const body = (await res.json()) as { magic_public_key?: string | null };
  const key = body.magic_public_key?.trim() ?? "";
  if (!key) throw new Error("DPM response missing magic_public_key");
  return key;
}
