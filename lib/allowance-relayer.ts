/**
 * Submit USDC (collateral) approval for CTF via Magic wallet + relayer-api PROXY flow.
 * Builds the same approval as builder-relayer-client and sends to our relayer-api.
 */
import {
  getProxyConfig,
  createProxyStructHash,
  encodeApproveCalldata,
  encodeSetApprovalForAllCalldata,
  encodeProxyCall,
  encodeProxyTransactionData,
} from "./relayer-proxy";
import { getRelayPayload, submitTransaction } from "./relayer-api-client";

const DEFAULT_GAS_LIMIT = BigInt(300_000);

export type MagicLike = {
  rpcProvider: {
    request: (args: { method: string; params: unknown[] }) => Promise<string>;
  };
  user: {
    getInfo: () => Promise<{
      wallets?: { ethereum?: { publicAddress?: string | null } };
    }>;
  };
};

/** Collateral (USDC), CTF (ERC-1155), and CTF Exchange (operator) – from env only */
function getAllowanceAddresses(): {
  collateral: string;
  ctf: string;
  ctfExchange: string;
} {
  const collateral = typeof process
    ? process.env.NEXT_PUBLIC_COLLATERAL_ADDRESS
    : undefined;
  const ctf = typeof process ? process.env.NEXT_PUBLIC_CTF_ADDRESS : undefined;
  const ctfExchange = typeof process
    ? process.env.NEXT_PUBLIC_CTF_EXCHANGE_ADDRESS
    : undefined;
  if (collateral && ctf && ctfExchange) return { collateral, ctf, ctfExchange };
  throw new Error(
    "Relayer allowance requires NEXT_PUBLIC_COLLATERAL_ADDRESS, NEXT_PUBLIC_CTF_ADDRESS, and NEXT_PUBLIC_CTF_EXCHANGE_ADDRESS in env",
  );
}

/**
 * Build and submit both allowances via one PROXY tx: (1) ERC-20 USDC approve CTF,
 * (2) ERC-1155 CTF setApprovalForAll(exchange). Uses Magic signing and relayer-api.
 * proxyWallet must come from the user profile (getUser() / UserProfile.proxyWallet).
 */
export async function submitUsdcCtfAllowance(
  magic: MagicLike,
  relayerApiUrl: string | undefined,
  proxyWallet: string,
): Promise<{ transactionID: string; state: string }> {
  if (!proxyWallet) throw new Error("Proxy wallet is required (use UserProfile.proxyWallet from getUser())");

  const info = await magic.user.getInfo();
  const from = info.wallets?.ethereum?.publicAddress ?? null;
  if (!from) throw new Error("Magic: no wallet address");

  const config = getProxyConfig();
  const { collateral, ctf, ctfExchange } = getAllowanceAddresses();

  const relay = await getRelayPayload(from, relayerApiUrl);
  const gasPrice = "0";
  const gasLimitStr = String(DEFAULT_GAS_LIMIT);
  const relayerFee = "0";

  // 1) ERC-20: USDC (collateral) approve CTF as spender
  const approveData = encodeApproveCalldata(ctf);
  const callApprove = encodeProxyCall(collateral as `0x${string}`, approveData);
  // 2) ERC-1155: CTF setApprovalForAll(exchange) so exchange can move outcome tokens
  const approvalForAllData = encodeSetApprovalForAllCalldata(ctfExchange);
  const callApprovalForAll = encodeProxyCall(
    ctf as `0x${string}`,
    approvalForAllData,
  );

  const proxyFactory = config.ProxyFactory;
  const data = encodeProxyTransactionData([callApprove, callApprovalForAll]);

  const structHash = createProxyStructHash(
    from,
    proxyFactory,
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
    to: proxyFactory,
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
    metadata: "approve USDC + setApprovalForAll CTF exchange",
  };

  return submitTransaction(body);
}
