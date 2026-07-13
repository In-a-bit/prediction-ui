"use client";

import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { AuthCancelledError } from "@inabit-com/dpm-sdk";
import { useDpmWallet } from "@inabit-com/dpm-sdk/react";

type Props = {
  onClose: () => void;
};

type OtpResolver = {
  resolve: (code: string) => void;
  reject: (err: Error) => void;
};

export function ConnectWalletModal({ onClose }: Props) {
  const { sdk, sendEmailCode, loginWithEmailCode, loginWithOAuth } =
    useDpmWallet();

  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState<"google" | "email" | null>(null);
  const [verifyingOtp, setVerifyingOtp] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const overlayRef = useRef<HTMLDivElement>(null);
  const [otpStep, setOtpStep] = useState(false);
  const [otpCode, setOtpCode] = useState("");
  const otpResolverRef = useRef<OtpResolver | null>(null);

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape" && loading === null) onClose();
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose, loading]);

  async function handleGoogle() {
    setError(null);
    setLoading("google");
    try {
      await loginWithOAuth("google");
    } catch (err) {
      console.error("[connect-wallet-modal.handleGoogle] failed:", err);
      const msg = err instanceof Error ? err.message : JSON.stringify(err);
      setError(`Google sign-in failed: ${msg}`);
      setLoading(null);
    }
  }

  async function handleEmail(e: React.FormEvent) {
    e.preventDefault();
    if (!email.trim()) return;
    setError(null);
    setLoading("email");
    try {
      await sendEmailCode(email.trim());
      setLoading(null);
      const code = await waitForOtpCode();
      setVerifyingOtp(true);
      await loginWithEmailCode(code);
      onClose();
    } catch (err) {
      handleEmailError(err);
    }
  }

  function waitForOtpCode(): Promise<string> {
    return new Promise<string>((resolve, reject) => {
      otpResolverRef.current = { resolve, reject };
      setOtpStep(true);
      setOtpCode("");
      setVerifyingOtp(false);
      setError(null);
    });
  }

  function handleEmailError(err: unknown) {
    if (err instanceof AuthCancelledError) {
      setOtpStep(false);
      setVerifyingOtp(false);
      setLoading(null);
      return;
    }
    console.error("[connect-wallet-modal.handleEmail] failed:", err);
    setError(err instanceof Error ? err.message : String(err));
    setOtpStep(false);
    setVerifyingOtp(false);
    setLoading(null);
  }

  function handleOtpSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!otpCode.trim() || !otpResolverRef.current || verifyingOtp) return;
    setVerifyingOtp(true);
    otpResolverRef.current.resolve(otpCode.trim().replace(/\s/g, ""));
    otpResolverRef.current = null;
  }

  const modal = (
    <div
      ref={overlayRef}
      className="fixed inset-0 z-[9999] flex items-center justify-center p-4"
      onClick={(e) => {
        if (loading !== null) return;
        if (e.target === overlayRef.current) onClose();
      }}
    >
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" />

      <div className="relative z-10 w-full max-w-sm rounded-2xl border border-card-border bg-card p-6 shadow-2xl">
        <button
          onClick={onClose}
          className="absolute right-4 top-4 rounded-lg p-1.5 text-muted transition-colors hover:bg-card-hover hover:text-foreground"
        >
          <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>

        {otpStep ? (
          <>
            <div className="mb-6 pr-6">
              <h2 className="text-lg font-semibold text-foreground">Enter verification code</h2>
              <p className="mt-1 text-sm text-muted">
                We sent a code to <strong className="text-foreground">{email}</strong>
              </p>
            </div>

            <form onSubmit={handleOtpSubmit} className="space-y-3">
              <input
                type="text"
                inputMode="numeric"
                autoComplete="one-time-code"
                value={otpCode}
                onChange={(e) => setOtpCode(e.target.value)}
                placeholder="Enter code"
                required
                autoFocus
                disabled={verifyingOtp}
                className="w-full rounded-xl border border-card-border bg-input px-4 py-3 text-center text-lg font-mono tracking-widest text-foreground placeholder:text-muted/50 focus:border-brand focus:outline-none disabled:opacity-50"
              />
              <button
                type="submit"
                disabled={!otpCode.trim() || verifyingOtp}
                className="flex w-full items-center justify-center gap-2 rounded-xl bg-brand px-4 py-3 text-sm font-semibold text-white transition-colors hover:bg-brand-hover disabled:cursor-not-allowed disabled:opacity-50"
              >
                {verifyingOtp && <Spinner />}
                Verify
              </button>
            </form>

            <button
              type="button"
              disabled={verifyingOtp}
              onClick={() => {
                otpResolverRef.current?.reject(
                  new AuthCancelledError("OTP verification cancelled"),
                );
                otpResolverRef.current = null;
                setOtpStep(false);
                setVerifyingOtp(false);
                setLoading(null);
              }}
              className="mt-4 w-full text-center text-xs text-brand underline disabled:opacity-50"
            >
              Back
            </button>

            {error && (
              <p className="mt-4 text-center text-xs text-red">{error}</p>
            )}
          </>
        ) : (
          <>
            <div className="mb-6 pr-6">
              <h2 className="text-lg font-semibold text-foreground">Connect Wallet</h2>
              <p className="mt-1 text-sm text-muted">Sign in to create or access your wallet</p>
            </div>

            <button
              type="button"
              onClick={handleGoogle}
              disabled={loading !== null}
              className="flex w-full items-center justify-center gap-3 rounded-xl border border-card-border bg-card-hover px-4 py-3 text-sm font-medium text-foreground transition-colors hover:border-brand/50 hover:bg-card-hover disabled:cursor-not-allowed disabled:opacity-50"
            >
              {loading === "google" ? <Spinner /> : <GoogleIcon />}
              Continue with Google
            </button>

            <div className="my-5 flex items-center gap-3">
              <div className="h-px flex-1 bg-card-border" />
              <span className="text-xs text-muted">or</span>
              <div className="h-px flex-1 bg-card-border" />
            </div>

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
                disabled={loading !== null || !email.trim() || !sdk}
                className="flex w-full items-center justify-center gap-2 rounded-xl bg-brand px-4 py-3 text-sm font-semibold text-white transition-colors hover:bg-brand-hover disabled:cursor-not-allowed disabled:opacity-50"
              >
                {loading === "email" && !otpStep && <Spinner />}
                Continue with Email
              </button>
            </form>

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
