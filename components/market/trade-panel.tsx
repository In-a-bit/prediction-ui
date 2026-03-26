"use client";

import { useState, useCallback, useMemo } from "react";
import { useSession } from "next-auth/react";
import Link from "next/link";
import { OutcomeToggle } from "@/components/market/outcome-toggle";
import { useMidpoint } from "@/lib/hooks/use-prices";
import { useMagic } from "@/components/providers/magic-provider";
import { getOrDeriveClobCredentials } from "@/lib/clob-auth";
import { submitOrder } from "@/lib/clob-order";
import { cn } from "@/lib/utils";

type OrderType = "market" | "limit";

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
  const [orderType, setOrderType] = useState<OrderType>("market");
  const [amount, setAmount] = useState("");
  const [limitPrice, setLimitPrice] = useState("");
  const [limitShares, setLimitShares] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [orderResult, setOrderResult] = useState<string | null>(null);

  const currentTokenId = outcome === "yes" ? yesTokenId : noTokenId;
  const { data: midpoint } = useMidpoint(currentTokenId);

  const livePriceCents = midpoint
    ? Math.round(midpoint * 100)
    : outcome === "yes"
      ? initialYesPrice
      : initialNoPrice;

  const order = useMemo(() => {
    if (orderType === "market") {
      const dollarAmount = parseFloat(amount) || 0;
      const price = livePriceCents / 100;
      const shares = dollarAmount > 0 && price > 0 ? dollarAmount / price : 0;
      return { dollarAmount, price, shares };
    }
    const priceCents = parseFloat(limitPrice) || 0;
    const shares = parseFloat(limitShares) || 0;
    const price = priceCents / 100;
    const dollarAmount = shares * price;
    return { dollarAmount, price, shares };
  }, [orderType, amount, limitPrice, limitShares, livePriceCents]);

  const potentialReturn =
    side === "buy"
      ? order.shares * 1 - order.dollarAmount
      : order.dollarAmount - order.shares * 0;

  const canSubmit = order.dollarAmount > 0 && order.price > 0 && !submitting && !!walletAddress;

  const handleSubmit = useCallback(async () => {
    if (!magic || !currentTokenId || order.dollarAmount <= 0 || order.price <= 0) return;

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
        amount: order.dollarAmount,
        price: order.price,
      });

      setOrderResult(`Order ${result.status} (${result.orderHash.slice(0, 10)}…)`);
      if (orderType === "market") setAmount("");
      else setLimitShares("");
    } catch (err) {
      setOrderResult(err instanceof Error ? err.message : "Order failed");
    } finally {
      setSubmitting(false);
    }
  }, [magic, currentTokenId, order, side, orderType]);

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

      {/* Market / Limit toggle */}
      <div className="mb-4 flex gap-1 border-b border-card-border">
        {(["market", "limit"] as const).map((t) => (
          <button
            key={t}
            onClick={() => setOrderType(t)}
            className={cn(
              "px-3 pb-2 text-sm font-medium capitalize transition-colors",
              orderType === t
                ? "border-b-2 border-brand text-foreground"
                : "text-muted hover:text-foreground"
            )}
          >
            {t}
          </button>
        ))}
      </div>

      {orderType === "market" ? (
        /* ── Market order: dollar amount input ── */
        <div className="mb-4">
          <label className="mb-1.5 block text-sm font-medium text-muted">
            Amount
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
      ) : (
        /* ── Limit order: price + shares inputs ── */
        <div className="mb-4 space-y-3">
          <div>
            <label className="mb-1.5 block text-sm font-medium text-muted">
              Price
            </label>
            <div className="relative">
              <input
                type="number"
                value={limitPrice}
                onChange={(e) => setLimitPrice(e.target.value)}
                placeholder={String(livePriceCents)}
                min="1"
                max="99"
                step="1"
                className="w-full rounded-xl border border-input-border bg-input py-3 pl-4 pr-8 text-foreground placeholder:text-muted/50 focus:border-brand focus:outline-none"
              />
              <span className="pointer-events-none absolute right-4 top-1/2 -translate-y-1/2 text-sm text-muted">
                ¢
              </span>
            </div>
            <div className="mt-2 flex gap-2">
              {[10, 25, 50, 75].map((v) => (
                <button
                  key={v}
                  onClick={() => setLimitPrice(String(v))}
                  className="flex-1 rounded-lg border border-card-border py-1.5 text-xs font-medium text-muted transition-colors hover:border-brand hover:text-foreground"
                >
                  {v}¢
                </button>
              ))}
            </div>
          </div>
          <div>
            <label className="mb-1.5 block text-sm font-medium text-muted">
              Shares
            </label>
            <input
              type="number"
              value={limitShares}
              onChange={(e) => setLimitShares(e.target.value)}
              placeholder="0"
              min="0"
              step="1"
              className="w-full rounded-xl border border-input-border bg-input py-3 px-4 text-foreground placeholder:text-muted/50 focus:border-brand focus:outline-none"
            />
            <div className="mt-2 flex gap-2">
              {[10, 50, 100, 500].map((v) => (
                <button
                  key={v}
                  onClick={() => setLimitShares(String(v))}
                  className="flex-1 rounded-lg border border-card-border py-1.5 text-xs font-medium text-muted transition-colors hover:border-brand hover:text-foreground"
                >
                  {v}
                </button>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Order summary */}
      {order.dollarAmount > 0 && (
        <div className="mb-4 space-y-2 rounded-xl bg-input p-3">
          <div className="flex justify-between text-xs text-muted">
            <span>{orderType === "limit" ? "Limit price" : "Avg price"}</span>
            <span>{Math.round(order.price * 100)}¢</span>
          </div>
          <div className="flex justify-between text-xs text-muted">
            <span>Shares</span>
            <span>{order.shares.toFixed(2)}</span>
          </div>
          <div className="flex justify-between text-xs text-muted">
            <span>Total</span>
            <span>${order.dollarAmount.toFixed(2)}</span>
          </div>
          <div className="flex justify-between text-xs font-medium text-foreground">
            <span>Potential return</span>
            <span className="text-green">
              ${potentialReturn.toFixed(2)} ({((potentialReturn / order.dollarAmount) * 100).toFixed(0)}%)
            </span>
          </div>
        </div>
      )}

      {/* Submit */}
      <button
        disabled={!canSubmit}
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
          : `${side === "buy" ? "Buy" : "Sell"} ${outcome === "yes" ? "Yes" : "No"}${order.dollarAmount > 0 ? ` — $${order.dollarAmount.toFixed(2)}` : ""}`}
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
