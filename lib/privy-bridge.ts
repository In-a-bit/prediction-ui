"use client";

import type { ConnectParams, PrivyAuthBridge } from "@inabit-com/dpm-sdk";
import {
  useCreateWallet,
  useLoginWithOAuth,
  usePrivy,
  useSignMessage,
  useSignTypedData,
  useWallets,
} from "@privy-io/react-auth";
import { useMemo, useRef } from "react";

function findEmbeddedWallet(wallets: ReturnType<typeof useWallets>["wallets"]) {
  return wallets.find((w) => w.walletClientType === "privy") ?? wallets[0] ?? null;
}

async function waitForEmbeddedWallet(
  readAddress: () => string | null,
  timeoutMs = 20_000,
): Promise<string> {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    const address = readAddress();
    if (address) return address;
    await new Promise((resolve) => setTimeout(resolve, 250));
  }
  throw new Error("Timed out waiting for Privy embedded wallet");
}

export function usePrivyAuthBridge(): PrivyAuthBridge {
  const privy = usePrivy();
  const { initOAuth } = useLoginWithOAuth();
  const { createWallet } = useCreateWallet();
  const { wallets, ready: walletsReady } = useWallets();
  const { signMessage } = useSignMessage();
  const { signTypedData } = useSignTypedData();

  const ctxRef = useRef({
    privy,
    initOAuth,
    login: privy.login,
    logout: privy.logout,
    getAccessToken: privy.getAccessToken,
    createWallet,
    wallets,
    walletsReady,
    signMessage,
    signTypedData,
  });
  ctxRef.current = {
    privy,
    initOAuth,
    login: privy.login,
    logout: privy.logout,
    getAccessToken: privy.getAccessToken,
    createWallet,
    wallets,
    walletsReady,
    signMessage,
    signTypedData,
  };

  return useMemo(
    () => ({
      async login(params: ConnectParams) {
        const ctx = ctxRef.current;
        if (!ctx.privy.ready) {
          throw new Error("Privy is not ready");
        }
        // Headless login methods link onto the current user if a session exists.
        if (ctx.privy.authenticated) {
          await ctx.logout();
        }
        switch (params.method) {
          case "emailOtp": {
            throw new Error(
              "emailOtp must be handled in the host UI with Privy useLoginWithEmail and Captcha",
            );
          }
          case "oauth": {
            const provider = params.provider === "twitter" ? "twitter" : "google";
            await ctx.initOAuth({ provider });
            return;
          }
          case "providerUI": {
            await ctx.login();
            await ensureWallet(ctx);
            return;
          }
          default: {
            const _exhaustive: never = params;
            throw new Error(`unsupported connect method: ${JSON.stringify(_exhaustive)}`);
          }
        }
      },
      async logout() {
        await ctxRef.current.logout();
      },
      async getAccessToken() {
        const token = await ctxRef.current.getAccessToken();
        if (!token) throw new Error("No Privy access token");
        return token;
      },
      async isAuthenticated() {
        const { ready, authenticated } = ctxRef.current.privy;
        return ready && authenticated;
      },
      async getEthereumAddress() {
        const address = readEmbeddedAddress(ctxRef.current);
        if (address) return address;
        return waitForEmbeddedWallet(() => readEmbeddedAddress(ctxRef.current));
      },
      async signTypedDataV4(address: string, typedDataJson: string) {
        const parsed = JSON.parse(typedDataJson) as Parameters<typeof signTypedData>[0];
        const { signature } = await ctxRef.current.signTypedData(parsed, { address });
        return signature;
      },
      async personalSign(message: string, address: string) {
        const { signature } = await ctxRef.current.signMessage({ message }, { address });
        return signature;
      },
      async awaitReady() {
        const deadline = Date.now() + 30_000;
        while (Date.now() < deadline) {
          if (ctxRef.current.privy.ready) return;
          await new Promise((resolve) => setTimeout(resolve, 100));
        }
        throw new Error("Timed out waiting for Privy to become ready");
      },
      async awaitSessionReady() {
        const deadline = Date.now() + 30_000;
        while (Date.now() < deadline) {
          const ctx = ctxRef.current;
          if (ctx.privy.ready && ctx.privy.authenticated) {
            await ensureWallet(ctx);
            return;
          }
          await new Promise((resolve) => setTimeout(resolve, 250));
        }
        throw new Error("Timed out waiting for Privy OAuth session");
      },
    }),
    [],
  );
}

type BridgeCtx = {
  wallets: ReturnType<typeof useWallets>["wallets"];
  walletsReady: boolean;
  createWallet: ReturnType<typeof useCreateWallet>["createWallet"];
};

function readEmbeddedAddress(ctx: BridgeCtx): string | null {
  if (!ctx.walletsReady) return null;
  const wallet = findEmbeddedWallet(ctx.wallets);
  return wallet?.address ?? null;
}

async function ensureWallet(ctx: BridgeCtx): Promise<void> {
  if (readEmbeddedAddress(ctx)) return;
  try {
    await ctx.createWallet();
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    if (!message.toLowerCase().includes("already")) {
      throw err;
    }
  }
  await waitForEmbeddedWallet(() => readEmbeddedAddress(ctx));
}
