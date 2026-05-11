import type { UserProfile } from "@/components/providers/magic-provider";
import { submitUsdcCtfAllowance } from "@/lib/allowance-relayer";
import { PG } from "@/lib/prediction-go";

const RELAYER_PROXY_BASE = PG.relayer;

/**
 * Submits a PROXY approval (USDC approve CTF) via the relayer-api when
 * allowance_status is empty or "FAILED". Skips if status is set and not failed
 * (e.g. in progress or already finalized).
 * If relayer is not configured, skips.
 */
export async function checkAllowanceAndSignIfNeeded(
  magic: {
    rpcProvider: { request: (args: { method: string; params: unknown[] }) => Promise<string> };
    user: { getInfo: () => Promise<{ wallets?: { ethereum?: { publicAddress?: string | null } } }> };
  },
  profile: UserProfile,
): Promise<void> {
  if (profile.allowanceStatus && profile.allowanceStatus !== "FAILED") return;

  if (!profile.proxyWallet) {
    console.warn("[Allowance] No proxy wallet in profile, skipping PROXY approval");
    return;
  }

  console.log("[Allowance] Submitting USDC→CTF approval via relayer (PROXY)…");

  try {
    const result = await submitUsdcCtfAllowance(
      magic,
      RELAYER_PROXY_BASE,
      profile.proxyWallet,
    );
    console.log("[Allowance] Submitted:", result.transactionID, result.state);
  } catch (err) {
    console.error("[Allowance] Submit failed:", err);
  }
}

/**
 * Submits the PROXY USDC + CTF allowance tx regardless of `allowanceStatus`.
 * Use when the backend says "done" but on-chain state is wrong.
 */
export async function submitAllowanceRegardlessOfStatus(
  magic: {
    rpcProvider: { request: (args: { method: string; params: unknown[] }) => Promise<string> };
    user: { getInfo: () => Promise<{ wallets?: { ethereum?: { publicAddress?: string | null } } }> };
  },
  profile: UserProfile,
): Promise<{ transactionID: string; state: string }> {
  if (!profile.proxyWallet) {
    throw new Error("No proxy wallet on profile");
  }
  return submitUsdcCtfAllowance(magic, RELAYER_PROXY_BASE, profile.proxyWallet);
}
