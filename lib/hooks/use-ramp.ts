"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { parseUnits } from "viem";

import { useTrading } from "@/components/providers/trading-provider";
import { useMarketSurface } from "@/components/providers/market-surface-provider";
import { usePrivyPersonalSign } from "@/components/providers/privy-sign-provider";
import {
  createRampRequest,
  getOfframpDetails,
  type OfframpDetailsResponse,
} from "@/lib/ramp-api";
import {
  closePaybisWidget,
  loadPaybisWidget,
  onPaybisEvent,
} from "@/lib/paybis-widget";
import {
  invalidateAllCollateralBalances,
  useCollateralBalance,
} from "@/lib/hooks/use-collateral-balance";
import {
  exceedsNativeBalance,
  getNativeBalanceNormalized,
  isNativeRampAsset,
  submitNativeProxyWithdraw,
} from "@/lib/native-proxy-withdraw";

/** USDC decimals; the collateral balance is quoted in whole USDC. */
const COLLATERAL_DECIMALS = 6;

function errorMessage(err: unknown): string {
  if (err instanceof Error) return err.message;
  return typeof err === "string" ? err : "Something went wrong";
}

/** Client-facing deposit outcome from Paybis widget events. */
export type OnrampStage =
  | "idle"
  | "opening"
  | "awaiting"
  | "completed"
  | "failed"
  | "cancelled";

type OnrampOutcome = {
  stage: Exclude<OnrampStage, "opening" | "awaiting">;
  error?: string;
};

function subscribeOnrampOutcome(
  widget: Awaited<ReturnType<typeof loadPaybisWidget>>,
  requestId: string,
  onOutcome: (outcome: OnrampOutcome) => void,
): () => void {
  let settled = false;
  const finish = (outcome: OnrampOutcome) => {
    if (settled) return;
    settled = true;
    console.log(
      "[useOnramp.subscribeOnrampOutcome] requestId=%s stage=%s",
      requestId,
      outcome.stage,
    );
    onOutcome(outcome);
  };
  const unsubs = [
    onPaybisEvent(widget, "oncompleted", () => finish({ stage: "completed" })),
    onPaybisEvent(widget, "onrejected", () =>
      finish({
        stage: "failed",
        error: "Deposit was rejected. Please try again.",
      }),
    ),
    onPaybisEvent(widget, "onerror", () =>
      finish({
        stage: "failed",
        error: "Deposit failed. Please try again.",
      }),
    ),
    onPaybisEvent(widget, "oncancelled", () =>
      finish({
        stage: "cancelled",
        error: "Deposit was cancelled. Please try again.",
      }),
    ),
    // Closing the overlay often fires only onclosed (no oncancelled).
    onPaybisEvent(widget, "onclosed", () => finish({ stage: "idle" })),
  ];
  return () => {
    for (const unsub of unsubs) unsub();
  };
}

/**
 * Buy-crypto flow: ask the backend for a request id, then hand the user to the
 * Paybis widget. Funds land in the proxy wallet on their own; the webhook
 * listener records the outcome. Widget events drive thank-you / try-again UI.
 */
export function useOnramp() {
  const { dpmSdk } = useTrading();
  const { serviceBase } = useMarketSurface();
  const queryClient = useQueryClient();
  const [stage, setStage] = useState<OnrampStage>("idle");
  const [error, setError] = useState<string | null>(null);
  const unsubscribeRef = useRef<(() => void) | null>(null);

  const clearListeners = useCallback(() => {
    unsubscribeRef.current?.();
    unsubscribeRef.current = null;
  }, []);

  const applyOutcome = useCallback(
    (outcome: OnrampOutcome) => {
      clearListeners();
      setStage(outcome.stage);
      setError(outcome.error ?? null);
      if (outcome.stage === "completed") {
        void invalidateAllCollateralBalances(queryClient);
      }
    },
    [clearListeners, queryClient],
  );

  const start = useCallback(async () => {
    if (!dpmSdk || stage === "opening") return;
    setError(null);
    setStage("opening");
    clearListeners();
    try {
      const requestId = await createRampRequest(
        dpmSdk,
        "onramp",
        serviceBase("gamma"),
      );
      const widget = await loadPaybisWidget();
      unsubscribeRef.current = subscribeOnrampOutcome(
        widget,
        requestId,
        applyOutcome,
      );
      setStage("awaiting");
      widget.open({ requestId });
    } catch (err) {
      setError(errorMessage(err));
      setStage("failed");
    }
  }, [dpmSdk, stage, serviceBase, clearListeners, applyOutcome]);

  const reset = useCallback(() => {
    clearListeners();
    setStage("idle");
    setError(null);
  }, [clearListeners]);

  useEffect(
    () => () => {
      clearListeners();
    },
    [clearListeners],
  );

  return {
    start,
    reset,
    stage,
    busy: stage === "opening" || stage === "awaiting",
    error,
    clearError: () => setError(null),
    ready: Boolean(dpmSdk),
  };
}

/** Where the off-ramp handoff currently is, for user-facing status text. */
export type OfframpStage =
  | "idle"
  | "starting"
  | "awaiting-confirmation"
  | "loading-details"
  | "sending"
  | "reopened"
  | "failed";

/**
 * Sell-crypto flow. The proxy wallet is a contract wallet the user cannot spend
 * from directly, so Paybis runs in `partner_controlled_with_sdk_event` mode and
 * we perform the transfer ourselves in the middle of their flow:
 *
 *   create request -> open widget -> user confirms -> close widget ->
 *   read payment details -> send crypto -> re-open widget -> fiat payout
 *
 * Sandbox (POL-AMOY) uses a UI-local Privy-signed native withdraw so the public
 * SDK stays free of test-only paths. Production (USDC) uses submitFundWithdraw.
 *
 * Paybis explicitly forbids re-opening the widget when the transfer fails, so a
 * failure ends the flow and surfaces an error instead.
 */
export function useOfframp() {
  const { dpmSdk, walletAddress } = useTrading();
  const { serviceBase } = useMarketSurface();
  const { balanceNormalized } = useCollateralBalance();
  const queryClient = useQueryClient();
  const personalSign = usePrivyPersonalSign();

  const [stage, setStage] = useState<OfframpStage>("idle");
  const [error, setError] = useState<string | null>(null);
  const [details, setDetails] = useState<OfframpDetailsResponse | null>(null);

  // Read inside the event handler, which is registered once and must not close
  // over a stale balance.
  const balanceRef = useRef<string | null>(balanceNormalized);
  balanceRef.current = balanceNormalized;
  const proxyRef = useRef<string | null>(walletAddress);
  proxyRef.current = walletAddress;

  const stageRef = useRef<OfframpStage>("idle");
  stageRef.current = stage;
  // closePaybisWidget() during the handoff fires onclosed — ignore that close.
  const ignoreWidgetCloseRef = useRef(false);

  const unsubscribeRef = useRef<(() => void) | null>(null);
  const clearListeners = useCallback(() => {
    unsubscribeRef.current?.();
    unsubscribeRef.current = null;
  }, []);

  useEffect(
    () => () => {
      clearListeners();
    },
    [clearListeners],
  );

  const exceedsUsdcBalance = useCallback((amount: string): boolean => {
    const balance = balanceRef.current;
    if (!balance) return true;
    try {
      return (
        parseUnits(amount.trim(), COLLATERAL_DECIMALS) >
        parseUnits(balance.trim(), COLLATERAL_DECIMALS)
      );
    } catch {
      return true;
    }
  }, []);

  const sendCrypto = useCallback(
    async (payment: OfframpDetailsResponse) => {
      if (!dpmSdk) throw new Error("Sign in to continue");
      const native = isNativeRampAsset(payment.asset, payment.currency_code);
      if (native) {
        if (!personalSign) {
          throw new Error("Native cash-out requires a Privy session");
        }
        const proxy = dpmSdk.getProxyWallet() ?? proxyRef.current;
        if (!proxy) throw new Error("No proxy wallet");
        const nativeBal = await getNativeBalanceNormalized(proxy);
        if (exceedsNativeBalance(payment.amount, nativeBal)) {
          throw new Error(
            `Not enough POL balance: the cash-out needs ${payment.amount} ${payment.currency_code}.`,
          );
        }
        await submitNativeProxyWithdraw({
          dpmSdk,
          personalSign,
          relayerBase: serviceBase("relayer"),
          recipient: payment.destination_address,
          amountDecimal: payment.amount,
        });
        return;
      }

      if (exceedsUsdcBalance(payment.amount)) {
        throw new Error(
          `Not enough balance: the cash-out needs ${payment.amount} ${payment.currency_code}.`,
        );
      }
      await dpmSdk.submitFundWithdraw(payment.destination_address, payment.amount);
      await invalidateAllCollateralBalances(queryClient);
    },
    [dpmSdk, personalSign, serviceBase, exceedsUsdcBalance, queryClient],
  );

  const dismissIfUserClosed = useCallback(() => {
    if (ignoreWidgetCloseRef.current) return;
    const current = stageRef.current;
    // Only the first widget open (and the optional re-open) should reset on
    // dismiss. Programmatic close during the handoff is ignored above.
    if (current !== "awaiting-confirmation" && current !== "reopened") return;
    console.log(
      "[useOfframp.dismissIfUserClosed] widget closed at stage=%s",
      current,
    );
    clearListeners();
    setStage("idle");
    setError(null);
    setDetails(null);
  }, [clearListeners]);

  const handlePaymentInitiated = useCallback(
    async (requestId: string) => {
      if (!dpmSdk) return;
      try {
        ignoreWidgetCloseRef.current = true;
        clearListeners();
        closePaybisWidget();

        setStage("loading-details");
        const payment = await getOfframpDetails(
          dpmSdk,
          requestId,
          serviceBase("gamma"),
        );
        setDetails(payment);

        setStage("sending");
        await sendCrypto(payment);

        // Only now may the widget be re-opened, so Paybis can watch for the
        // deposit and release the fiat payout.
        const widget = await loadPaybisWidget();
        ignoreWidgetCloseRef.current = false;
        unsubscribeRef.current = onPaybisEvent(
          widget,
          "onclosed",
          dismissIfUserClosed,
        );
        setStage("reopened");
        widget.open({ requestId });
      } catch (err) {
        ignoreWidgetCloseRef.current = false;
        setError(errorMessage(err));
        setStage("failed");
      }
    },
    [dpmSdk, serviceBase, sendCrypto, clearListeners, dismissIfUserClosed],
  );

  const start = useCallback(async () => {
    if (!dpmSdk || stage === "starting") return;
    setError(null);
    setDetails(null);
    setStage("starting");
    ignoreWidgetCloseRef.current = false;
    try {
      const requestId = await createRampRequest(
        dpmSdk,
        "offramp",
        serviceBase("gamma"),
      );

      const widget = await loadPaybisWidget();
      clearListeners();
      const unsubs = [
        onPaybisEvent(widget, "onpaymentinitiated", () => {
          void handlePaymentInitiated(requestId);
        }),
        onPaybisEvent(widget, "onclosed", dismissIfUserClosed),
        onPaybisEvent(widget, "oncancelled", dismissIfUserClosed),
      ];
      unsubscribeRef.current = () => {
        for (const unsub of unsubs) unsub();
      };

      setStage("awaiting-confirmation");
      widget.open({ requestId });
    } catch (err) {
      setError(errorMessage(err));
      setStage("failed");
    }
  }, [dpmSdk, stage, serviceBase, handlePaymentInitiated, clearListeners, dismissIfUserClosed]);

  const reset = useCallback(() => {
    ignoreWidgetCloseRef.current = false;
    clearListeners();
    setStage("idle");
    setError(null);
    setDetails(null);
  }, [clearListeners]);

  return {
    start,
    reset,
    stage,
    error,
    details,
    busy: stage !== "idle" && stage !== "failed",
    ready: Boolean(dpmSdk),
  };
}
