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
import {
  DpmSdk,
  type MagicInstance,
  type UserProfile,
} from "dpm-sdk/magic";
import { checkAllowanceAndSignIfNeeded } from "@/lib/allowance";
import { useUserWs } from "@/lib/hooks/use-user-ws";
import { predictionServiceBase } from "@/lib/prediction-proxy";

const WALLET_STORAGE_KEY = "magic_wallet_address";
const PROFILE_STORAGE_KEY = "magic_user_profile";
const DPM_PROXY_BASE = predictionServiceBase("dpm");

export type { UserProfile };

type MagicContextType = {
  magic: MagicInstance | null;
  /** Ready after relayer `GET /contract-info` succeeds; use for trading and gamma session calls. */
  dpmSdk: DpmSdk | null;
  walletAddress: string | null;
  userProfile: UserProfile | null;
  setWalletAddress: (address: string | null) => void;
  setUserProfile: (profile: UserProfile | null) => void;
  disconnect: () => Promise<void>;
};

const MagicContext = createContext<MagicContextType>({
  magic: null,
  dpmSdk: null,
  walletAddress: null,
  userProfile: null,
  setWalletAddress: () => {},
  setUserProfile: () => {},
  disconnect: async () => {},
});

export function useMagic() {
  return useContext(MagicContext);
}

export function MagicProvider({ children }: { children: ReactNode }) {
  const [magic, setMagic] = useState<MagicInstance | null>(null);
  const [dpmSdk, setDpmSdk] = useState<DpmSdk | null>(null);
  const [walletAddress, setWalletAddressState] = useState<string | null>(null);
  const [userProfile, setUserProfileState] = useState<UserProfile | null>(null);

  useEffect(() => {
    let cancelled = false;
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
      wallet: {
        provider: "magic",
        publishableKey: resolveMagicPublishableKey,
        rpcUrl: magicRpcUrlFromEnv(),
      },
      builderApiPublicKey: builderApiPublicKeyFromEnv() ?? undefined,
    })
      .then((sdk) => {
        if (!cancelled) {
          console.log("[magic-provider] DpmSdk.create: success");
          setMagic(sdk.magic);
          setDpmSdk(sdk);
        }
      })
      .catch((err: unknown) => {
        console.error("[magic-provider] DpmSdk.create failed:", err);
        if (!cancelled) {
          setMagic(null);
          setDpmSdk(null);
        }
      });
    return () => {
      cancelled = true;
    };
  }, []);

  // Restore session from localStorage, then verify Magic session is still live
  useEffect(() => {
    if (!magic || !dpmSdk) return;

    const storedAddress = localStorage.getItem(WALLET_STORAGE_KEY);
    if (storedAddress) queueMicrotask(() => setWalletAddressState(storedAddress));

    const storedProfile = localStorage.getItem(PROFILE_STORAGE_KEY);
    if (storedProfile) {
      try {
        const parsed = JSON.parse(storedProfile) as Record<string, unknown>;
        queueMicrotask(() =>
          setUserProfileState({
            proxyWallet: parsed.proxyWallet as string,
            email: (parsed.email as string | null) ?? null,
            name: (parsed.name as string | null) ?? null,
            allowanceStatus: (parsed.allowanceStatus as string | null) ?? null,
          }),
        );
      } catch {
        localStorage.removeItem(PROFILE_STORAGE_KEY);
      }
    }

    magic.user.isLoggedIn().then(async (loggedIn: boolean) => {
      if (!loggedIn) {
        localStorage.removeItem(WALLET_STORAGE_KEY);
        localStorage.removeItem(PROFILE_STORAGE_KEY);
        setWalletAddressState(null);
        setUserProfileState(null);
        return;
      }
      console.log("[magic-provider] session restore: fetching gamma profile");
      const freshProfile = await dpmSdk.gamma.getUser();
      if (freshProfile) {
        setWalletAddressState(freshProfile.proxyWallet);
        setUserProfileState(freshProfile);
        localStorage.setItem(WALLET_STORAGE_KEY, freshProfile.proxyWallet);
        localStorage.setItem(PROFILE_STORAGE_KEY, JSON.stringify(freshProfile));
        checkAllowanceAndSignIfNeeded(dpmSdk, freshProfile).catch(() => {});
        void dpmSdk.getOrDeriveClobCredentials().catch(() => {});
      }
    });
  }, [magic, dpmSdk]);

  const setWalletAddress = useCallback((address: string | null) => {
    setWalletAddressState(address);
    if (address) {
      localStorage.setItem(WALLET_STORAGE_KEY, address);
    } else {
      localStorage.removeItem(WALLET_STORAGE_KEY);
    }
  }, []);

  const setUserProfile = useCallback((profile: UserProfile | null) => {
    setUserProfileState(profile);
    if (profile) {
      localStorage.setItem(PROFILE_STORAGE_KEY, JSON.stringify(profile));
    } else {
      localStorage.removeItem(PROFILE_STORAGE_KEY);
    }
  }, []);

  const disconnect = useCallback(async () => {
    if (magic) {
      try {
        await magic.user.logout();
      } catch {
        // ignore logout errors
      }
    }
    setWalletAddress(null);
    setUserProfile(null);
  }, [magic, setWalletAddress, setUserProfile]);

  const value = useMemo(
    () => ({
      magic,
      dpmSdk,
      walletAddress,
      userProfile,
      setWalletAddress,
      setUserProfile,
      disconnect,
    }),
    [magic, dpmSdk, walletAddress, userProfile, setWalletAddress, setUserProfile, disconnect],
  );

  useUserWs(magic, dpmSdk, !!walletAddress);

  return (
    <MagicContext.Provider value={value}>{children}</MagicContext.Provider>
  );
}

/** EVM chain for Magic + CLOB signing; must match `NEXT_PUBLIC_RPC_URL` and deployed contracts. */
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

async function resolveMagicPublishableKey(): Promise<string> {
  const apiKey = builderApiPublicKeyFromEnv();
  if (apiKey === null) return fallbackMagicKey();
  const res = await fetch(
    `${DPM_PROXY_BASE}/builders/by-api-key/${encodeURIComponent(apiKey)}`,
  );
  if (!res.ok) throw new Error(`Failed to fetch builder by api_public_key (${res.status})`);
  const body = (await res.json()) as { magic_public_key?: string | null };
  const key = body.magic_public_key?.trim() ?? "";
  if (!key) throw new Error("DPM response missing magic_public_key");
  return key;
}
