"use client";

import { useCallback, useEffect, useState, useSyncExternalStore } from "react";
import { createPortal } from "react-dom";
import { isAddress } from "viem";
import { cn } from "@/lib/utils";

type RedeemRecipientModalProps = {
  open: boolean;
  onClose: () => void;
  /** Market name, shown so the operator can tell which row they are redeeming. */
  marketLabel: string;
  /** Called with the trimmed address, or undefined when the field is left empty. */
  onConfirm: (recipient: string | undefined) => void;
  submitting: boolean;
  error: string | null;
};

export function RedeemRecipientModal({
  open,
  onClose,
  marketLabel,
  onConfirm,
  submitting,
  error,
}: RedeemRecipientModalProps) {
  const [recipient, setRecipient] = useState("");
  const isClient = useSyncExternalStore(
    () => () => {},
    () => true,
    () => false,
  );

  const handleClose = useCallback(() => {
    setRecipient("");
    onClose();
  }, [onClose]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") handleClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, handleClose]);

  const trimmed = recipient.trim();
  const recipientValid = trimmed === "" || isAddress(trimmed);
  const canSubmit = recipientValid && !submitting;

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
        aria-labelledby="redeem-recipient-modal-title"
        className="fixed left-1/2 top-1/2 z-[101] w-[calc(100%-2rem)] max-w-md -translate-x-1/2 -translate-y-1/2 rounded-2xl border border-card-border bg-card p-6 shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mb-4 flex items-start justify-between gap-4">
          <h2
            id="redeem-recipient-modal-title"
            className="text-lg font-semibold text-foreground"
          >
            Redeem
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

        <p className="mb-4 text-sm text-muted">{marketLabel}</p>

        <div className="space-y-4">
          <div>
            <label
              htmlFor="redeem-recipient"
              className="mb-1.5 block text-xs font-medium text-muted"
            >
              Recipient <span className="font-normal">(optional)</span>
            </label>
            <input
              id="redeem-recipient"
              type="text"
              value={recipient}
              onChange={(e) => setRecipient(e.target.value)}
              placeholder="0x… — leave empty to keep the payout"
              autoComplete="off"
              spellCheck={false}
              aria-invalid={!recipientValid}
              aria-describedby="redeem-recipient-help"
              className={cn(
                "w-full rounded-xl border bg-input px-3 py-2.5 font-mono text-sm text-foreground placeholder:text-muted/50 focus:border-brand focus:outline-none",
                recipientValid ? "border-card-border" : "border-red/50",
              )}
            />
            <p id="redeem-recipient-help" className="mt-1.5 text-xs text-muted">
              {recipientValid ? (
                <>
                  Redeems from this wallet and forwards the payout to another address
                  in the same transaction.
                </>
              ) : (
                <span className="text-red">
                  Not a valid address. Check for a missing character or altered
                  capitalisation — addresses carry a checksum.
                </span>
              )}
            </p>
          </div>

          {error && (
            <p className="rounded-xl border border-red/30 bg-red-dim px-3 py-2 text-xs text-red">
              {error}
            </p>
          )}

          <div className="flex gap-2">
            <button
              type="button"
              onClick={handleClose}
              className="flex-1 rounded-xl border border-card-border py-3 text-sm font-medium text-foreground transition-colors hover:bg-card-hover"
            >
              Cancel
            </button>
            <button
              type="button"
              disabled={!canSubmit}
              onClick={() => onConfirm(trimmed === "" ? undefined : trimmed)}
              className="flex-1 rounded-xl bg-green py-3 text-sm font-bold text-white transition-colors hover:bg-green/80 disabled:cursor-not-allowed disabled:opacity-40"
            >
              {submitting ? "Redeeming…" : "Redeem"}
            </button>
          </div>
        </div>
      </div>
    </>,
    document.body,
  );
}
