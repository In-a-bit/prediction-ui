/**
 * Redeem resolved CTF positions via PROXY meta-tx.
 * Encodes proxy([{ to: CTF, data: redeemPositions(...) }]) with metadata "redeem".
 */
import type { Hex } from "viem";
import type { MagicLike } from "./allowance-relayer";
import {
  getProxyConfig,
  createProxyStructHash,
  encodeRedeemPositionsCalldata,
  encodeProxyCall,
  encodeProxyTransactionData,
} from "./relayer-proxy";
import { getRelayPayload, submitTransaction } from "./relayer-api-client";

const DEFAULT_GAS_LIMIT = BigInt(300_000);

function getCtfAddress(): string {
  const c =
    typeof process !== "undefined"
      ? process.env.NEXT_PUBLIC_CTF_ADDRESS
      : undefined;
  if (!c) {
    throw new Error("redeem requires NEXT_PUBLIC_CTF_ADDRESS in env");
  }
  return c;
}

function getCollateralAddress(): string {
  const c =
    typeof process !== "undefined"
      ? process.env.NEXT_PUBLIC_COLLATERAL_ADDRESS
      : undefined;
  if (!c) {
    throw new Error("redeem requires NEXT_PUBLIC_COLLATERAL_ADDRESS in env");
  }
  return c;
}

export async function submitRedeemPositions(
  magic: MagicLike,
  relayerApiUrl: string | undefined,
  proxyWallet: string,
  conditionId: string,
): Promise<{ transactionID: string; state: string }> {
  if (!proxyWallet) {
    throw new Error("Proxy wallet is required");
  }
  if (!conditionId) {
    throw new Error("conditionId is required");
  }

  const info = await magic.user.getInfo();
  const from = info.wallets?.ethereum?.publicAddress ?? null;
  if (!from) throw new Error("Magic: no wallet address");

  const config = getProxyConfig();
  const ctfAddress = getCtfAddress();
  const collateral = getCollateralAddress();

  const relay = await getRelayPayload(from, relayerApiUrl);
  const gasPrice = "0";
  const gasLimitStr = String(DEFAULT_GAS_LIMIT);
  const relayerFee = "0";

  const redeemData = encodeRedeemPositionsCalldata(collateral, conditionId);
  const callRedeem = encodeProxyCall(ctfAddress as Hex, redeemData);
  const data = encodeProxyTransactionData([callRedeem]);

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
    metadata: "redeem",
  };

  return submitTransaction(body, relayerApiUrl);
}
