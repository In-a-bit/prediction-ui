import type { DpmSdk } from "dpm-sdk";
import type { UserProfile } from "@/components/providers/magic-provider";

/**
 * Submits a PROXY approval (USDC approve CTF) via the relayer-api when
 * allowance_status is empty or "FAILED". Skips if status is set and not failed
 * (e.g. in progress or already finalized).
 * If the SDK is not ready, skips.
 */
export async function checkAllowanceAndSignIfNeeded(
  dpmSdk: DpmSdk | null,
  profile: UserProfile,
): Promise<void> {
  if (!dpmSdk) {
    console.warn("[Allowance] DPM SDK not ready, skipping PROXY approval");
    return;
  }
  if (profile.allowanceStatus && profile.allowanceStatus !== "FAILED") return;

  if (!profile.proxyWallet) {
    console.warn("[Allowance] No proxy wallet in profile, skipping PROXY approval");
    return;
  }

  console.log("[Allowance] Submitting USDC→CTF approval via relayer (PROXY)…");

  try {
    const result = await dpmSdk.submitUsdcCtfAllowance(profile.proxyWallet);
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
  dpmSdk: DpmSdk | null,
  profile: UserProfile,
): Promise<{ transactionID: string; state: string }> {
  if (!dpmSdk) {
    throw new Error("DPM SDK not ready (relayer contract-info unavailable)");
  }
  if (!profile.proxyWallet) {
    throw new Error("No proxy wallet on profile");
  }
  return dpmSdk.submitUsdcCtfAllowance(profile.proxyWallet);
}
