import type { DpmSdk } from "@inabit-com/dpm-sdk";
import type { UserProfile } from "@/components/providers/wallet-provider";

/**
 * Submits a PROXY approval (USDC approve CTF) via the relayer-api when the
 * backend's `allowance_status` says it's missing/failed. Skips if the status
 * indicates the approval is already in progress or finalized.
 *
 * `proxyWallet` comes from the active session — the SDK throws
 * {@link AuthRequiredError} if you call this before login.
 */
export async function checkAllowanceAndSignIfNeeded(
  dpmSdk: DpmSdk | null,
  profile: UserProfile,
): Promise<void> {
  if (!dpmSdk) {
    console.warn("[allowance.checkAllowanceAndSignIfNeeded] SDK not ready, skipping");
    return;
  }
  if (profile.allowanceStatus && profile.allowanceStatus !== "FAILED") {
    return;
  }

  console.log("[allowance.checkAllowanceAndSignIfNeeded] submitting", {
    status: profile.allowanceStatus,
  });
  try {
    const result = await dpmSdk.submitUsdcCtfAllowance();
    console.log("[allowance.checkAllowanceAndSignIfNeeded] submitted", {
      transactionID: result.transactionID,
      state: result.state,
    });
  } catch (err) {
    console.error("[allowance.checkAllowanceAndSignIfNeeded] failed:", err);
  }
}

/**
 * Submits the PROXY USDC + CTF allowance tx regardless of `allowanceStatus`.
 * Use when the backend says "done" but on-chain state is wrong.
 *
 * Throws if the SDK isn't ready or no session is active.
 */
export async function submitAllowanceRegardlessOfStatus(
  dpmSdk: DpmSdk | null,
): Promise<{ transactionID: string; state: string }> {
  if (!dpmSdk) {
    throw new Error("DPM SDK not ready (relayer contract-info unavailable)");
  }
  console.log("[allowance.submitAllowanceRegardlessOfStatus] begin");
  const result = await dpmSdk.submitUsdcCtfAllowance();
  console.log("[allowance.submitAllowanceRegardlessOfStatus] submitted", {
    transactionID: result.transactionID,
    state: result.state,
  });
  return result;
}
