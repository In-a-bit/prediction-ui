/**
 * Proxy wallet / RelayHub helpers for building PROXY transactions
 * compatible with the relayer-api (same as builder-relayer-client flow).
 */
import {
  concat,
  encodeFunctionData,
  type Hex,
  keccak256,
  toHex,
  getCreate2Address,
  encodePacked,
  maxUint256,
} from "viem";

// Same as builder-relayer-client (Polymarket proxy factory)
const PROXY_INIT_CODE_HASH: Hex =
  "0xd21df8dc65880a8606f09fe0ce3df9b8869287ab0b058be05aa9e8af6330a00b";

const ERC20_TRANSFER_ABI = [
  {
    inputs: [
      { name: "to", type: "address" },
      { name: "amount", type: "uint256" },
    ],
    name: "transfer",
    outputs: [{ name: "", type: "bool" }],
    stateMutability: "nonpayable",
    type: "function",
  },
] as const;

const ERC20_APPROVE_ABI = [
  {
    inputs: [
      { name: "_spender", type: "address" },
      { name: "_value", type: "uint256" },
    ],
    name: "approve",
    outputs: [{ name: "", type: "bool" }],
    stateMutability: "nonpayable",
    type: "function",
  },
] as const;

const ERC1155_SET_APPROVAL_FOR_ALL_ABI = [
  {
    inputs: [
      { name: "_operator", type: "address" },
      { name: "_approved", type: "bool" },
    ],
    name: "setApprovalForAll",
    outputs: [],
    stateMutability: "nonpayable",
    type: "function",
  },
] as const;

const CTF_REDEEM_POSITIONS_ABI = [
  {
    inputs: [
      { name: "collateralToken", type: "address" },
      { name: "parentCollectionId", type: "bytes32" },
      { name: "conditionId", type: "bytes32" },
      { name: "indexSets", type: "uint256[]" },
    ],
    name: "redeemPositions",
    outputs: [],
    stateMutability: "nonpayable",
    type: "function",
  },
] as const;

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

export type ProxyContractConfig = {
  RelayHub: string;
  ProxyFactory: string;
};

/** RelayHub and ProxyFactory – from env only */
export function getProxyConfig(): ProxyContractConfig {
  const hub = typeof process
    ? process.env.NEXT_PUBLIC_RELAY_HUB_ADDRESS
    : undefined;
  const factory = typeof process
    ? process.env.NEXT_PUBLIC_PROXY_WALLET_FACTORY_ADDRESS
    : undefined;
  if (hub && factory) return { RelayHub: hub, ProxyFactory: factory };
  throw new Error(
    "Relayer proxy requires NEXT_PUBLIC_RELAY_HUB_ADDRESS and NEXT_PUBLIC_PROXY_WALLET_FACTORY_ADDRESS in env",
  );
}

/** Struct hash for RelayHub / proxy meta-tx (same as builder-relayer-client). */
export function createProxyStructHash(
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
  const relayHubPrefix = toHex("rlx:");
  const encodedFrom = from as Hex;
  const encodedTo = to as Hex;
  const encodedData = data as Hex;
  const encodedTxFee = toHex(BigInt(txFee), { size: 32 });
  const encodedGasPrice = toHex(BigInt(gasPrice), { size: 32 });
  const encodedGasLimit = toHex(BigInt(gasLimit), { size: 32 });
  const encodedNonce = toHex(BigInt(nonce), { size: 32 });
  const encodedRelayHub = relayHub as Hex;
  const encodedRelay = relay as Hex;
  const dataToHash = concat([
    relayHubPrefix,
    encodedFrom,
    encodedTo,
    encodedData,
    encodedTxFee,
    encodedGasPrice,
    encodedGasLimit,
    encodedNonce,
    encodedRelayHub,
    encodedRelay,
  ]);
  return keccak256(dataToHash);
}

/** ERC20 transfer(to, amount) calldata. Target token is the "to" of the proxy call (USDC). */
export function encodeTransferCalldata(
  toAddress: string,
  amount: bigint,
): Hex {
  return encodeFunctionData({
    abi: ERC20_TRANSFER_ABI,
    functionName: "transfer",
    args: [toAddress as Hex, amount],
  });
}

/** ERC20 approve(spender, amount) calldata. Target token is the "to" of the proxy call. */
export function encodeApproveCalldata(
  spenderAddress: string,
  amount: bigint = maxUint256,
): Hex {
  return encodeFunctionData({
    abi: ERC20_APPROVE_ABI,
    functionName: "approve",
    args: [spenderAddress as Hex, amount],
  });
}

/** ERC1155 setApprovalForAll(operator, approved) calldata. Target CTF is the "to" of the proxy call. */
export function encodeSetApprovalForAllCalldata(
  operatorAddress: string,
  approved: boolean = true,
): Hex {
  return encodeFunctionData({
    abi: ERC1155_SET_APPROVAL_FOR_ALL_ABI,
    functionName: "setApprovalForAll",
    args: [operatorAddress as Hex, approved],
  });
}

/** CTF redeemPositions(collateralToken, parentCollectionId, conditionId, indexSets) calldata. */
export function encodeRedeemPositionsCalldata(
  collateralToken: string,
  conditionId: string,
  indexSets: bigint[] = [1n, 2n],
): Hex {
  const parentCollectionId =
    "0x0000000000000000000000000000000000000000000000000000000000000000" as Hex;
  return encodeFunctionData({
    abi: CTF_REDEEM_POSITIONS_ABI,
    functionName: "redeemPositions",
    args: [
      collateralToken as Hex,
      parentCollectionId,
      conditionId as Hex,
      indexSets,
    ],
  });
}

/** Single call for proxy(calls): Call type, to, value, data */
export function encodeProxyCall(
  to: string,
  data: Hex,
  value: bigint = BigInt(0),
  typeCode: number = 1,
): { typeCode: number; to: `0x${string}`; value: bigint; data: Hex } {
  return {
    typeCode,
    to: to as `0x${string}`,
    value,
    data,
  };
}

/** proxy(calls) calldata for the proxy factory */
export function encodeProxyTransactionData(
  calls: { typeCode: number; to: `0x${string}`; value: bigint; data: Hex }[],
): Hex {
  return encodeFunctionData({
    abi: PROXY_FACTORY_ABI,
    functionName: "proxy",
    args: [calls],
  });
}
