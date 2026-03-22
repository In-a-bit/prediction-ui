/**
 * Withdraw USDC from the proxy wallet via PROXY meta-tx (same flow as allowance / Polymarket).
 * Encodes proxy([{ to: USDC, data: transfer(recipient, amount) }]) with metadata "funwithdraw".
 */
import { isAddress, parseUnits, type Hex } from "viem";
import type { MagicLike } from "./allowance-relayer";
import {
  getProxyConfig,
  createProxyStructHash,
  encodeProxyCall,
  encodeProxyTransactionData,
  encodeTransferCalldata,
} from "./relayer-proxy";
import { getRelayPayload, submitTransaction } from "./relayer-api-client";

const DEFAULT_GAS_LIMIT = BigInt(300_000);

function getCollateralAddress(): string {
  const c =
    typeof process !== "undefined"
      ? process.env.NEXT_PUBLIC_COLLATERAL_ADDRESS
      : undefined;
  if (!c) {
    throw new Error(
      "fundwithdraw requires NEXT_PUBLIC_COLLATERAL_ADDRESS in env",
    );
  }
  return c;
}

/**
 * Submit a single USDC transfer from the proxy wallet through the factory proxy() call.
 * Matches Polymarket calldata shape (selector 0x34ee9791 + encoded proxy tuple).
 */
export async function submitFundWithdraw(
  magic: MagicLike,
  relayerApiUrl: string | undefined,
  proxyWallet: string,
  recipient: string,
  amountDecimal: string,
): Promise<{ transactionID: string; state: string }> {
  if (!proxyWallet) {
    throw new Error("Proxy wallet is required (UserProfile.proxyWallet)");
  }

  const recipientTrimmed = recipient.trim();
  if (!isAddress(recipientTrimmed)) {
    throw new Error("Invalid recipient address");
  }

  const amountTrimmed = amountDecimal.trim();
  if (!amountTrimmed) {
    throw new Error("Amount is required");
  }

  let amountWei: bigint;
  try {
    amountWei = parseUnits(amountTrimmed, 6);
  } catch {
    throw new Error("Invalid amount (use a USDC amount, e.g. 1.5)");
  }
  if (amountWei <= 0n) {
    throw new Error("Amount must be greater than zero");
  }

  const info = await magic.user.getInfo();
  const from = info.wallets?.ethereum?.publicAddress ?? null;
  if (!from) throw new Error("Magic: no wallet address");

  const config = getProxyConfig();
  const collateral = getCollateralAddress();

  const relay = await getRelayPayload(from, relayerApiUrl);
  const gasPrice = "0";
  const gasLimitStr = String(DEFAULT_GAS_LIMIT);
  const relayerFee = "0";

  const transferData = encodeTransferCalldata(recipientTrimmed, amountWei);
  const callTransfer = encodeProxyCall(collateral as Hex, transferData);
  const data = encodeProxyTransactionData([callTransfer]);

  const structHash = createProxyStructHash(
    from,
    config.ProxyFactory,
    data,
    relayerFee,
    gasPrice,
    gasLimitStr,
    relay.nonce,
    config.RelayHub,
    relay.address,
  );

  const signature = await magic.rpcProvider.request({
    method: "personal_sign",
    params: [structHash, from],
  });

  const body = {
    from,
    to: config.ProxyFactory,
    proxyWallet,
    data,
    nonce: relay.nonce,
    signature,
    signatureParams: {
      gasPrice,
      gasLimit: gasLimitStr,
      relayerFee,
      relayHub: config.RelayHub,
      relay: relay.address,
    },
    type: "PROXY" as const,
    metadata: "funwithdraw",
  };

  return submitTransaction(body, relayerApiUrl);
}
