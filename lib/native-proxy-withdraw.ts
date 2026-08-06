/**
 * Sandbox-only helper: Privy-signed native-coin withdraw from the proxy wallet.
 *
 * Kept in prediction-ui (not dpm-sdk) so the public SDK stays free of POL/test
 * paths. Production off-ramp uses submitFundWithdraw (USDC); this mirrors that
 * flow with empty calldata + value instead of ERC-20 transfer.
 */

import {
  concat,
  createPublicClient,
  encodeFunctionData,
  http,
  isAddress,
  keccak256,
  parseUnits,
  toHex,
  type Hex,
} from "viem";
import type { DpmSdk } from "@inabit-com/dpm-sdk";

const DEFAULT_GAS_LIMIT = 300_000;
const NATIVE_DECIMALS = 18;

const PROXY_FACTORY_ABI = [
  {
    inputs: [
      {
        components: [
          { name: "typeCode", type: "uint8" },
          { name: "to", type: "address" },
          { name: "value", type: "uint256" },
          { name: "data", type: "bytes" },
        ],
        name: "calls",
        type: "tuple[]",
      },
    ],
    name: "proxy",
    outputs: [{ name: "returnValues", type: "bytes[]" }],
    stateMutability: "payable",
    type: "function",
  },
] as const;

export type PersonalSignFn = (
  message: string,
  address: string,
) => Promise<string>;

function createProxyStructHash(
  from: string,
  to: string,
  data: string,
  txFee: string,
  gasPrice: string,
  gasLimit: string,
  nonce: string,
  relayHub: string,
  relay: string,
): Hex {
  return keccak256(
    concat([
      toHex("rlx:"),
      from as Hex,
      to as Hex,
      data as Hex,
      toHex(BigInt(txFee), { size: 32 }),
      toHex(BigInt(gasPrice), { size: 32 }),
      toHex(BigInt(gasLimit), { size: 32 }),
      toHex(BigInt(nonce), { size: 32 }),
      relayHub as Hex,
      relay as Hex,
    ]),
  );
}

async function authHeaders(dpmSdk: DpmSdk): Promise<Record<string, string>> {
  const auth = await dpmSdk.auth.resolveRequestAuth();
  if (auth.mode === "jwt") {
    return { Authorization: `Bearer ${auth.accessToken}` };
  }
  if (auth.mode === "lp") {
    return { "X-LP-Api-Key": auth.apiKey, "X-LP-Address": auth.address };
  }
  throw new Error("Sign in to continue");
}

async function fetchRelayPayload(
  dpmSdk: DpmSdk,
  from: string,
  relayerBase: string,
): Promise<{ address: string; nonce: string }> {
  const base = relayerBase.replace(/\/$/, "");
  const qs = new URLSearchParams({ address: from, type: "PROXY" });
  const res = await fetch(`${base}/relay-payload?${qs}`, {
    headers: await authHeaders(dpmSdk),
  });
  if (!res.ok) {
    throw new Error(`relay-payload failed (${res.status}): ${await res.text()}`);
  }
  return res.json() as Promise<{ address: string; nonce: string }>;
}

/** True for native-coin Paybis assets (sandbox POL-AMOY); false for USDC. */
export function isNativeRampAsset(asset: string, currencyCode: string): boolean {
  const id = `${asset} ${currencyCode}`.toUpperCase();
  if (id.includes("USDC") || id.includes("USDT")) return false;
  return (
    id.includes("POL") ||
    id.includes("MATIC") ||
    id.includes("ETH") ||
    id.includes("BNB")
  );
}

/** On-chain native balance of the proxy wallet, as a decimal string. */
export async function getNativeBalanceNormalized(
  proxyWallet: string,
): Promise<string | null> {
  const rpc = process.env.NEXT_PUBLIC_RPC_URL?.trim();
  if (!rpc || !isAddress(proxyWallet)) return null;
  const client = createPublicClient({ transport: http(rpc) });
  const wei = await client.getBalance({ address: proxyWallet as Hex });
  // format as decimal without trailing zeros noise
  const whole = wei / 10n ** BigInt(NATIVE_DECIMALS);
  const frac = wei % 10n ** BigInt(NATIVE_DECIMALS);
  if (frac === 0n) return whole.toString();
  const fracStr = frac.toString().padStart(NATIVE_DECIMALS, "0").replace(/0+$/, "");
  return `${whole}.${fracStr}`;
}

export function exceedsNativeBalance(
  amount: string,
  balanceNormalized: string | null,
): boolean {
  if (!balanceNormalized) return true;
  try {
    return (
      parseUnits(amount.trim(), NATIVE_DECIMALS) >
      parseUnits(balanceNormalized.trim(), NATIVE_DECIMALS)
    );
  } catch {
    return true;
  }
}

/**
 * Builds, Privy-signs, and submits a PROXY meta-tx that sends native coin from
 * the user's proxy wallet to `recipient`.
 */
export async function submitNativeProxyWithdraw(params: {
  dpmSdk: DpmSdk;
  personalSign: PersonalSignFn;
  relayerBase: string;
  recipient: string;
  amountDecimal: string;
}): Promise<{ transactionID: string; state: string }> {
  const recipient = params.recipient.trim();
  if (!isAddress(recipient)) {
    throw new Error("Invalid recipient address");
  }
  const amountWei = parseUnits(params.amountDecimal.trim(), NATIVE_DECIMALS);
  if (amountWei <= 0n) {
    throw new Error("Amount must be greater than zero");
  }

  const proxyWallet = params.dpmSdk.getProxyWallet();
  if (!proxyWallet) {
    throw new Error("No proxy wallet on session");
  }

  const { proxyFactory, relayHub } = params.dpmSdk.contractInfo;
  const from = await params.dpmSdk.getEoaAddress();
  const relay = await fetchRelayPayload(params.dpmSdk, from, params.relayerBase);

  const data = encodeFunctionData({
    abi: PROXY_FACTORY_ABI,
    functionName: "proxy",
    args: [
      [
        {
          typeCode: 1,
          to: recipient as Hex,
          value: amountWei,
          data: "0x" as Hex,
        },
      ],
    ],
  });

  const gasPrice = "0";
  const gasLimit = String(DEFAULT_GAS_LIMIT);
  const relayerFee = "0";
  const structHash = createProxyStructHash(
    from,
    proxyFactory,
    data,
    relayerFee,
    gasPrice,
    gasLimit,
    relay.nonce,
    relayHub,
    relay.address,
  );
  const signature = await params.personalSign(structHash, from);

  const result = await params.dpmSdk.submitRelayerTransaction({
    from,
    to: proxyFactory,
    proxyWallet,
    data,
    nonce: relay.nonce,
    signature,
    signatureParams: {
      gasPrice,
      gasLimit,
      relayerFee,
      relayHub,
      relay: relay.address,
    },
    type: "PROXY",
    metadata: "nativewithdraw",
  });
  return { transactionID: result.transactionID, state: result.state };
}
