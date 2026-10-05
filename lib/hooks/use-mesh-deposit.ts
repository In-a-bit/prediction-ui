"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import type { Link } from "@meshconnect/web-link-sdk";

import { useTrading } from "@/components/providers/trading-provider";
import { useMarketSurface } from "@/components/providers/market-surface-provider";
import { createBridgeDeposit } from "@/lib/bridge-api";
import { invalidateAllCollateralBalances } from "@/lib/hooks/use-collateral-balance";

export type MeshDepositStage =
  | "idle"
  | "opening"
  | "awaiting"
  | "completed"
  | "failed";

/**
 * Crypto deposit via Mesh Link: the backend mints a link token whose only
 * destination is the user's proxy wallet, and the widget does the rest.
 */
export function useMeshDeposit() {
  const { dpmSdk } = useTrading();
  const { serviceBase } = useMarketSurface();
  const queryClient = useQueryClient();
  const [stage, setStage] = useState<MeshDepositStage>("idle");
  const [error, setError] = useState<string | null>(null);
  const linkRef = useRef<Link | null>(null);
  // onExit also fires after onTransferFinished; it must not undo "completed".
  const finishedRef = useRef(false);

  const close = useCallback(() => {
    linkRef.current?.closeLink();
    linkRef.current = null;
  }, []);

  const start = useCallback(async () => {
    if (!dpmSdk || stage === "opening" || stage === "awaiting") return;
    setError(null);
    setStage("opening");
    finishedRef.current = false;
    try {
      // The SDK touches `window` on load, so it must stay out of the SSR bundle.
      const [linkToken, { createLink }] = await Promise.all([
        createBridgeDeposit(dpmSdk, serviceBase("gamma")),
        import("@meshconnect/web-link-sdk"),
      ]);
      const link = createLink({
        renderType: "overlay",
        theme: "system",
        onIntegrationConnected: () => {},
        onTransferFinished: () => {
          finishedRef.current = true;
          setStage("completed");
          void invalidateAllCollateralBalances(queryClient);
        },
        onExit: (exitError) => {
          linkRef.current = null;
          if (finishedRef.current) return;
          setStage(exitError ? "failed" : "idle");
          setError(exitError ? `Deposit failed: ${exitError}` : null);
        },
      });
      linkRef.current = link;
      setStage("awaiting");
      link.openLink(linkToken);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
      setStage("failed");
    }
  }, [dpmSdk, stage, serviceBase, queryClient]);

  const reset = useCallback(() => {
    close();
    finishedRef.current = false;
    setStage("idle");
    setError(null);
  }, [close]);

  useEffect(() => close, [close]);

  return {
    start,
    reset,
    stage,
    busy: stage === "opening" || stage === "awaiting",
    error,
    ready: Boolean(dpmSdk),
  };
}
