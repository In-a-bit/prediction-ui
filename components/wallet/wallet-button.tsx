"use client";

import { useState } from "react";
import { useMagic } from "@/components/providers/magic-provider";
import { ConnectWalletModal } from "@/components/wallet/connect-wallet-modal";
import { submitAllowanceRegardlessOfStatus } from "@/lib/allowance";
import { getUser } from "@/lib/gamma-api";

function truncateAddress(address: string): string {
  return `${address.slice(0, 6)}...${address.slice(-4)}`;
}

export function WalletButton() {
  const { magic, walletAddress, userProfile, setUserProfile, disconnect } =
    useMagic();
  const [showProfile, setShowProfile] = useState(false);
  const [showModal, setShowModal] = useState(false);
  const [copied, setCopied] = useState(false);
  const [allowanceBusy, setAllowanceBusy] = useState(false);
  const [allowanceMsg, setAllowanceMsg] = useState<string | null>(null);

  function handleCopy() {
    if (!walletAddress) return;
    navigator.clipboard.writeText(walletAddress);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  if (walletAddress) {
    return (
      <div className="relative">
        <button
          onClick={() => setShowProfile((v) => !v)}
          className="flex items-center gap-2 rounded-xl border border-brand/40 bg-brand/10 px-4 py-2 text-sm font-medium text-brand transition-colors hover:bg-brand/20"
        >
          <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M21 12a2.25 2.25 0 00-2.25-2.25H5.25A2.25 2.25 0 003 12m18 0v6a2.25 2.25 0 01-2.25 2.25H5.25A2.25 2.25 0 013 18v-6m18 0V9M3 12V9m18-3H3m18 0a2.25 2.25 0 00-2.25-2.25H5.25A2.25 2.25 0 003 6" />
          </svg>
          <span>{truncateAddress(walletAddress)}</span>
          <svg
            className={`h-3 w-3 transition-transform ${showProfile ? "rotate-180" : ""}`}
            fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}
          >
            <path d="M19 9l-7 7-7-7" />
          </svg>
        </button>

        {showProfile && (
          <>
            {/* Click-away overlay */}
            <div className="fixed inset-0 z-40" onClick={() => setShowProfile(false)} />

            {/* Profile card */}
            <div className="absolute right-0 top-full z-50 mt-1.5 w-72 rounded-2xl border border-card-border bg-card shadow-2xl">

              {/* Header */}
              <div className="border-b border-card-border px-4 py-3">
                <div className="flex items-center gap-2.5">
                  <div className="flex h-9 w-9 items-center justify-center rounded-full bg-brand/15 text-brand">
                    <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 6a3.75 3.75 0 11-7.5 0 3.75 3.75 0 017.5 0zM4.501 20.118a7.5 7.5 0 0114.998 0A17.933 17.933 0 0112 21.75c-2.676 0-5.216-.584-7.499-1.632z" />
                    </svg>
                  </div>
                  <div className="min-w-0">
                    {userProfile?.name ? (
                      <p className="truncate text-sm font-semibold text-foreground">{userProfile.name}</p>
                    ) : (
                      <p className="text-sm font-semibold text-foreground">My Wallet</p>
                    )}
                    {userProfile?.email && (
                      <p className="truncate text-xs text-muted">{userProfile.email}</p>
                    )}
                  </div>
                </div>
              </div>

              {/* Wallet address row */}
              <div className="px-4 py-3">
                <p className="mb-1.5 text-xs text-muted">Proxy wallet address</p>
                <div className="flex items-center justify-between gap-2 rounded-xl border border-card-border bg-input px-3 py-2">
                  <p className="truncate font-mono text-xs text-foreground">
                    {walletAddress}
                  </p>
                  <button
                    onClick={handleCopy}
                    title="Copy address"
                    className="shrink-0 text-muted transition-colors hover:text-foreground"
                  >
                    {copied ? (
                      <svg className="h-3.5 w-3.5 text-green" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                      </svg>
                    ) : (
                      <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                        <rect x="9" y="9" width="13" height="13" rx="2" />
                        <path d="M5 15H4a2 2 0 01-2-2V4a2 2 0 012-2h9a2 2 0 012 2v1" />
                      </svg>
                    )}
                  </button>
                </div>
              </div>

              {userProfile && magic && (
                <div className="border-t border-card-border px-4 py-2">
                  <p className="mb-1 text-xs text-muted">
                    Allowance status
                    {userProfile.allowanceStatus ? (
                      <span className="ml-1 font-mono text-foreground">
                        {userProfile.allowanceStatus}
                      </span>
                    ) : (
                      <span className="ml-1 text-muted">—</span>
                    )}
                  </p>
                  <button
                    type="button"
                    disabled={allowanceBusy}
                    onClick={async () => {
                      setAllowanceMsg(null);
                      if (!magic || !userProfile) return;
                      setAllowanceBusy(true);
                      try {
                        const result = await submitAllowanceRegardlessOfStatus(
                          magic,
                          userProfile,
                        );
                        setAllowanceMsg(`Submitted (${result.state})`);
                        const fresh = await getUser();
                        if (fresh) setUserProfile(fresh);
                      } catch (e) {
                        setAllowanceMsg(
                          e instanceof Error ? e.message : "Request failed",
                        );
                      } finally {
                        setAllowanceBusy(false);
                      }
                    }}
                    className="text-xs font-medium text-brand underline-offset-2 transition-colors hover:underline disabled:opacity-50"
                  >
                    {allowanceBusy ? "Signing…" : "Sign allowance again"}
                  </button>
                  {allowanceMsg && (
                    <p className="mt-1 text-xs text-muted">{allowanceMsg}</p>
                  )}
                </div>
              )}

              {/* Disconnect */}
              <div className="border-t border-card-border px-2 py-1.5">
                <button
                  onClick={async () => {
                    setShowProfile(false);
                    await disconnect();
                  }}
                  className="flex w-full items-center gap-2 rounded-xl px-3 py-2 text-sm text-red transition-colors hover:bg-card-hover"
                >
                  <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a2 2 0 01-2 2H5a2 2 0 01-2-2V7a2 2 0 012-2h6a2 2 0 012 2v1" />
                  </svg>
                  Disconnect wallet
                </button>
              </div>

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
        <svg className="h-4 w-4 text-muted" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M21 12a2.25 2.25 0 00-2.25-2.25H5.25A2.25 2.25 0 003 12m18 0v6a2.25 2.25 0 01-2.25 2.25H5.25A2.25 2.25 0 013 18v-6m18 0V9M3 12V9m18-3H3m18 0a2.25 2.25 0 00-2.25-2.25H5.25A2.25 2.25 0 003 6" />
        </svg>
        Connect Wallet
      </button>

      {showModal && <ConnectWalletModal onClose={() => setShowModal(false)} />}
    </>
  );
}
