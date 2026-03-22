"use client";

import { useCallback, useEffect, useState, useSyncExternalStore } from "react";
import { createPortal } from "react-dom";
import { useMagic } from "@/components/providers/magic-provider";

type DepositModalProps = {
  open: boolean;
  onClose: () => void;
};

export function DepositModal({ open, onClose }: DepositModalProps) {
  const { userProfile, walletAddress } = useMagic();
  const proxyAddress = userProfile?.proxyWallet ?? walletAddress ?? "";
  const [copied, setCopied] = useState(false);
  const isClient = useSyncExternalStore(
    () => () => {},
    () => true,
    () => false,
  );

  const handleClose = useCallback(() => {
    setCopied(false);
    onClose();
  }, [onClose]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") handleClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, handleClose]);

  if (!open || !isClient) return null;

  function handleCopy() {
    if (!proxyAddress) return;
    void navigator.clipboard.writeText(proxyAddress);
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
