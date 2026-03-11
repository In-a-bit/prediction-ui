"use client";

import { useState } from "react";
import { useMagic } from "@/components/providers/magic-provider";
import { ConnectWalletModal } from "@/components/wallet/connect-wallet-modal";

function truncateAddress(address: string): string {
  return `${address.slice(0, 6)}...${address.slice(-4)}`;
}

export function WalletButton() {
  const { walletAddress, disconnect } = useMagic();
  const [showModal, setShowModal] = useState(false);
  const [showDisconnect, setShowDisconnect] = useState(false);

  if (walletAddress) {
    return (
      <div className="relative">
        <button
          onClick={() => setShowDisconnect((v) => !v)}
          className="flex items-center gap-2 rounded-xl border border-brand/40 bg-brand/10 px-4 py-2 text-sm font-medium text-brand transition-colors hover:bg-brand/20"
        >
          {/* Wallet icon */}
          <svg
            className="h-4 w-4"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            strokeWidth={1.8}
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M21 12a2.25 2.25 0 00-2.25-2.25H5.25A2.25 2.25 0 003 12m18 0v6a2.25 2.25 0 01-2.25 2.25H5.25A2.25 2.25 0 013 18v-6m18 0V9M3 12V9m18-3H3m18 0a2.25 2.25 0 00-2.25-2.25H5.25A2.25 2.25 0 003 6"
            />
          </svg>
          <span>{truncateAddress(walletAddress)}</span>
          <svg
            className={`h-3 w-3 transition-transform ${showDisconnect ? "rotate-180" : ""}`}
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            strokeWidth={2.5}
          >
            <path d="M19 9l-7 7-7-7" />
          </svg>
        </button>

        {showDisconnect && (
          <>
            {/* Click-away overlay */}
            <div
              className="fixed inset-0 z-40"
              onClick={() => setShowDisconnect(false)}
            />
            <div className="absolute right-0 top-full z-50 mt-1.5 w-48 rounded-xl border border-card-border bg-card py-1 shadow-xl">
              <div className="border-b border-card-border px-3 py-2">
                <p className="text-xs text-muted">Connected wallet</p>
                <p className="mt-0.5 font-mono text-xs text-foreground">
                  {truncateAddress(walletAddress)}
                </p>
              </div>
              <button
                onClick={async () => {
                  setShowDisconnect(false);
                  await disconnect();
                }}
                className="flex w-full items-center gap-2 px-3 py-2 text-sm text-red transition-colors hover:bg-card-hover"
              >
                <svg
                  className="h-3.5 w-3.5"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                  strokeWidth={2}
                >
                  <path d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a2 2 0 01-2 2H5a2 2 0 01-2-2V7a2 2 0 012-2h6a2 2 0 012 2v1" />
                </svg>
                Disconnect wallet
              </button>
            </div>
          </>
        )}
      </div>
    );
  }

  return (
    <>
      <button
        onClick={() => setShowModal(true)}
        className="flex items-center gap-2 rounded-xl border border-card-border px-4 py-2 text-sm font-medium text-foreground transition-colors hover:border-brand/50 hover:bg-card-hover"
      >
        <svg
          className="h-4 w-4 text-muted"
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
          strokeWidth={1.8}
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            d="M21 12a2.25 2.25 0 00-2.25-2.25H5.25A2.25 2.25 0 003 12m18 0v6a2.25 2.25 0 01-2.25 2.25H5.25A2.25 2.25 0 013 18v-6m18 0V9M3 12V9m18-3H3m18 0a2.25 2.25 0 00-2.25-2.25H5.25A2.25 2.25 0 003 6"
          />
        </svg>
        Connect Wallet
      </button>

      {showModal && (
        <ConnectWalletModal onClose={() => setShowModal(false)} />
      )}
    </>
  );
}
