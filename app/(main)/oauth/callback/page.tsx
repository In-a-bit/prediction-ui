"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { useMagic } from "@/components/providers/magic-provider";
import type { OAuthRedirectResult } from "@magic-ext/oauth2";

export default function OAuthCallbackPage() {
  const { magic, setWalletAddress } = useMagic();
  const router = useRouter();
  const handled = useRef(false);
  // Use a ref so the value is always current inside async callbacks
  const returnToRef = useRef("/");
  const [didToken, setDidToken] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [error, setError] = useState(false);

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

    // Timeout in case getRedirectResult hangs
    const timeout = setTimeout(() => {
      console.error("[Magic OAuth] getRedirectResult timed out after 10s");
      setError(true);
      setTimeout(() => router.replace(returnToRef.current), 2000);
    }, 10_000);

    magic.oauth2
      .getRedirectResult()
      .then((result: OAuthRedirectResult) => {
        clearTimeout(timeout);
        const meta = result.magic.userMetadata as unknown as Record<string, unknown>;
        console.log("[Magic OAuth] result:", JSON.stringify(meta));
        const address =
          (meta.publicAddress as string | null) ??
          (meta.wallets as Record<string, {publicAddress?: string}> | undefined)?.ethereum?.publicAddress ??
          (meta.issuer as string | undefined)?.split(":").pop() ??
          null;
        if (address) setWalletAddress(address);
        const token = result.magic.idToken;
        console.log("[Magic OAuth] idToken:", token ? `${token.slice(0, 40)}…` : "missing");
        // Use functional update so stale closure can't overwrite with null
        setDidToken((prev) => prev ?? token ?? "(no token in result)");
      })
      .catch((err: unknown) => {
        clearTimeout(timeout);
        console.error("[Magic OAuth] getRedirectResult failed:", err);
        setError(true);
        setTimeout(() => router.replace(returnToRef.current), 2000);
      });
  }, [magic, router, setWalletAddress]);

  function handleCopy() {
    if (!didToken) return;
    navigator.clipboard.writeText(didToken);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  console.log("[Magic OAuth] render — didToken:", didToken ? `${didToken.slice(0, 20)}…` : "null", "error:", error);

  if (error) {
    return (
      <div className="flex min-h-[60vh] flex-col items-center justify-center gap-3">
        <p className="text-sm text-red">OAuth sign-in failed. Redirecting…</p>
      </div>
    );
  }

  if (!didToken) {
    return (
      <div className="flex min-h-[60vh] flex-col items-center justify-center gap-4">
        <svg className="h-8 w-8 animate-spin text-brand" fill="none" viewBox="0 0 24 24">
          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
        </svg>
        <p className="text-sm text-muted">Connecting your wallet…</p>
        <p className="text-xs text-muted/50">Check browser console for details</p>
        <button
          onClick={() => router.replace(returnToRef.current)}
          className="mt-2 text-xs text-brand underline"
        >
          Cancel and go back
        </button>
      </div>
    );
  }

  return (
    <div className="flex min-h-[60vh] items-center justify-center p-4">
      <div className="w-full max-w-sm rounded-2xl border border-card-border bg-card p-6 shadow-2xl">
        <div className="mb-4 flex items-center gap-2">
          <div className="flex h-8 w-8 items-center justify-center rounded-full bg-green/20">
            <svg className="h-4 w-4 text-green" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
            </svg>
          </div>
          <h2 className="text-base font-semibold text-foreground">Wallet connected!</h2>
        </div>

        <p className="mb-3 text-xs text-muted">
          DID token (for backend use — temporary debug view):
        </p>

        <div className="relative rounded-xl border border-card-border bg-input p-3">
          <p className="break-all font-mono text-[10px] leading-relaxed text-foreground">
            {didToken}
          </p>
          <button
            onClick={handleCopy}
            className="mt-2 flex items-center gap-1.5 text-xs text-brand transition-colors hover:text-brand-hover"
          >
            {copied ? (
              <>
                <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                </svg>
                Copied!
              </>
            ) : (
              <>
                <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <rect x="9" y="9" width="13" height="13" rx="2" />
                  <path d="M5 15H4a2 2 0 01-2-2V4a2 2 0 012-2h9a2 2 0 012 2v1" />
                </svg>
                Copy token
              </>
            )}
          </button>
        </div>

        <button
          onClick={() => router.replace(returnToRef.current)}
          className="mt-4 w-full rounded-xl bg-brand px-4 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-brand-hover"
        >
          Done
        </button>
      </div>
    </div>
  );
}
