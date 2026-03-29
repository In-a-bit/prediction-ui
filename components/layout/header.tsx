"use client";

import { useSession } from "next-auth/react";
import { useState, useRef, useCallback, useEffect } from "react";
import { useRouter, useSearchParams, usePathname } from "next/navigation";
import {
  AuthNavLoginLink,
  AuthNavSignedInBar,
  AuthNavSignupLink,
} from "@/components/auth/auth-nav-buttons";
import { useMagic } from "@/components/providers/magic-provider";
import { WalletButton } from "@/components/wallet/wallet-button";
import { CollateralBalance } from "@/components/wallet/collateral-balance";
import { DepositModal } from "@/components/wallet/deposit-modal";

/** Predictions + Plaee surfaces where wallet, deposit, and portfolio balance belong. */
function isTradingSurface(pathname: string) {
  return (
    pathname.startsWith("/predictions") ||
    pathname.startsWith("/event/") ||
    pathname.startsWith("/portfolio") ||
    pathname.startsWith("/plaee")
  );
}

function isCasinoSurface(pathname: string) {
  return pathname === "/" || pathname.startsWith("/games/");
}

export function Header() {
  const { data: session, status } = useSession();
  const { walletAddress } = useMagic();
  const walletConnected = Boolean(walletAddress);
  const [depositOpen, setDepositOpen] = useState(false);
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [searchQuery, setSearchQuery] = useState(searchParams.get("q") ?? "");
  const debounceRef = useRef<ReturnType<typeof setTimeout>>(undefined);
  const showTradingToolbar = isTradingSurface(pathname);
  const searchPlaceholder = isCasinoSurface(pathname)
    ? "Search casino"
    : "Search prediction markets";

  // Sync input from URL on external navigation (back/forward, sidebar clicks)
  useEffect(() => {
    setSearchQuery(searchParams.get("q") ?? "");
  }, [searchParams]);

  const navigateSearch = useCallback(
    (value: string) => {
      const trimmed = value.trim();

      const target = new URLSearchParams();
      if (trimmed) {
        target.set("q", trimmed);
      }

      const qs = target.toString();
      // If already on predictions, replace so we don't pollute history per keystroke.
      // From any other page, push so the user can go back.
      if (pathname === "/predictions") {
        router.replace(qs ? `/predictions?${qs}` : "/predictions");
      } else {
        router.push(qs ? `/predictions?${qs}` : "/predictions");
      }
    },
    [router, pathname, searchParams],
  );

  function handleChange(e: React.ChangeEvent<HTMLInputElement>) {
    const value = e.target.value;
    setSearchQuery(value);

    clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => navigateSearch(value), 300);
  }

  function handleClear() {
    clearTimeout(debounceRef.current);
    setSearchQuery("");
    navigateSearch("");
  }

  return (
    <header className="sticky top-0 z-40 mb-6 border-b border-card-border bg-header backdrop-blur-xl">
      {/* Row 1 — every screen: search + shared auth nav (login/signup or log out) */}
      <div className="flex w-full items-center gap-4 py-3">
        <div className="relative min-w-0 max-w-xl flex-1">
          <svg
            className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            strokeWidth={2}
          >
            <circle cx="11" cy="11" r="8" />
            <path d="M21 21l-4.35-4.35" />
          </svg>
          <input
            type="text"
            value={searchQuery}
            onChange={handleChange}
            placeholder={searchPlaceholder}
            className="w-full rounded-xl border border-card-border bg-input py-2.5 pl-10 pr-10 text-sm text-foreground placeholder:text-muted/50 focus:border-brand focus:outline-none"
          />
          {searchQuery && (
            <button
              onClick={handleClear}
              className="absolute right-3 top-1/2 -translate-y-1/2 rounded-md p-0.5 text-muted transition-colors hover:text-foreground"
            >
              <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          )}
        </div>

        <div className="ml-auto flex shrink-0 items-center gap-3">
          {status === "loading" && (
            <div
              className="h-10 w-[min(100%,14rem)] max-w-[14rem] animate-pulse rounded-xl border border-card-border bg-input"
              aria-hidden
            />
          )}
          {status !== "loading" && session?.user && <AuthNavSignedInBar />}
          {status !== "loading" && !session?.user && (
            <>
              <AuthNavLoginLink />
              <AuthNavSignupLink />
            </>
          )}
        </div>
      </div>

      {/* Row 2 — Predictions & Plaee only: trading wallet strip */}
      {showTradingToolbar && status !== "loading" && session?.user && (
        <div className="flex justify-center border-t border-card-border/70 bg-card/20 py-3">
          <div className="inline-flex flex-wrap items-center justify-center gap-2">
            {walletConnected && (
              <button
                type="button"
                onClick={() => setDepositOpen(true)}
                className="rounded-xl bg-brand px-4 py-2.5 text-sm font-bold text-white shadow-[0_2px_12px_rgba(36,98,255,0.45)] transition-colors hover:bg-brand-hover hover:shadow-[0_4px_16px_rgba(36,98,255,0.5)]"
              >
                Deposit
              </button>
            )}
            <WalletButton />
            <CollateralBalance />
          </div>
        </div>
      )}

      <DepositModal open={depositOpen} onClose={() => setDepositOpen(false)} />
    </header>
  );
}
