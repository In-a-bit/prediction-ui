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
import { Magic } from "magic-sdk";
import { OAuthExtension } from "@magic-ext/oauth2";
import { getUser } from "@/lib/gamma-api";

const WALLET_STORAGE_KEY = "magic_wallet_address";
const PROFILE_STORAGE_KEY = "magic_user_profile";

// Magic<T> is the instance type when using extensions
type MagicInstance = Magic<[OAuthExtension]>;

export type UserProfile = {
  proxyWallet: string;
  email: string | null;
  name: string | null;
};

type MagicContextType = {
  magic: MagicInstance | null;
  walletAddress: string | null;
  userProfile: UserProfile | null;
  setWalletAddress: (address: string | null) => void;
  setUserProfile: (profile: UserProfile | null) => void;
  disconnect: () => Promise<void>;
};

const MagicContext = createContext<MagicContextType>({
  magic: null,
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
  const [walletAddress, setWalletAddressState] = useState<string | null>(null);
  const [userProfile, setUserProfileState] = useState<UserProfile | null>(null);

  // Initialize Magic SDK (browser only)
  useEffect(() => {
    const key = process.env.NEXT_PUBLIC_MAGIC_PUBLISHABLE_KEY;
    if (!key) return;

    const rpcUrl =
      process.env.NEXT_PUBLIC_RPC_URL ?? "https://rpc-amoy.polygon.technology";
    const chainId = Number(process.env.NEXT_PUBLIC_CHAIN_ID ?? "80002");

    const instance = new Magic(key, {
      extensions: [new OAuthExtension()],
      network: { rpcUrl, chainId },
    }) as MagicInstance;

    setMagic(instance);
  }, []);

  // Restore session from localStorage, then verify Magic session is still live
  useEffect(() => {
    if (!magic) return;

    const storedAddress = localStorage.getItem(WALLET_STORAGE_KEY);
    if (storedAddress) setWalletAddressState(storedAddress);

    const storedProfile = localStorage.getItem(PROFILE_STORAGE_KEY);
    if (storedProfile) {
      try {
        setUserProfileState(JSON.parse(storedProfile) as UserProfile);
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
      // Session is live — refresh profile from gamma-api to pick up latest data
      const freshProfile = await getUser();
      if (freshProfile) {
        setWalletAddressState(freshProfile.proxyWallet);
        setUserProfileState(freshProfile);
        localStorage.setItem(WALLET_STORAGE_KEY, freshProfile.proxyWallet);
        localStorage.setItem(PROFILE_STORAGE_KEY, JSON.stringify(freshProfile));
      }
    });
  }, [magic]);

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
    () => ({ magic, walletAddress, userProfile, setWalletAddress, setUserProfile, disconnect }),
    [magic, walletAddress, userProfile, setWalletAddress, setUserProfile, disconnect],
  );

  return (
    <MagicContext.Provider value={value}>{children}</MagicContext.Provider>
  );
}
