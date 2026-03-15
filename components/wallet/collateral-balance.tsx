"use client";

import { useCallback, useEffect, useState } from "react";
import { useMagic } from "@/components/providers/magic-provider";
import { getCollateralBalance } from "@/lib/dpm-api";

export function CollateralBalance() {
  const { walletAddress } = useMagic();
  const [balance, setBalance] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(false);

  const fetchBalance = useCallback(async () => {
    if (!walletAddress) {
      setBalance(null);
      setError(false);
      return;
    }
    setLoading(true);
    setError(false);
    try {
      const data = await getCollateralBalance(walletAddress);
      if (data) {
        setBalance(data.balance_normalized);
      } else {
        setError(true);
        setBalance(null);
      }
    } catch {
      setError(true);
      setBalance(null);
    } finally {
      setLoading(false);
    }
  }, [walletAddress]);

  useEffect(() => {
    fetchBalance();
  }, [fetchBalance]);

  if (!walletAddress) return null;

  return (
    <div className="flex items-center gap-2 rounded-xl border border-card-border bg-card px-3 py-2 text-sm">
      <span className="text-muted">Balance</span>
      {loading && balance === null && !error ? (
        <span className="font-medium text-muted">—</span>
      ) : error ? (
        <span className="font-medium text-red">Error</span>
      ) : (
        <span className="font-medium text-foreground">{balance ?? "0"}</span>
      )}
      <button
        type="button"
        onClick={() => fetchBalance()}
        disabled={loading}
        title="Refresh balance"
        className="rounded p-1 text-muted transition-colors hover:bg-card-hover hover:text-foreground disabled:opacity-50"
      >
        <svg
          className={`h-3.5 w-3.5 ${loading ? "animate-spin" : ""}`}
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
          strokeWidth={2}
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"
          />
        </svg>
      </button>
    </div>
  );
}
