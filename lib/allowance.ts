import type { UserProfile } from "@/components/providers/magic-provider";
import { submitUsdcCtfAllowance } from "@/lib/allowance-relayer";

const RELAYER_API_URL =
  typeof process === "undefined"
    ? undefined
    : process.env.NEXT_PUBLIC_RELAYER_API_URL;

/**
 * If either usdce_allowance_status or ctf_allowance_status is not "Completed",
 * submits a PROXY approval (USDC approve CTF) via the relayer-api: signs with
 * Magic and sends the request to our relayer (builder-relayer-client–compatible flow).
 * If relayer is not configured, skips.
 */
export async function checkAllowanceAndSignIfNeeded(
  magic: {
    rpcProvider: { request: (args: { method: string; params: unknown[] }) => Promise<string> };
    user: { getInfo: () => Promise<{ wallets?: { ethereum?: { publicAddress?: string | null } } }> };
  },
  profile: UserProfile,
): Promise<void> {
  const needUsdce = profile.usdceAllowanceStatus === null;
  const needCtf = profile.ctfAllowanceStatus === null;
  if (!needUsdce && !needCtf) return;

  if (!RELAYER_API_URL) {
    console.warn("[Allowance] NEXT_PUBLIC_RELAYER_API_URL not set, skipping PROXY approval");
    return;
  }

  console.log("[Allowance] Submitting USDC→CTF approval via relayer (PROXY)…");

  try {
    const result = await submitUsdcCtfAllowance(magic, RELAYER_API_URL);
    console.log("[Allowance] Submitted:", result.transactionID, result.state);
  } catch (err) {
    console.error("[Allowance] Submit failed:", err);
  }
}
