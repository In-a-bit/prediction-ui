"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { useMagic } from "@/components/providers/magic-provider";
import { checkAllowanceAndSignIfNeeded } from "@/lib/allowance";
import { loginWithMagic } from "@/lib/gamma-api";
import type { OAuthRedirectResult } from "@magic-ext/oauth2";

export default function OAuthCallbackPage() {
  const { magic, setWalletAddress, setUserProfile } = useMagic();
  const router = useRouter();
  const handled = useRef(false);
  // Use a ref so the value is always current inside async callbacks
  const returnToRef = useRef("/");
  const [error, setError] = useState<string | null>(null);

  // Read the saved return URL immediately — ref is synchronous, no stale closure
  useEffect(() => {
    const saved = localStorage.getItem("magic_oauth_return_to");
    if (saved) {
      returnToRef.current = saved;
      localStorage.removeItem("magic_oauth_return_to");
    }
  }, []);

  useEffect(() => {
    if (!magic || handled.current) return;
    handled.current = true;

    console.log("[Magic OAuth] starting getRedirectResult...");

    const timeout = setTimeout(() => {
      console.error("[Magic OAuth] getRedirectResult timed out after 10s");
      setError("Timed out waiting for OAuth result");
      setTimeout(() => router.replace(returnToRef.current), 2000);
    }, 10_000);

    magic.oauth2
      .getRedirectResult()
      .then(async (result: OAuthRedirectResult) => {
        clearTimeout(timeout);

        const token = result.magic.idToken;
        console.log("[Magic OAuth] DID token:", token ? `${token.slice(0, 40)}…` : "missing");

        if (!token) throw new Error("No DID token in OAuth result");

        // Exchange DID token for full profile via gamma-api
        const profile = await loginWithMagic(token);
        console.log("[Magic OAuth] login API profile:", profile);

        setWalletAddress(profile.proxyWallet);
        setUserProfile(profile);
        checkAllowanceAndSignIfNeeded(magic as Parameters<typeof checkAllowanceAndSignIfNeeded>[0], profile).catch(() => {});
        router.replace(returnToRef.current);
      })
      .catch((err: unknown) => {
        clearTimeout(timeout);
        console.error("[Magic OAuth] failed:", err);
        setError(err instanceof Error ? err.message : String(err));
        setTimeout(() => router.replace(returnToRef.current), 2000);
      });
  }, [magic, router, setWalletAddress]);

  if (error) {
    return (
      <div className="flex min-h-[60vh] flex-col items-center justify-center gap-3">
        <p className="text-sm text-red">Sign-in failed: {error}</p>
        <p className="text-xs text-muted">Redirecting…</p>
      </div>
    );
  }

  return (
    <div className="flex min-h-[60vh] flex-col items-center justify-center gap-4">
      <svg className="h-8 w-8 animate-spin text-brand" fill="none" viewBox="0 0 24 24">
        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
      </svg>
      <p className="text-sm text-muted">Connecting your wallet…</p>
      <button
        onClick={() => router.replace(returnToRef.current)}
        className="mt-2 text-xs text-brand underline"
      >
        Cancel and go back
      </button>
    </div>
  );
}
