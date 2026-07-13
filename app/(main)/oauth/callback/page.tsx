"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";

import { useWallet } from "@/components/providers/wallet-provider";
import { isPrivyOAuthReturn, stripPrivyOAuthParams } from "@inabit-com/dpm-sdk/react";

export default function OAuthCallbackPage() {
  const { dpmSdk } = useWallet();
  const router = useRouter();
  const handled = useRef(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!dpmSdk || handled.current) return;
    handled.current = true;

    const timeout = setTimeout(() => {
      setError("Timed out waiting for OAuth result");
      setTimeout(() => router.replace("/"), 2000);
    }, 30_000);

    dpmSdk.auth
      .completeRedirect()
      .then(({ returnTo }) => {
        clearTimeout(timeout);
        if (isPrivyOAuthReturn()) {
          stripPrivyOAuthParams();
        }
        router.replace(returnTo ?? "/");
      })
      .catch((err: unknown) => {
        clearTimeout(timeout);
        console.error("[oauth-callback] completeRedirect failed:", err);
        setError(err instanceof Error ? err.message : String(err));
        setTimeout(() => router.replace("/"), 2000);
      });
  }, [dpmSdk, router]);

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
    </div>
  );
}
