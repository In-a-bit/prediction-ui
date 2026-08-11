"use client";

import { useCallback, useEffect, useState, useSyncExternalStore } from "react";
import { createPortal } from "react-dom";
import { useTrading } from "@/components/providers/trading-provider";
import { copyToClipboard } from "@/lib/utils";
import { useOnramp } from "@/lib/hooks/use-ramp";

type DepositModalProps = {
  open: boolean;
  onClose: () => void;
};

export function DepositModal({ open, onClose }: DepositModalProps) {
  const { userProfile, walletAddress } = useTrading();
  const proxyAddress = userProfile?.proxyWallet ?? walletAddress ?? "";
  const [copied, setCopied] = useState(false);
  const onramp = useOnramp();
  const isClient = useSyncExternalStore(
    () => () => {},
    () => true,
    () => false,
  );

  const handleClose = useCallback(() => {
    setCopied(false);
    onramp.reset();
    onClose();
  }, [onClose, onramp]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") handleClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, handleClose]);

  if (!open || !isClient) return null;

  async function handleCopy() {
    if (!proxyAddress) return;
    const ok = await copyToClipboard(proxyAddress);
    if (!ok) return;
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  return createPortal(
    <>
      <div
        className="fixed inset-0 z-[100] bg-black/60 backdrop-blur-sm"
        aria-hidden
        onClick={handleClose}
      />
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="deposit-modal-title"
        className="fixed left-1/2 top-1/2 z-[101] w-[calc(100%-2rem)] max-w-md -translate-x-1/2 -translate-y-1/2 rounded-2xl border border-card-border bg-card p-6 shadow-2xl"
      >
        <div className="mb-4 flex items-start justify-between gap-4">
          <h2
            id="deposit-modal-title"
            className="text-lg font-semibold text-foreground"
          >
            Deposit USDC
          </h2>
          <button
            type="button"
            onClick={handleClose}
            className="rounded-lg p-1 text-muted transition-colors hover:bg-card-hover hover:text-foreground"
            aria-label="Close"
          >
            <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <div className="mb-5">
          {onramp.stage === "completed" ? (
            <div className="rounded-xl border border-green/30 bg-green/5 px-4 py-3">
              <p className="text-sm font-semibold text-foreground">
                Thank you — deposit received
              </p>
              <p className="mt-1 text-xs text-muted">
                We’ll update your balance soon. This can take a few minutes.
              </p>
            </div>
          ) : (
            <button
              type="button"
              onClick={() => void onramp.start()}
              disabled={!onramp.ready || onramp.busy || !proxyAddress}
              className="flex w-full items-center justify-between gap-3 rounded-xl border border-card-border bg-input px-4 py-3 text-left transition-colors hover:border-brand hover:bg-card-hover disabled:cursor-not-allowed disabled:opacity-40"
            >
              <span>
                <span className="block text-sm font-semibold text-foreground">
                  {onramp.stage === "opening"
                    ? "Opening…"
                    : onramp.stage === "awaiting"
                      ? "In progress…"
                      : onramp.stage === "failed" || onramp.stage === "cancelled"
                        ? "Try again"
                        : "Buy with card or bank transfer"}
                </span>
                <span className="mt-0.5 block text-xs text-muted">
                  {onramp.stage === "awaiting"
                    ? "Complete the deposit in the Paybis window…"
                    : "Pay with fiat and receive USDC in your wallet"}
                </span>
              </span>
              <svg className="h-4 w-4 shrink-0 text-muted" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
              </svg>
            </button>
          )}

          {onramp.error && (
            <p className="mt-2 rounded-xl border border-red/30 bg-red-dim px-3 py-2 text-xs text-red">
              {onramp.error}
            </p>
          )}
        </div>

        <div className="mb-4 flex items-center gap-3">
          <span className="h-px flex-1 bg-card-border" />
          <span className="text-xs font-medium text-muted">
            or transfer crypto
          </span>
          <span className="h-px flex-1 bg-card-border" />
        </div>

        <p className="mb-4 text-sm leading-relaxed text-muted">
          Please send USDC to this address on the{" "}
          <span className="font-medium text-foreground">Polygon</span> network.
        </p>

        {proxyAddress ? (
          <div>
            <p className="mb-1.5 text-xs text-muted">Proxy wallet address</p>
            <div className="flex items-center justify-between gap-2 rounded-xl border border-card-border bg-input px-3 py-2.5">
              <p className="break-all font-mono text-xs text-foreground">
                {proxyAddress}
              </p>
              <button
                type="button"
                onClick={handleCopy}
                title="Copy address"
                className="shrink-0 text-muted transition-colors hover:text-foreground"
              >
                {copied ? (
                  <svg className="h-4 w-4 text-green" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                  </svg>
                ) : (
                  <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <rect x="9" y="9" width="13" height="13" rx="2" />
                    <path d="M5 15H4a2 2 0 01-2-2V4a2 2 0 012-2h9a2 2 0 012 2v1" />
                  </svg>
                )}
              </button>
            </div>
            {copied && (
              <p className="mt-2 text-xs text-green">Copied to clipboard</p>
            )}
          </div>
        ) : (
          <p className="text-sm text-muted">
            Connect your wallet to see your deposit address.
          </p>
        )}
      </div>
    </>,
    document.body,
  );
}
