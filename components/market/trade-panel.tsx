"use client";

import { useState, useCallback, useMemo } from "react";
import { useSession } from "next-auth/react";
import Link from "next/link";
import { OutcomeToggle } from "@/components/market/outcome-toggle";
import { useMidpoint } from "@/lib/hooks/use-prices";
import { useMagic } from "@/components/providers/magic-provider";
import { useCollateralBalance } from "@/lib/hooks/use-collateral-balance";
import { useTokenBalances } from "@/lib/hooks/use-token-balances";
import { useOrderBook } from "@/lib/hooks/use-orderbook";
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
  onOutcomeChange,
}: {
  yesTokenId: string | undefined;
  noTokenId: string | undefined;
  initialYesPrice: number;
  initialNoPrice: number;
  /** Price min tick size as a decimal (e.g. 0.01 = 1¢). Default 0.01 */
  tickSize?: number;
  /** Minimum order size in shares. Default 1 */
  minOrderSize?: number;
  /** Called when the user switches outcome (yes/no) — parent can use this to sync orderbook */
  onOutcomeChange?: (outcome: "yes" | "no") => void;
}) {
  const { data: session } = useSession();
  const { magic, userProfile } = useMagic();
  const [outcome, setOutcomeState] = useState<"yes" | "no">("yes");
  const [side, setSide] = useState<"buy" | "sell">("buy");

  const setOutcome = useCallback((o: "yes" | "no") => {
    setOutcomeState(o);
    onOutcomeChange?.(o);
  }, [onOutcomeChange]);
  const [orderType, setOrderType] = useState<OrderType>("market");
  const [amount, setAmount] = useState("");
  const [limitPrice, setLimitPrice] = useState("");
  const [limitShares, setLimitShares] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [orderResult, setOrderResult] = useState<string | null>(null);
  const [showOrderTypeMenu, setShowOrderTypeMenu] = useState(false);

  const { balanceNormalized: usdcBalanceStr } = useCollateralBalance();
  const { yesBalance, noBalance } = useTokenBalances(yesTokenId, noTokenId);

  const usdcBalance = usdcBalanceStr ? parseFloat(usdcBalanceStr) : 0;
  const currentTokenBalance = outcome === "yes" ? yesBalance : noBalance;

  const currentTokenId = outcome === "yes" ? yesTokenId : noTokenId;
  const { data: midpoint } = useMidpoint(currentTokenId);

  // Orderbook data for best bid/ask prices
  const { data: yesBook } = useOrderBook(yesTokenId);
  const { data: noBook } = useOrderBook(noTokenId);

  // Best prices from orderbook: buy = best ask (lowest sell), sell = best bid (highest buy)
  const bestPrices = useMemo(() => {
    const yesBestAsk = yesBook?.asks?.[0] ? Math.round(parseFloat(yesBook.asks[0].price) * 100) : 0;
    const yesBestBid = yesBook?.bids?.[0] ? Math.round(parseFloat(yesBook.bids[0].price) * 100) : 0;
    const noBestAsk = noBook?.asks?.[0] ? Math.round(parseFloat(noBook.asks[0].price) * 100) : 0;
    const noBestBid = noBook?.bids?.[0] ? Math.round(parseFloat(noBook.bids[0].price) * 100) : 0;

    return {
      yesPrice: side === "buy"
        ? (yesBestAsk || initialYesPrice)
        : (yesBestBid || initialYesPrice),
      noPrice: side === "buy"
        ? (noBestAsk || initialNoPrice)
        : (noBestBid || initialNoPrice),
    };
  }, [yesBook, noBook, side, initialYesPrice, initialNoPrice]);

  // Tick size in cents for display (e.g. 0.01 -> 1, 0.1 -> 10)
  const tickCents = round6(tickSize * 100);

  const livePriceCents = midpoint
    ? Math.round(midpoint * 100)
    : outcome === "yes"
      ? initialYesPrice
      : initialNoPrice;

  const order = useMemo(() => {
    if (orderType === "market") {
      // Use best ask (buy) or best bid (sell) — same price shown on the outcome buttons.
      const bestPriceCents = outcome === "yes" ? bestPrices.yesPrice : bestPrices.noPrice;
      const price = bestPriceCents / 100;
      if (side === "sell") {
        // For market sell, amount is shares
        const shares = parseFloat(amount) || 0;
        const dollarAmount = shares > 0 && price > 0 ? round6(shares * price) : 0;
        return { dollarAmount, price, shares };
      }
      // For market buy, amount is dollars
      const dollarAmount = parseFloat(amount) || 0;
      const shares = dollarAmount > 0 && price > 0 ? round6(dollarAmount / price) : 0;
      return { dollarAmount, price, shares };
    }
    const priceCents = parseFloat(limitPrice) || 0;
    const shares = parseFloat(limitShares) || 0;
    const price = round6(priceCents / 100);
    const dollarAmount = round6(shares * price);
    return { dollarAmount, price, shares };
  }, [orderType, amount, limitPrice, limitShares, bestPrices, outcome, side]);

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
    !!currentTokenId &&
    !!magic &&
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

  /** Compute max shares user can buy at current limit price */
  const maxBuyShares = useMemo(() => {
    const price = (parseFloat(limitPrice) || livePriceCents) / 100;
    if (price <= 0) return 0;
    return Math.floor((usdcBalance / price) * 1e6) / 1e6;
  }, [limitPrice, livePriceCents, usdcBalance]);

  /** Compute max shares for market order */
  const maxMarketDollars = useMemo(() => {
    return Math.floor(usdcBalance * 100) / 100;
  }, [usdcBalance]);

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
      {/* Header: Buy/Sell tabs + Order type dropdown */}
      <div className="mb-5 flex items-center justify-between">
        <div className="flex gap-1">
          {(["buy", "sell"] as const).map((s) => (
            <button
              key={s}
              onClick={() => { setSide(s); setAmount(""); }}
              className={cn(
                "pb-1 text-sm font-semibold capitalize transition-colors",
                side === s
                  ? "border-b-2 border-foreground text-foreground"
                  : "text-muted hover:text-foreground",
                s === "buy" ? "mr-3" : "",
              )}
            >
              {s}
            </button>
          ))}
        </div>
        {/* Order type dropdown */}
        <div className="relative">
          <button
            onClick={() => setShowOrderTypeMenu((v) => !v)}
            className="flex items-center gap-1 text-sm text-muted transition-colors hover:text-foreground"
          >
            <span className="capitalize">{orderType}</span>
            <svg className="h-3.5 w-3.5" viewBox="0 0 12 12" fill="none">
              <path d="M3 5l3 3 3-3" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </button>
          {showOrderTypeMenu && (
            <>
              <div className="fixed inset-0 z-10" onClick={() => setShowOrderTypeMenu(false)} />
              <div className="absolute right-0 top-full z-20 mt-1 rounded-lg border border-card-border bg-card py-1 shadow-lg">
                {(["market", "limit"] as const).map((t) => (
                  <button
                    key={t}
                    onClick={() => { setOrderType(t); setShowOrderTypeMenu(false); }}
                    className={cn(
                      "block w-full px-4 py-1.5 text-left text-sm capitalize transition-colors",
                      orderType === t ? "text-foreground" : "text-muted hover:text-foreground",
                    )}
                  >
                    {t}
                  </button>
                ))}
              </div>
            </>
          )}
        </div>
      </div>

      {/* Outcome toggle — shows best ask (buy) or best bid (sell) from orderbook */}
      <div className="mb-4">
        <OutcomeToggle
          selected={outcome}
          onSelect={setOutcome}
          yesPrice={bestPrices.yesPrice}
          noPrice={bestPrices.noPrice}
        />
      </div>

      {/* Balances */}
      {userProfile?.proxyWallet && (
        <div className="mb-4 space-y-1">
          <div className="flex items-center justify-between text-xs">
            <span className="text-muted">USDC.e Balance</span>
            <span className="font-medium text-foreground">${usdcBalance.toFixed(2)}</span>
          </div>
          <div className="flex items-center justify-between text-xs">
            <span className="text-muted">{outcome === "yes" ? "Yes" : "No"} Shares</span>
            <span className="font-medium text-foreground">{currentTokenBalance.toFixed(2)}</span>
          </div>
        </div>
      )}

      {orderType === "limit" ? (
        /* ── Limit order ── */
        <div className="space-y-4">
          {/* Limit Price */}
          <div>
            <div className="mb-2 flex items-center justify-between">
              <label className="text-sm font-medium text-foreground">Limit Price</label>
            </div>
            <div className="flex items-center gap-3">
              <button
                type="button"
                onClick={() => adjustPrice(-1)}
                className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg border border-card-border text-lg font-medium text-muted transition-colors hover:border-foreground/30 hover:text-foreground"
              >
                −
              </button>
              <div className="relative flex-1">
                <input
                  type="number"
                  value={limitPrice}
                  onChange={(e) => setLimitPrice(e.target.value)}
                  onBlur={handleLimitPriceBlur}
                  placeholder={String(livePriceCents)}
                  min={tickCents}
                  max={100 - tickCents}
                  step={tickCents}
                  className="w-full rounded-lg border border-card-border bg-input py-2.5 pl-4 pr-8 text-center text-sm font-medium text-foreground placeholder:text-muted/50 focus:border-brand focus:outline-none"
                />
                <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-sm text-muted">
                  ¢
                </span>
              </div>
              <button
                type="button"
                onClick={() => adjustPrice(1)}
                className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg border border-card-border text-lg font-medium text-muted transition-colors hover:border-foreground/30 hover:text-foreground"
              >
                +
              </button>
            </div>
            {limitPrice && (parseFloat(limitPrice) <= 0 || parseFloat(limitPrice) >= 100) && (
              <p className="mt-1 text-[11px] text-red">
                Price must be between {tickCents}¢ and {round6(100 - tickCents)}¢
              </p>
            )}
          </div>

          {/* Shares */}
          <div>
            <div className="mb-2 flex items-center justify-between">
              <label className="text-sm font-medium text-foreground">Shares</label>
            </div>
            <input
              type="number"
              value={limitShares}
              onChange={(e) => setLimitShares(e.target.value)}
              onBlur={handleLimitSharesBlur}
              placeholder={String(minOrderSize)}
              min={minOrderSize}
              step="1"
              className={cn(
                "w-full rounded-lg border bg-input py-2.5 px-4 text-right text-sm font-medium text-foreground placeholder:text-muted/50 focus:border-brand focus:outline-none",
                limitShares && parseFloat(limitShares) > 0 && parseFloat(limitShares) < minOrderSize
                  ? "border-red/50"
                  : "border-card-border",
              )}
            />
            {limitShares && parseFloat(limitShares) > 0 && parseFloat(limitShares) < minOrderSize && (
              <p className="mt-1 text-[11px] text-red">
                Minimum order size is {minOrderSize} shares
              </p>
            )}
            <div className="mt-2 flex gap-2">
              {side === "buy" ? (
                <>
                  {[0.25, 0.5].map((pct) => (
                    <button
                      key={pct}
                      onClick={() => {
                        const shares = Math.floor(maxBuyShares * pct * 1e6) / 1e6;
                        setLimitShares(shares > 0 ? String(shares) : "");
                      }}
                      className="flex-1 rounded-lg border border-card-border py-1.5 text-xs font-medium text-muted transition-colors hover:border-foreground/30 hover:text-foreground"
                    >
                      {pct * 100}%
                    </button>
                  ))}
                  <button
                    onClick={() => {
                      const shares = maxBuyShares;
                      setLimitShares(shares > 0 ? String(shares) : "");
                    }}
                    className="flex-1 rounded-lg border border-card-border py-1.5 text-xs font-medium text-muted transition-colors hover:border-foreground/30 hover:text-foreground"
                  >
                    Max
                  </button>
                </>
              ) : (
                <>
                  {[0.25, 0.5].map((pct) => (
                    <button
                      key={pct}
                      onClick={() => {
                        const shares = Math.floor(currentTokenBalance * pct * 1e6) / 1e6;
                        setLimitShares(shares > 0 ? String(shares) : "");
                      }}
                      className="flex-1 rounded-lg border border-card-border py-1.5 text-xs font-medium text-muted transition-colors hover:border-foreground/30 hover:text-foreground"
                    >
                      {pct * 100}%
                    </button>
                  ))}
                  <button
                    onClick={() => {
                      const shares = Math.floor(currentTokenBalance * 1e6) / 1e6;
                      setLimitShares(shares > 0 ? String(shares) : "");
                    }}
                    className="flex-1 rounded-lg border border-card-border py-1.5 text-xs font-medium text-muted transition-colors hover:border-foreground/30 hover:text-foreground"
                  >
                    Max
                  </button>
                </>
              )}
            </div>
          </div>
        </div>
      ) : (
        /* ── Market order ── */
        <div>
          <div className="mb-2 flex items-center justify-between">
            <label className="text-sm font-medium text-foreground">
              {side === "sell" ? "Shares" : "Amount"}
            </label>
          </div>
          <div className="relative">
            {side === "buy" && (
              <span className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-sm text-muted">
                $
              </span>
            )}
            <input
              type="number"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              placeholder="0.00"
              min="0"
              step="0.01"
              className={cn(
                "w-full rounded-lg border border-card-border bg-input py-2.5 pr-4 text-right text-sm font-medium text-foreground placeholder:text-muted/50 focus:border-brand focus:outline-none",
                side === "buy" ? "pl-8" : "pl-4",
              )}
            />
          </div>
          <div className="mt-2 flex gap-2">
            {side === "buy" ? (
              <>
                {[10, 25, 50, 100].map((v) => (
                  <button
                    key={v}
                    onClick={() => setAmount(String(v))}
                    className="flex-1 rounded-lg border border-card-border py-1.5 text-xs font-medium text-muted transition-colors hover:border-foreground/30 hover:text-foreground"
                  >
                    ${v}
                  </button>
                ))}
                {usdcBalance > 0 && (
                  <button
                    onClick={() => setAmount(String(maxMarketDollars))}
                    className="flex-1 rounded-lg border border-card-border py-1.5 text-xs font-medium text-muted transition-colors hover:border-foreground/30 hover:text-foreground"
                  >
                    Max
                  </button>
                )}
              </>
            ) : (
              <>
                {[0.25, 0.5].map((pct) => (
                  <button
                    key={pct}
                    onClick={() => {
                      const shares = Math.floor(currentTokenBalance * pct * 1e6) / 1e6;
                      setAmount(shares > 0 ? String(shares) : "");
                    }}
                    className="flex-1 rounded-lg border border-card-border py-1.5 text-xs font-medium text-muted transition-colors hover:border-foreground/30 hover:text-foreground"
                  >
                    {pct * 100}%
                  </button>
                ))}
                <button
                  onClick={() => {
                    const shares = Math.floor(currentTokenBalance * 1e6) / 1e6;
                    setAmount(shares > 0 ? String(shares) : "");
                  }}
                  className="flex-1 rounded-lg border border-card-border py-1.5 text-xs font-medium text-muted transition-colors hover:border-foreground/30 hover:text-foreground"
                >
                  Max
                </button>
              </>
            )}
          </div>
        </div>
      )}

      {/* Summary: "You'll receive" */}
      {order.dollarAmount > 0 && (
        <div className="mt-5">
          <div className="flex items-center justify-between text-sm">
            <span className="text-foreground">You&apos;ll receive</span>
            <span className="font-semibold text-green">
              {side === "buy"
                ? `$${order.shares.toFixed(2)}`
                : `$${order.dollarAmount.toFixed(2)}`}
            </span>
          </div>
        </div>
      )}

      {/* Balance warning */}
      {exceedsBalance && (
        <p className="mt-3 text-center text-xs font-medium text-red">
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
          "mt-5 w-full rounded-xl py-3.5 text-sm font-semibold text-white transition-all active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-40",
          side === "buy"
            ? "bg-green hover:bg-green/90"
            : "bg-red hover:bg-red/90"
        )}
      >
        {submitting ? "Submitting…" : "Trade"}
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
