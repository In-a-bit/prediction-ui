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

const WALLET_STORAGE_KEY = "magic_wallet_address";

// Magic<T> is the instance type when using extensions
type MagicInstance = Magic<[OAuthExtension]>;

type MagicContextType = {
  magic: MagicInstance | null;
  walletAddress: string | null;
  setWalletAddress: (address: string | null) => void;
  disconnect: () => Promise<void>;
};

const MagicContext = createContext<MagicContextType>({
  magic: null,
  walletAddress: null,
  setWalletAddress: () => {},
  disconnect: async () => {},
});

export function useMagic() {
  return useContext(MagicContext);
}

export function MagicProvider({ children }: { children: ReactNode }) {
  const [magic, setMagic] = useState<MagicInstance | null>(null);
  const [walletAddress, setWalletAddressState] = useState<string | null>(null);

  // Initialize Magic SDK (browser only)
  useEffect(() => {
    const key = process.env.NEXT_PUBLIC_MAGIC_PUBLISHABLE_KEY;
    if (!key) return;

    const instance = new Magic(key, {
      extensions: [new OAuthExtension()],
      network: { rpcUrl: "https://polygon-rpc.com", chainId: 137 },
    }) as MagicInstance;

    setMagic(instance);
  }, []);

  // Restore session: check localStorage first, then verify with Magic
  useEffect(() => {
    if (!magic) return;

    const stored = localStorage.getItem(WALLET_STORAGE_KEY);
    if (stored) {
      setWalletAddressState(stored);
    }

    // Verify the Magic session is still live
    magic.user.isLoggedIn().then((loggedIn: boolean) => {
      if (loggedIn) {
        magic.user.getInfo().then((info) => {
          const publicAddress = info.wallets?.ethereum?.publicAddress ?? null;
          if (publicAddress) {
            setWalletAddressState(publicAddress);
            localStorage.setItem(WALLET_STORAGE_KEY, publicAddress);
          }
        });
      } else {
        // Magic session expired, clear stale localStorage
        localStorage.removeItem(WALLET_STORAGE_KEY);
        setWalletAddressState(null);
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

  const disconnect = useCallback(async () => {
    if (magic) {
      try {
        await magic.user.logout();
      } catch {
        // ignore logout errors
      }
    }
    setWalletAddress(null);
  }, [magic, setWalletAddress]);

  const value = useMemo(
    () => ({ magic, walletAddress, setWalletAddress, disconnect }),
    [magic, walletAddress, setWalletAddress, disconnect],
  );

  return (
    <MagicContext.Provider value={value}>{children}</MagicContext.Provider>
  );
}
