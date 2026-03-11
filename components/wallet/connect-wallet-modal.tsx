"use client";

import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { useMagic } from "@/components/providers/magic-provider";

type Props = {
  onClose: () => void;
};

export function ConnectWalletModal({ onClose }: Props) {
  const { magic, setWalletAddress } = useMagic();
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState<"google" | "email" | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [didToken, setDidToken] = useState<string | null>(null);
  const [pendingAddress, setPendingAddress] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const overlayRef = useRef<HTMLDivElement>(null);

  // Close on Escape — but not while OTP is in progress
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape" && loading === null) onClose();
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose, loading]);

  async function handleGoogle() {
    if (!magic) return;
    setError(null);
    setLoading("google");
    try {
      // Remember where the user was so the callback can return them here
      localStorage.setItem("magic_oauth_return_to", window.location.pathname + window.location.search);
      await magic.oauth2.loginWithRedirect({
        provider: "google",
        redirectURI: `${window.location.origin}/oauth/callback`,
      });
      // Page will redirect — no need to setLoading(null)
    } catch (err) {
      console.error("[Magic] Google login error:", err);
      const msg = err instanceof Error ? err.message : JSON.stringify(err);
      setError(`Google sign-in failed: ${msg}`);
      setLoading(null);
    }
  }

  async function handleEmail(e: React.FormEvent) {
    e.preventDefault();
    if (!magic || !email.trim()) return;
    setError(null);
    setLoading("email");

    let token: string | null = null;

    // Step 1: OTP login — resolves to DID token directly
    try {
      token = await magic.auth.loginWithEmailOTP({ email: email.trim() });
      console.log("[Magic] loginWithEmailOTP resolved, token:", token ? `${token.slice(0, 40)}…` : "null");
    } catch (err) {
      console.error("[Magic] loginWithEmailOTP failed:", err);
      setError(`OTP login failed: ${err instanceof Error ? err.message : String(err)}`);
      setLoading(null);
      return;
    }

    // Step 2: Get wallet address — store locally, NOT in context yet.
    // Setting context here would re-render WalletButton into address-pill mode
    // and unmount this modal before the token screen is shown.
    try {
      const info = await magic.user.getInfo();
      console.log("[Magic] getInfo:", JSON.stringify(info));
      const publicAddress =
        info.wallets?.ethereum?.publicAddress ??
        info.issuer?.split(":").pop() ??
        null;
      if (publicAddress) setPendingAddress(publicAddress);
    } catch (err) {
      console.warn("[Magic] getInfo failed (non-fatal):", err);
    }

    // Step 3: Resolve DID token — use the one from Step 1, or fetch it
    try {
      if (!token) {
        token = await magic.user.getIdToken();
        console.log("[Magic] getIdToken fallback resolved:", token ? `${token.slice(0, 40)}…` : "null");
      }
      setDidToken(token ?? "token unavailable");
    } catch (err) {
      console.error("[Magic] getIdToken failed:", err);
      // Still show success screen — just without the token
      setDidToken("(token fetch failed — check console)");
    } finally {
      setLoading(null);
    }
  }

  function handleCopy() {
    if (!didToken) return;
    navigator.clipboard.writeText(didToken);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  const modal = (
    <div
      ref={overlayRef}
      className="fixed inset-0 z-[9999] flex items-center justify-center p-4"
      onClick={(e) => {
        // Don't close while login is in progress — Magic's OTP iframe
        // can cause spurious clicks on the overlay
        if (loading !== null) return;
        if (e.target === overlayRef.current) onClose();
      }}
    >
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" />

      {/* Modal */}
      <div className="relative z-10 w-full max-w-sm rounded-2xl border border-card-border bg-card p-6 shadow-2xl">
        {/* Close button — always visible */}
        <button
          onClick={onClose}
          className="absolute right-4 top-4 rounded-lg p-1.5 text-muted transition-colors hover:bg-card-hover hover:text-foreground"
        >
          <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>

        {didToken ? (
          /* ── DID Token reveal screen ── */
          <div>
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
              onClick={() => {
                if (pendingAddress) setWalletAddress(pendingAddress);
                onClose();
              }}
              className="mt-4 w-full rounded-xl bg-brand px-4 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-brand-hover"
            >
              Done
            </button>
          </div>
        ) : (
          /* ── Connect form ── */
          <>
            <div className="mb-6 pr-6">
              <h2 className="text-lg font-semibold text-foreground">Connect Wallet</h2>
              <p className="mt-1 text-sm text-muted">Sign in to create or access your wallet</p>
            </div>

            {/* Google Button */}
            <button
              onClick={handleGoogle}
              disabled={loading !== null}
              className="flex w-full items-center justify-center gap-3 rounded-xl border border-card-border bg-card-hover px-4 py-3 text-sm font-medium text-foreground transition-colors hover:border-brand/50 hover:bg-card-hover disabled:cursor-not-allowed disabled:opacity-50"
            >
              {loading === "google" ? <Spinner /> : <GoogleIcon />}
              Continue with Google
            </button>

            {/* Divider */}
            <div className="my-5 flex items-center gap-3">
              <div className="h-px flex-1 bg-card-border" />
              <span className="text-xs text-muted">or</span>
              <div className="h-px flex-1 bg-card-border" />
            </div>

            {/* Email Form */}
            <form onSubmit={handleEmail} className="space-y-3">
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="Enter your email"
                required
                disabled={loading !== null}
                className="w-full rounded-xl border border-card-border bg-input px-4 py-3 text-sm text-foreground placeholder:text-muted/50 focus:border-brand focus:outline-none disabled:opacity-50"
              />
              <button
                type="submit"
                disabled={loading !== null || !email.trim()}
                className="flex w-full items-center justify-center gap-2 rounded-xl bg-brand px-4 py-3 text-sm font-semibold text-white transition-colors hover:bg-brand-hover disabled:cursor-not-allowed disabled:opacity-50"
              >
                {loading === "email" && <Spinner />}
                Continue with Email
              </button>
            </form>

            {/* Error */}
            {error && (
              <p className="mt-4 text-center text-xs text-red">{error}</p>
            )}

            <p className="mt-5 text-center text-xs text-muted">
              A wallet is created automatically on first sign-in.
              <br />
              No seed phrase required.
            </p>
          </>
        )}
      </div>
    </div>
  );

  return createPortal(modal, document.body);
}

function GoogleIcon() {
  return (
    <svg className="h-4 w-4" viewBox="0 0 24 24" aria-hidden>
      <path
        fill="#4285F4"
        d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
      />
      <path
        fill="#34A853"
        d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
      />
      <path
        fill="#FBBC05"
        d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
      />
      <path
        fill="#EA4335"
        d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
      />
    </svg>
  );
}

function Spinner() {
  return (
    <svg
      className="h-4 w-4 animate-spin"
      fill="none"
      viewBox="0 0 24 24"
      aria-hidden
    >
      <circle
        className="opacity-25"
        cx="12"
        cy="12"
        r="10"
        stroke="currentColor"
        strokeWidth="4"
      />
      <path
        className="opacity-75"
        fill="currentColor"
        d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"
      />
    </svg>
  );
}
