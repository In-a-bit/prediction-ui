"use client";

import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";

import { useLpConnectApi } from "@/components/lp/lp-demo-providers";
import { useTrading } from "@/components/providers/trading-provider";
import { truncateAddress } from "@/lib/lp/format";
import { cn } from "@/lib/utils";

type PanelPos = { top: number; left: number };

export function LpConnectButton() {
  const { apiKeyTruncated, eoaAddress, disconnect, walletAddress } =
    useTrading();
  const { connect } = useLpConnectApi();
  const [open, setOpen] = useState(false);
  const [switching, setSwitching] = useState(false);
  const [apiKey, setApiKey] = useState("");
  const [eoaKey, setEoaKey] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [pos, setPos] = useState<PanelPos | null>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);

  const connected = Boolean(walletAddress && apiKeyTruncated);
  const showForm = !connected || switching;

  function close() {
    setOpen(false);
    setSwitching(false);
    setError(null);
  }

  function updatePosition() {
    const btn = buttonRef.current;
    if (!btn) return;
    const rect = btn.getBoundingClientRect();
    const panelWidth = Math.min(448, window.innerWidth - 32);
    let left = rect.left + rect.width / 2 - panelWidth / 2;
    left = Math.max(16, Math.min(left, window.innerWidth - panelWidth - 16));
    setPos({ top: rect.bottom + 8, left });
  }

  useLayoutEffect(() => {
    if (!open) {
      setPos(null);
      return;
    }
    updatePosition();
  }, [open, connected, switching]);

  useEffect(() => {
    if (!open) return;
    const onReposition = () => updatePosition();
    window.addEventListener("resize", onReposition);
    window.addEventListener("scroll", onReposition, true);
    return () => {
      window.removeEventListener("resize", onReposition);
      window.removeEventListener("scroll", onReposition, true);
    };
  }, [open]);

  async function handleConnect() {
    setBusy(true);
    setError(null);
    try {
      await connect(apiKey, eoaKey);
      setApiKey("");
      setEoaKey("");
      setSwitching(false);
      setOpen(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setBusy(false);
    }
  }

  async function handleDisconnect() {
    setBusy(true);
    try {
      await disconnect();
      setSwitching(false);
      setOpen(false);
    } finally {
      setBusy(false);
    }
  }

  const panel =
    open && pos && typeof document !== "undefined"
      ? createPortal(
          <>
            <button
              type="button"
              aria-label="Close"
              className="fixed inset-0 z-[100] cursor-default bg-black/40"
              onClick={close}
            />
            <div
              ref={panelRef}
              style={{ top: pos.top, left: pos.left, width: Math.min(448, typeof window !== "undefined" ? window.innerWidth - 32 : 448) }}
              className="fixed z-[101] rounded-2xl border border-card-border bg-card p-6 shadow-xl"
            >
              <div className="mb-4 flex items-center justify-between">
                <h2 className="text-base font-semibold text-foreground">
                  {connected ? "LP session" : "Connect LP + EOA"}
                </h2>
                <button
                  type="button"
                  onClick={close}
                  className="text-muted hover:text-foreground"
                >
                  ✕
                </button>
              </div>

              {connected && !switching ? (
                <div className="space-y-3 text-sm">
                  <p className="text-muted">
                    API key:{" "}
                    <span className="font-medium text-foreground">
                      {apiKeyTruncated}
                    </span>
                  </p>
                  <p className="text-muted">
                    EOA:{" "}
                    <span className="font-mono text-foreground">{eoaAddress}</span>
                  </p>
                  <p className="text-muted">
                    Proxy:{" "}
                    <span className="font-mono text-foreground">
                      {walletAddress}
                    </span>
                  </p>
                  <div className="flex gap-2 pt-2">
                    <button
                      type="button"
                      disabled={busy}
                      onClick={() => setSwitching(true)}
                      className="flex-1 rounded-xl border border-card-border py-2.5 font-medium hover:bg-card-hover"
                    >
                      Switch
                    </button>
                    <button
                      type="button"
                      disabled={busy}
                      onClick={() => void handleDisconnect()}
                      className="flex-1 rounded-xl bg-red/15 py-2.5 font-medium text-red hover:bg-red/25"
                    >
                      Disconnect
                    </button>
                  </div>
                </div>
              ) : null}

              {showForm ? (
                <div
                  className={cn(
                    "space-y-3",
                    connected && "mt-4 border-t border-card-border pt-4",
                  )}
                >
                  <p className="text-xs text-muted">
                    Secrets stay on the server. Address is derived from the
                    private key.
                  </p>
                  <label className="block text-xs font-medium text-muted">
                    LP API key
                    <input
                      type="password"
                      value={apiKey}
                      onChange={(e) => setApiKey(e.target.value)}
                      className="mt-1 w-full rounded-xl border border-card-border bg-input px-3 py-2 text-sm text-foreground"
                      placeholder="lp_…"
                      autoComplete="off"
                    />
                  </label>
                  <label className="block text-xs font-medium text-muted">
                    EOA private key
                    <input
                      type="password"
                      value={eoaKey}
                      onChange={(e) => setEoaKey(e.target.value)}
                      className="mt-1 w-full rounded-xl border border-card-border bg-input px-3 py-2 text-sm text-foreground"
                      placeholder="0x…"
                      autoComplete="off"
                    />
                  </label>
                  {error ? <p className="text-xs text-red">{error}</p> : null}
                  <button
                    type="button"
                    disabled={busy || !apiKey.trim() || !eoaKey.trim()}
                    onClick={() => void handleConnect()}
                    className="w-full rounded-xl bg-brand py-2.5 text-sm font-semibold text-white hover:bg-brand-hover disabled:opacity-40"
                  >
                    {busy
                      ? "Connecting…"
                      : connected
                        ? "Switch session"
                        : "Connect"}
                  </button>
                </div>
              ) : null}
            </div>
          </>,
          document.body,
        )
      : null;

  return (
    <>
      <button
        ref={buttonRef}
        type="button"
        onClick={() => setOpen(true)}
        className={cn(
          "rounded-xl border px-3 py-2 text-sm font-medium transition-colors",
          connected
            ? "border-card-border bg-card text-foreground hover:bg-card-hover"
            : "border-brand/40 bg-brand text-white hover:bg-brand-hover",
        )}
      >
        {connected
          ? `${apiKeyTruncated} · ${truncateAddress(eoaAddress ?? "")}`
          : "Connect Liquidity Provider"}
      </button>
      {panel}
    </>
  );
}
