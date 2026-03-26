"use client";

import { useState, useCallback } from "react";
import { useSession } from "next-auth/react";
import Link from "next/link";
import { OutcomeToggle } from "@/components/market/outcome-toggle";
import { useMidpoint } from "@/lib/hooks/use-prices";
import { useMagic } from "@/components/providers/magic-provider";
import { getOrDeriveClobCredentials } from "@/lib/clob-auth";
import { submitOrder } from "@/lib/clob-order";
import { cn } from "@/lib/utils";

export function TradePanel({
  yesTokenId,
  noTokenId,
  initialYesPrice,
  initialNoPrice,
}: {
  yesTokenId: string | undefined;
  noTokenId: string | undefined;
  initialYesPrice: number;
  initialNoPrice: number;
}) {
  const { data: session } = useSession();
  const { magic, walletAddress } = useMagic();
  const [outcome, setOutcome] = useState<"yes" | "no">("yes");
  const [side, setSide] = useState<"buy" | "sell">("buy");
  const [amount, setAmount] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [orderResult, setOrderResult] = useState<string | null>(null);

  const currentTokenId = outcome === "yes" ? yesTokenId : noTokenId;
  const { data: midpoint } = useMidpoint(currentTokenId);

  const livePrice = midpoint
    ? Math.round(midpoint * 100)
    : outcome === "yes"
      ? initialYesPrice
      : initialNoPrice;

  const amountNum = parseFloat(amount) || 0;
  const pricePerShare = livePrice / 100;
  const shares = amountNum > 0 ? amountNum / pricePerShare : 0;
  const potentialReturn =
    side === "buy" ? shares * 1 - amountNum : amountNum - shares * 0;

  const handleSubmit = useCallback(async () => {
    if (!magic || !currentTokenId || amountNum <= 0 || pricePerShare <= 0) return;

    const clobBaseUrl = process.env.NEXT_PUBLIC_CLOB_API_URL;
    if (!clobBaseUrl) {
      setOrderResult("CLOB API URL not configured");
      return;
    }

    setSubmitting(true);
    setOrderResult(null);

    try {
      const creds = await getOrDeriveClobCredentials(magic);
      const result = await submitOrder(magic, creds, clobBaseUrl, {
        side: side === "buy" ? 0 : 1,
        tokenId: currentTokenId,
        amount: amountNum,
        price: pricePerShare,
      });

      setOrderResult(`Order ${result.status} (${result.orderHash.slice(0, 10)}…)`);
      setAmount("");
    } catch (err) {
      setOrderResult(err instanceof Error ? err.message : "Order failed");
    } finally {
      setSubmitting(false);
    }
  }, [magic, currentTokenId, amountNum, pricePerShare, side]);

  if (!session?.user) {
    return (
      <div className="rounded-2xl border border-card-border bg-card p-6">
        <h3 className="mb-2 text-sm font-semibold text-foreground">Trade</h3>
        <p className="mb-4 text-sm text-muted">
          Log in to start trading on this market
        </p>
        <Link
          href="/login"
          className="block w-full rounded-xl bg-brand py-3 text-center text-sm font-semibold text-white transition-colors hover:bg-brand-hover"
        >
          Log in to trade
        </Link>
      </div>
    );
  }

  return (
    <div className="rounded-2xl border border-card-border bg-card p-6">
      {/* Buy/Sell toggle */}
      <div className="mb-4 flex rounded-xl bg-input p-1">
        <button
          onClick={() => setSide("buy")}
          className={cn(
            "flex-1 rounded-lg py-2 text-sm font-semibold transition-colors",
            side === "buy"
              ? "bg-green text-white"
              : "text-muted hover:text-foreground"
          )}
        >
          Buy
        </button>
        <button
          onClick={() => setSide("sell")}
          className={cn(
            "flex-1 rounded-lg py-2 text-sm font-semibold transition-colors",
            side === "sell"
              ? "bg-red text-white"
              : "text-muted hover:text-foreground"
          )}
        >
          Sell
        </button>
      </div>

      {/* Outcome toggle */}
      <div className="mb-4">
        <OutcomeToggle
          selected={outcome}
          onSelect={setOutcome}
          yesPrice={initialYesPrice}
          noPrice={initialNoPrice}
        />
      </div>

      {/* Amount input */}
      <div className="mb-4">
        <label className="mb-1.5 block text-sm font-medium text-muted">
          Amount ($)
        </label>
        <div className="relative">
          <span className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-sm text-muted">
            $
          </span>
          <input
            type="number"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            placeholder="0.00"
            min="0"
            step="0.01"
            className="w-full rounded-xl border border-input-border bg-input py-3 pl-8 pr-4 text-foreground placeholder:text-muted/50 focus:border-brand focus:outline-none"
          />
        </div>
        {/* Quick amounts */}
        <div className="mt-2 flex gap-2">
          {[10, 25, 50, 100].map((v) => (
            <button
              key={v}
              onClick={() => setAmount(String(v))}
              className="flex-1 rounded-lg border border-card-border py-1.5 text-xs font-medium text-muted transition-colors hover:border-brand hover:text-foreground"
            >
              ${v}
            </button>
          ))}
        </div>
      </div>

      {/* Order summary */}
      {amountNum > 0 && (
        <div className="mb-4 space-y-2 rounded-xl bg-input p-3">
          <div className="flex justify-between text-xs text-muted">
            <span>Avg price</span>
            <span>{livePrice}¢</span>
          </div>
          <div className="flex justify-between text-xs text-muted">
            <span>Shares</span>
            <span>{shares.toFixed(2)}</span>
          </div>
          <div className="flex justify-between text-xs font-medium text-foreground">
            <span>Potential return</span>
            <span className="text-green">
              ${potentialReturn.toFixed(2)} ({((potentialReturn / amountNum) * 100).toFixed(0)}%)
            </span>
          </div>
        </div>
      )}

      {/* Submit */}
      <button
        disabled={amountNum <= 0 || submitting || !walletAddress}
        onClick={handleSubmit}
        className={cn(
          "w-full rounded-xl py-3.5 text-sm font-semibold text-white transition-all active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-40",
          side === "buy"
            ? "bg-green hover:bg-green/90"
            : "bg-red hover:bg-red/90"
        )}
      >
        {submitting
          ? "Submitting…"
          : `${side === "buy" ? "Buy" : "Sell"} ${outcome === "yes" ? "Yes" : "No"}${amountNum > 0 ? ` — $${amountNum.toFixed(2)}` : ""}`}
      </button>

      {!walletAddress && session?.user && (
        <p className="mt-2 text-center text-xs text-muted">
          Connect your wallet to trade
        </p>
      )}

      {orderResult && (
        <p className="mt-2 text-center text-xs text-muted">{orderResult}</p>
      )}
    </div>
  );
}
