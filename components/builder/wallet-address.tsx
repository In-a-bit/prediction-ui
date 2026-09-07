"use client";

import { useState } from "react";

import { shortAddress } from "@/lib/builder/money";

/**
 * A proxy wallet address: shortened, monospaced, and copyable.
 *
 * Copyable because a shortened address is for recognising, not for using — anyone who wants to
 * paste it into a block explorer needs all 42 characters, and re-typing them from a screenshot is
 * how the wrong wallet gets funded. The full value is also the `title`, so it survives a copy
 * button that a sandboxed iframe or an insecure origin will not allow.
 */
export function WalletAddress({
  address,
  pending = "not yet provisioned",
}: {
  address: string | null;
  /** What to say when there is no address, which is the ordinary pre-provisioning state. */
  pending?: string;
}) {
  const [copied, setCopied] = useState(false);

  if (!address) {
    return (
      <span
        className="text-muted"
        title="A DPM wallet costs two on-chain transactions, so it is minted on the customer's first visit to prediction markets rather than at sign-up."
      >
        {pending}
      </span>
    );
  }

  async function copy() {
    try {
      await navigator.clipboard.writeText(address as string);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1200);
    } catch {
      // Clipboard access is denied on insecure origins and in some sandboxes. The full address is
      // in the title either way, so there is nothing to recover from and nothing to report.
    }
  }

  return (
    <button
      type="button"
      onClick={() => void copy()}
      title={address}
      aria-label={`Copy wallet address ${address}`}
      className="group inline-flex items-center gap-1.5 font-mono text-xs text-fg hover:text-brand"
    >
      {shortAddress(address)}
      <span className="text-[10px] text-muted group-hover:text-brand">
        {copied ? "copied" : "copy"}
      </span>
    </button>
  );
}
