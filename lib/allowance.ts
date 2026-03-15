import type { UserProfile } from "@/components/providers/magic-provider";

const COMPLETED = "Completed";

/**
 * If either usdce_allowance_status or ctf_allowance_status is not "Completed",
 * logs that we need to sign and signs an empty message with the user's Magic wallet.
 * Accepts any Magic-like instance (rpcProvider.request + user.getInfo).
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

  console.log("[Allowance] We need to sign — usdce:", profile.usdceAllowanceStatus, "ctf:", profile.ctfAllowanceStatus);

  const info = await magic.user.getInfo();
  const signerAddress = info.wallets?.ethereum?.publicAddress ?? undefined;
  if (!signerAddress) {
    console.warn("[Allowance] No signer address from Magic, skipping sign");
    return;
  }

  try {
    const signature = await magic.rpcProvider.request({ 
      method: "personal_sign",
      params: ["0x", signerAddress],
    });
    console.log("[Allowance] Signed empty message:", signature?.slice(0, 20) + "…");
  } catch (err) {
    console.error("[Allowance] Sign failed:", err); 
  }
}
