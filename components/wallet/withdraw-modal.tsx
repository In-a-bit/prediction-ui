"use client";

import { useCallback, useEffect, useMemo, useState, useSyncExternalStore } from "react";
import { createPortal } from "react-dom";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { isAddress, parseUnits } from "viem";
import { useTrading } from "@/components/providers/trading-provider";
import { useMarketSurface } from "@/components/providers/market-surface-provider";
import {
  createBridgeWithdrawal,
  listWithdrawalRoutes,
  routeNetworkName,
  type BridgeAsset,
} from "@/lib/bridge-api";
import { formatTradeBalanceUsd } from "@/lib/utils";
import { BalanceBreakdown } from "@/components/wallet/balance-breakdown";
import { DestinationSelect } from "@/components/wallet/destination-select";
import {
  invalidateAllCollateralBalances,
  useCollateralBalance,
} from "@/lib/hooks/use-collateral-balance";
import { useOfframp, type OfframpStage } from "@/lib/hooks/use-ramp";

/** Progress text for the multi-step cash-out handoff. */
const OFFRAMP_STATUS: Partial<Record<OfframpStage, string>> = {
  starting: "Opening Paybis…",
  "awaiting-confirmation": "Confirm the cash-out in the Paybis window…",
  "loading-details": "Fetching payout details…",
  sending: "Sending funds to Paybis…",
  reopened: "Funds sent. Finish up in the Paybis window.",
};

/** Our own network: USDC here is sent directly, without Mesh. */
const DIRECT_NETWORK = "eip155:137";
const DIRECT_KEY = "direct";

type Destination = {
  key: string;
  label: string;
  networkName: string;
  /** Absent for the direct USDC transfer. */
  mesh?: BridgeAsset;
  /** Smallest USDC amount Mesh accepts for this route. */
  minAmount?: string;
};

function destinationKey(a: BridgeAsset): string {
  return `${a.network}|${a.asset}`;
}

/** EVM chains take a 0x address; anything else is left to Mesh to validate. */
function recipientValid(dest: Destination | undefined, value: string): boolean {
  const v = value.trim();
  if (!v) return false;
  if (!dest?.mesh || dest.mesh.network.startsWith("eip155:")) return isAddress(v);
  return true;
}

type WithdrawModalProps = {
  open: boolean;
  onClose: () => void;
  /** Optional extra callback after successful withdraw (balance is refreshed globally via React Query). */
  onSuccess?: () => void;
};

export function WithdrawModal({
  open,
  onClose,
  onSuccess,
}: WithdrawModalProps) {
  const queryClient = useQueryClient();
  const { balanceNormalized } = useCollateralBalance();
  const { dpmSdk, userProfile, walletAddress } = useTrading();
  const { serviceBase } = useMarketSurface();
  const proxyWallet = userProfile?.proxyWallet ?? walletAddress ?? "";
  const [recipient, setRecipient] = useState("");
  const [amount, setAmount] = useState("");
  const [destKey, setDestKey] = useState(DIRECT_KEY);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  // TEMP(mesh-test): remove after Mesh testing.
  const [testPayIn, setTestPayIn] = useState<{ address: string; amount: string } | null>(null);
  const offramp = useOfframp();
  const isClient = useSyncExternalStore(
    () => () => {},
    () => true,
    () => false,
  );

  const routesQuery = useQuery({
    queryKey: ["bridge-withdrawal-routes"],
    queryFn: () => listWithdrawalRoutes(dpmSdk!, serviceBase("gamma")),
    enabled: open && Boolean(dpmSdk),
    staleTime: 5 * 60_000,
  });

  const destinations = useMemo<Destination[]>(() => {
    const out: Destination[] = [
      { key: DIRECT_KEY, label: "USDC · Polygon (direct)", networkName: "Polygon" },
    ];
    const seen = new Set<string>();
    for (const r of routesQuery.data ?? []) {
      const d = r.destination;
      const key = destinationKey(d);
      // Our own asset is already offered directly, without Mesh fees.
      if (d.network.toLowerCase() === DIRECT_NETWORK && d.asset.toUpperCase() === "USDC") continue;
      if (seen.has(key)) continue;
      seen.add(key);
      const network = routeNetworkName(r);
      out.push({
        key,
        label: `${d.asset} · ${network}`,
        networkName: network,
        mesh: d,
        minAmount: r.min_amount,
      });
    }
    return out;
  }, [routesQuery.data]);

  const dest = destinations.find((d) => d.key === destKey) ?? destinations[0];

  const destinationOptions = useMemo(
    () =>
      destinations.map((d) => ({
        key: d.key,
        label: d.label,
        keywords: `${d.mesh?.asset ?? "USDC"} ${d.networkName} ${d.mesh?.network ?? DIRECT_NETWORK}`,
      })),
    [destinations],
  );

  const handleClose = useCallback(() => {
    setRecipient("");
    setAmount("");
    setDestKey(DIRECT_KEY);
    setError(null);
    setTestPayIn(null);
    setSubmitting(false);
    offramp.reset();
    onClose();
  }, [onClose, offramp]);

  useEffect(() => {
    if (open) setError(null);
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") handleClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, handleClose]);

  const recipientOk = recipientValid(dest, recipient);
  let amountWei: bigint | null = null;
  let amountExceedsBalance = false;
  let amountUnderMinimum = false;
  try {
    const t = amount.trim();
    if (t) {
      amountWei = parseUnits(t, 6);
      if (amountWei <= 0n) amountWei = null;
      if (balanceNormalized != null && balanceNormalized !== "" && amountWei != null) {
        const bal = parseUnits(balanceNormalized.trim(), 6);
        if (amountWei > bal) amountExceedsBalance = true;
      }
      if (amountWei != null && dest?.minAmount) {
        amountUnderMinimum = amountWei < parseUnits(dest.minAmount, 6);
      }
    }
  } catch {
    amountWei = null;
  }

  const canSubmit =
    Boolean(dpmSdk) &&
    Boolean(proxyWallet) &&
    recipientOk &&
    amountWei != null &&
    !amountExceedsBalance &&
    !amountUnderMinimum &&
    !submitting;

  function handleMax() {
    if (balanceNormalized == null || balanceNormalized === "") return;
    setAmount(balanceNormalized);
  }

  async function handleWithdraw() {
    if (!canSubmit || !dpmSdk) return;
    setError(null);
    setSubmitting(true);
    try {
      if (dest?.mesh) {
        const bridge = await createBridgeWithdrawal(
          dpmSdk,
          {
            amount: amount.trim(),
            recipientAddress: recipient.trim(),
            destination: dest.mesh,
          },
          serviceBase("gamma"),
        );
        // TEMP(mesh-test): send the USDC from MetaMask instead of the proxy.
        if (process.env.NEXT_PUBLIC_MESH_TEST_SKIP_SEND === "1") {
          setTestPayIn({ address: bridge.deposit_address, amount: bridge.amount });
          return;
        }
        await dpmSdk.submitFundWithdraw(bridge.deposit_address, bridge.amount);
      } else {
        console.log("[WithdrawModal] submitFundWithdraw: begin");
        await dpmSdk.submitFundWithdraw(recipient.trim(), amount.trim());
      }
      await invalidateAllCollateralBalances(queryClient);
      onSuccess?.();
      handleClose();
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setSubmitting(false);
    }
  }

  if (!open || !isClient) return null;

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
        aria-labelledby="withdraw-modal-title"
        className="fixed left-1/2 top-1/2 z-[101] w-[calc(100%-2rem)] max-w-md -translate-x-1/2 -translate-y-1/2 rounded-2xl border border-card-border bg-card p-6 shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mb-4 flex items-start justify-between gap-4">
          <h2
            id="withdraw-modal-title"
            className="text-lg font-semibold text-foreground"
          >
            Withdraw
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
          <button
            type="button"
            onClick={() => void offramp.start()}
            disabled={!offramp.ready || offramp.busy || !proxyWallet}
            className="flex w-full items-center justify-between gap-3 rounded-xl border border-card-border bg-input px-4 py-3 text-left transition-colors hover:border-brand hover:bg-card-hover disabled:cursor-not-allowed disabled:opacity-40"
          >
            <span>
              <span className="block text-sm font-semibold text-foreground">
                Cash out to card or bank
              </span>
              <span className="mt-0.5 block text-xs text-muted">
                Sell USDC and get paid in your local currency
              </span>
            </span>
            <svg className="h-4 w-4 shrink-0 text-muted" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
            </svg>
          </button>

          {OFFRAMP_STATUS[offramp.stage] && (
            <p className="mt-2 rounded-xl border border-card-border bg-input px-3 py-2 text-xs text-muted">
              {OFFRAMP_STATUS[offramp.stage]}
            </p>
          )}

          {offramp.error && (
            <p className="mt-2 rounded-xl border border-red/30 bg-red-dim px-3 py-2 text-xs text-red">
              {offramp.error}
            </p>
          )}
        </div>

        <div className="mb-4 flex items-center gap-3">
          <span className="h-px flex-1 bg-card-border" />
          <span className="text-xs font-medium text-muted">
            or withdraw crypto
          </span>
          <span className="h-px flex-1 bg-card-border" />
        </div>

        <div className="space-y-4">
          <div>
            <label
              htmlFor="withdraw-destination"
              className="mb-1.5 block text-xs font-medium text-muted"
            >
              Receive
            </label>
            <DestinationSelect
              id="withdraw-destination"
              options={destinationOptions}
              value={dest?.key ?? DIRECT_KEY}
              onChange={setDestKey}
              disabled={submitting}
            />
            {routesQuery.isLoading && (
              <p className="mt-1.5 text-xs text-muted">Loading destinations…</p>
            )}
            {routesQuery.isError && (
              <p className="mt-1.5 text-xs text-muted">
                Other destinations are unavailable right now.
              </p>
            )}
            {dest?.minAmount && (
              <p className="mt-1.5 text-xs text-muted">
                Minimum {dest.minAmount} USDC. Converted and sent by Mesh.
              </p>
            )}
          </div>

          <div>
            <label
              htmlFor="withdraw-recipient"
              className="mb-1.5 block text-xs font-medium text-muted"
            >
              Recipient address
            </label>
            <input
              id="withdraw-recipient"
              type="text"
              value={recipient}
              onChange={(e) => setRecipient(e.target.value)}
              placeholder={dest?.mesh && !dest.mesh.network.startsWith("eip155:") ? `${dest.networkName} address` : "0x…"}
              autoComplete="off"
              disabled={submitting}
              className="w-full rounded-xl border border-card-border bg-input px-3 py-2.5 font-mono text-sm text-foreground placeholder:text-muted/50 focus:border-brand focus:outline-none"
            />
          </div>

          <div>
            <div className="mb-1.5 flex items-center justify-between gap-2">
              <label
                htmlFor="withdraw-amount"
                className="text-xs font-medium text-muted"
              >
                Amount
              </label>
              <span className="text-xs text-muted">
                Balance{" "}
                <BalanceBreakdown>
                  <span className="cursor-help border-b border-dashed border-muted/40 font-medium text-foreground">
                    {formatTradeBalanceUsd(balanceNormalized ?? undefined)}
                  </span>
                </BalanceBreakdown>
              </span>
            </div>
            <div className="relative flex rounded-xl border border-card-border bg-input focus-within:border-brand">
              <input
                id="withdraw-amount"
                type="text"
                inputMode="decimal"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                placeholder="0"
                className="min-w-0 flex-1 bg-transparent px-3 py-2.5 pr-16 text-sm text-foreground placeholder:text-muted/50 focus:outline-none"
              />
              <button
                type="button"
                onClick={handleMax}
                disabled={!balanceNormalized}
                className="absolute right-2 top-1/2 -translate-y-1/2 rounded-lg bg-brand/15 px-2.5 py-1 text-xs font-semibold text-brand transition-colors hover:bg-brand/25 disabled:cursor-not-allowed disabled:opacity-40"
              >
                Max
              </button>
            </div>
          </div>

          {amountExceedsBalance && (
            <p className="text-xs text-red">
              Amount exceeds available balance.
            </p>
          )}

          {amountUnderMinimum && dest?.minAmount && (
            <p className="text-xs text-red">
              Minimum withdrawal to {dest.label} is {dest.minAmount} USDC.
            </p>
          )}

          {testPayIn && (
            <p className="break-all rounded-xl border border-brand/30 px-3 py-2 text-xs">
              TEMP(mesh-test): send {testPayIn.amount} USDC on Polygon from MetaMask to{" "}
              <span className="font-mono">{testPayIn.address}</span>
            </p>
          )}

          {error && (
            <p className="rounded-xl border border-red/30 bg-red-dim px-3 py-2 text-xs text-red">
              {error}
            </p>
          )}

          <button
            type="button"
            disabled={!canSubmit}
            onClick={() => void handleWithdraw()}
            className="w-full rounded-xl bg-brand py-3 text-sm font-bold text-white transition-colors hover:bg-brand-hover disabled:cursor-not-allowed disabled:opacity-40"
          >
            {submitting ? (
              <span className="inline-flex items-center justify-center gap-2">
                <span className="h-4 w-4 animate-spin rounded-full border-2 border-white/40 border-t-white" />
                Submitting…
              </span>
            ) : (
              "Withdraw"
            )}
          </button>
        </div>
      </div>
    </>,
    document.body,
  );
}
