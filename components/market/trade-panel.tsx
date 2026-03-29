"use client";

import { useState, useCallback, useMemo } from "react";
import { useSession } from "next-auth/react";
import Link from "next/link";
import { OutcomeToggle } from "@/components/market/outcome-toggle";
import { useMidpoint } from "@/lib/hooks/use-prices";
import { useMagic } from "@/components/providers/magic-provider";
import { useCollateralBalance } from "@/lib/hooks/use-collateral-balance";
import { useTokenBalances } from "@/lib/hooks/use-token-balances";
import { getOrDeriveClobCredentials } from "@/lib/clob-auth";
import { submitOrder } from "@/lib/clob-order";
import { cn } from "@/lib/utils";

type OrderType = "market" | "limit";

/** Round a number to the nearest tick size step */
function roundToTick(value: number, tick: number): number {
  if (tick <= 0) return value;
  return Math.round(value / tick) * tick;
}

/** Round to 6 decimal places (USDC precision) */
function round6(value: number): number {
  return Math.round(value * 1e6) / 1e6;
}

export function TradePanel({
  yesTokenId,
  noTokenId,
  initialYesPrice,
  initialNoPrice,
  tickSize = 0.01,
  minOrderSize = 1,
}: {
  yesTokenId: string | undefined;
  noTokenId: string | undefined;
  initialYesPrice: number;
  initialNoPrice: number;
  /** Price min tick size as a decimal (e.g. 0.01 = 1¢). Default 0.01 */
  tickSize?: number;
  /** Minimum order size in shares. Default 1 */
  minOrderSize?: number;
}) {
  const { data: session } = useSession();
  const { magic, userProfile } = useMagic();
  const [outcome, setOutcome] = useState<"yes" | "no">("yes");
  const [side, setSide] = useState<"buy" | "sell">("buy");
  const [orderType, setOrderType] = useState<OrderType>("market");
  const [amount, setAmount] = useState("");
  const [limitPrice, setLimitPrice] = useState("");
  const [limitShares, setLimitShares] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [orderResult, setOrderResult] = useState<string | null>(null);

  const { balanceNormalized: usdcBalanceStr } = useCollateralBalance();
  const { yesBalance, noBalance } = useTokenBalances(yesTokenId, noTokenId);

  const usdcBalance = usdcBalanceStr ? parseFloat(usdcBalanceStr) : 0;
  const currentTokenBalance = outcome === "yes" ? yesBalance : noBalance;

  const currentTokenId = outcome === "yes" ? yesTokenId : noTokenId;
  const { data: midpoint } = useMidpoint(currentTokenId);

  // Tick size in cents for display (e.g. 0.01 -> 1, 0.1 -> 10)
  const tickCents = round6(tickSize * 100);

  const livePriceCents = midpoint
    ? Math.round(midpoint * 100)
    : outcome === "yes"
      ? initialYesPrice
      : initialNoPrice;

  const order = useMemo(() => {
    if (orderType === "market") {
      const dollarAmount = parseFloat(amount) || 0;
      const price = livePriceCents / 100;
      const shares = dollarAmount > 0 && price > 0 ? round6(dollarAmount / price) : 0;
      return { dollarAmount, price, shares };
    }
    const priceCents = parseFloat(limitPrice) || 0;
    const shares = parseFloat(limitShares) || 0;
    const price = round6(priceCents / 100);
    const dollarAmount = round6(shares * price);
    return { dollarAmount, price, shares };
  }, [orderType, amount, limitPrice, limitShares, livePriceCents]);

  const potentialReturn =
    side === "buy"
      ? order.shares * 1 - order.dollarAmount
      : order.dollarAmount - order.shares * 0;

  const priceValid = order.price > 0 && order.price < 1;
  const sharesValid = orderType === "market" || order.shares >= minOrderSize;

  const exceedsBalance =
    side === "buy"
      ? order.dollarAmount > 0 && order.dollarAmount > usdcBalance
      : order.shares > 0 && order.shares > currentTokenBalance;

  const canSubmit =
    order.dollarAmount > 0 &&
    priceValid &&
    sharesValid &&
    !exceedsBalance &&
    !submitting &&
    !!userProfile?.proxyWallet;

  /** Snap the limit price input to the nearest tick */
  const handleLimitPriceBlur = useCallback(() => {
    const raw = parseFloat(limitPrice);
    if (!raw && raw !== 0) return;
    // Clamp to [tickCents, 100-tickCents] then snap to tick
    const clamped = Math.min(Math.max(raw, tickCents), 100 - tickCents);
    const snapped = roundToTick(clamped, tickCents);
    setLimitPrice(String(round6(snapped)));
  }, [limitPrice, tickCents]);

  /** Snap limit shares to 6 decimals and enforce min */
  const handleLimitSharesBlur = useCallback(() => {
    const raw = parseFloat(limitShares);
    if (!raw && raw !== 0) return;
    const snapped = round6(Math.max(raw, 0));
    setLimitShares(snapped > 0 ? String(snapped) : "");
  }, [limitShares]);

  /** Increment / decrement price by one tick */
  const adjustPrice = useCallback(
    (direction: 1 | -1) => {
      const current = parseFloat(limitPrice) || livePriceCents;
      const next = round6(current + direction * tickCents);
      const clamped = Math.min(Math.max(next, tickCents), 100 - tickCents);
      setLimitPrice(String(round6(clamped)));
    },
    [limitPrice, livePriceCents, tickCents],
  );

  const handleSubmit = useCallback(async () => {
    if (!magic || !currentTokenId || order.dollarAmount <= 0 || !priceValid || !userProfile?.proxyWallet) return;

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
      }, userProfile.proxyWallet);

      setOrderResult(`Order ${result.status} (${result.orderHash.slice(0, 10)}…)`);
      if (orderType === "market") setAmount("");
      else setLimitShares("");
    } catch (err) {
      console.error("[TradePanel] order submission error:", err);
      setOrderResult(err instanceof Error ? err.message : "Order failed");
    } finally {
      setSubmitting(false);
    }
  }, [magic, currentTokenId, order, priceValid, side, orderType, userProfile]);

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

      {/* Available balance */}
      {userProfile?.proxyWallet && (
        <div className="mb-3 flex items-center justify-between text-xs">
          <span className="text-muted">Available</span>
          <span className={cn("font-medium", exceedsBalance ? "text-red" : "text-foreground")}>
            {side === "buy"
              ? `$${usdcBalance.toFixed(2)} USDC.e`
              : `${currentTokenBalance.toFixed(2)} ${outcome === "yes" ? "Yes" : "No"} shares`}
          </span>
        </div>
      )}

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
            {side === "buy" && usdcBalance > 0 && (
              <button
                onClick={() => setAmount(String(Math.floor(usdcBalance * 100) / 100))}
                className="flex-1 rounded-lg border border-brand/40 bg-brand/5 py-1.5 text-xs font-medium text-brand transition-colors hover:border-brand hover:bg-brand/10"
              >
                Max
              </button>
            )}
          </div>
        </div>
      ) : (
        /* ── Limit order: price + shares inputs ── */
        <div className="mb-4 space-y-3">
          {/* Price */}
          <div>
            <div className="mb-1.5 flex items-center justify-between">
              <label className="text-sm font-medium text-muted">Price</label>
              <span className="text-[11px] text-muted/70">
                Tick: {tickCents}¢
              </span>
            </div>
            <div className="relative flex items-center">
              <button
                type="button"
                onClick={() => adjustPrice(-1)}
                className="absolute left-1.5 z-10 flex h-7 w-7 items-center justify-center rounded-lg border border-card-border bg-card text-sm font-bold text-muted transition-colors hover:border-brand hover:text-foreground"
              >
                −
              </button>
              <input
                type="number"
                value={limitPrice}
                onChange={(e) => setLimitPrice(e.target.value)}
                onBlur={handleLimitPriceBlur}
                placeholder={String(livePriceCents)}
                min={tickCents}
                max={100 - tickCents}
                step={tickCents}
                className="w-full rounded-xl border border-input-border bg-input py-3 pl-11 pr-11 text-center text-foreground placeholder:text-muted/50 focus:border-brand focus:outline-none"
              />
              <button
                type="button"
                onClick={() => adjustPrice(1)}
                className="absolute right-1.5 z-10 flex h-7 w-7 items-center justify-center rounded-lg border border-card-border bg-card text-sm font-bold text-muted transition-colors hover:border-brand hover:text-foreground"
              >
                +
              </button>
            </div>
            {limitPrice && (parseFloat(limitPrice) <= 0 || parseFloat(limitPrice) >= 100) && (
              <p className="mt-1 text-[11px] text-red">
                Price must be between {tickCents}¢ and {round6(100 - tickCents)}¢
              </p>
            )}
            <div className="mt-2 flex gap-2">
              {[10, 25, 50, 75].map((v) => (
                <button
                  key={v}
                  onClick={() => setLimitPrice(String(roundToTick(v, tickCents)))}
                  className="flex-1 rounded-lg border border-card-border py-1.5 text-xs font-medium text-muted transition-colors hover:border-brand hover:text-foreground"
                >
                  {v}¢
                </button>
              ))}
            </div>
          </div>

          {/* Shares */}
          <div>
            <div className="mb-1.5 flex items-center justify-between">
              <label className="text-sm font-medium text-muted">Shares</label>
              <span className="text-[11px] text-muted/70">
                Min: {minOrderSize}
              </span>
            </div>
            <input
              type="number"
              value={limitShares}
              onChange={(e) => setLimitShares(e.target.value)}
              onBlur={handleLimitSharesBlur}
              placeholder={String(minOrderSize)}
              min={minOrderSize}
              step="0.000001"
              className={cn(
                "w-full rounded-xl border bg-input py-3 px-4 text-foreground placeholder:text-muted/50 focus:border-brand focus:outline-none",
                limitShares && parseFloat(limitShares) > 0 && parseFloat(limitShares) < minOrderSize
                  ? "border-red/50"
                  : "border-input-border",
              )}
            />
            {limitShares && parseFloat(limitShares) > 0 && parseFloat(limitShares) < minOrderSize && (
              <p className="mt-1 text-[11px] text-red">
                Minimum order size is {minOrderSize} shares
              </p>
            )}
            <div className="mt-2 flex gap-2">
              {[10, 50, 100, 500].map((v) => (
                <button
                  key={v}
                  onClick={() => setLimitShares(String(Math.max(v, minOrderSize)))}
                  className="flex-1 rounded-lg border border-card-border py-1.5 text-xs font-medium text-muted transition-colors hover:border-brand hover:text-foreground"
                >
                  {v}
                </button>
              ))}
              {side === "sell" && currentTokenBalance > 0 && (
                <button
                  onClick={() => setLimitShares(String(Math.floor(currentTokenBalance * 1e6) / 1e6))}
                  className="flex-1 rounded-lg border border-brand/40 bg-brand/5 py-1.5 text-xs font-medium text-brand transition-colors hover:border-brand hover:bg-brand/10"
                >
                  Max
                </button>
              )}
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
            <span>{order.shares.toFixed(6)}</span>
          </div>
          <div className="flex justify-between text-xs text-muted">
            <span>Total</span>
            <span>${order.dollarAmount.toFixed(6)}</span>
          </div>
          <div className="flex justify-between text-xs font-medium text-foreground">
            <span>Potential return</span>
            <span className="text-green">
              ${potentialReturn.toFixed(2)} ({order.dollarAmount > 0 ? ((potentialReturn / order.dollarAmount) * 100).toFixed(0) : 0}%)
            </span>
          </div>
        </div>
      )}

      {/* Balance warning */}
      {exceedsBalance && (
        <p className="mb-3 text-center text-xs font-medium text-red">
          {side === "buy"
            ? "Insufficient USDC.e balance"
            : `Insufficient ${outcome === "yes" ? "Yes" : "No"} token balance`}
        </p>
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

      {!userProfile?.proxyWallet && session?.user && (
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
