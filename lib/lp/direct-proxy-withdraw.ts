import {
  createPublicClient,
  createWalletClient,
  encodeFunctionData,
  http,
  parseUnits,
  type Hex,
} from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { polygon, polygonAmoy } from "viem/chains";

const FACTORY_ABI = [
  {
    name: "proxy",
    type: "function",
    stateMutability: "payable",
    inputs: [
      {
        name: "calls",
        type: "tuple[]",
        components: [
          { name: "typeCode", type: "uint8" },
          { name: "to", type: "address" },
          { name: "value", type: "uint256" },
          { name: "data", type: "bytes" },
        ],
      },
    ],
    outputs: [{ name: "returnValues", type: "bytes[]" }],
  },
] as const;

const ERC1155_ABI = [
  {
    name: "safeTransferFrom",
    type: "function",
    stateMutability: "nonpayable",
    inputs: [
      { name: "from", type: "address" },
      { name: "to", type: "address" },
      { name: "id", type: "uint256" },
      { name: "value", type: "uint256" },
      { name: "data", type: "bytes" },
    ],
    outputs: [],
  },
] as const;

function chainFromEnv() {
  const id = Number(process.env.NEXT_PUBLIC_CHAIN_ID ?? "80002");
  return id === 137 ? polygon : polygonAmoy;
}

function requireEnv(name: string): Hex {
  const v = process.env[name]?.trim();
  if (!v) throw new Error(`${name} is not set`);
  return v as Hex;
}

function normalizePrivateKey(raw: string): Hex {
  const trimmed = raw.trim();
  return (trimmed.startsWith("0x") ? trimmed : `0x${trimmed}`) as Hex;
}

/** EOA → ProxyWalletFactory.proxy(safeTransferFrom). Bypasses relayer-api. */
export async function withdrawSharesViaFactory(params: {
  eoaPrivateKey: string;
  proxyWallet: string;
  recipient: string;
  tokenId: string;
  amountDecimal: string;
}): Promise<{ transactionHash: Hex }> {
  const rpc =
    process.env.RPC_URL?.trim() || process.env.NEXT_PUBLIC_RPC_URL?.trim();
  if (!rpc) throw new Error("RPC_URL is not set");

  const factory = requireEnv("NEXT_PUBLIC_PROXY_WALLET_FACTORY_ADDRESS");
  const ctf = requireEnv("NEXT_PUBLIC_CTF_ADDRESS");
  const chain = chainFromEnv();
  const account = privateKeyToAccount(normalizePrivateKey(params.eoaPrivateKey));
  const amount = parseUnits(params.amountDecimal.trim(), 6);

  const transferData = encodeFunctionData({
    abi: ERC1155_ABI,
    functionName: "safeTransferFrom",
    args: [
      params.proxyWallet as Hex,
      params.recipient as Hex,
      BigInt(params.tokenId),
      amount,
      "0x",
    ],
  });

  const wallet = createWalletClient({
    account,
    chain,
    transport: http(rpc),
  });
  const publicClient = createPublicClient({ chain, transport: http(rpc) });

  const hash = await wallet.writeContract({
    address: factory,
    abi: FACTORY_ABI,
    functionName: "proxy",
    args: [[{ typeCode: 1, to: ctf, value: 0n, data: transferData }]],
  });
  const receipt = await publicClient.waitForTransactionReceipt({ hash });
  if (receipt.status !== "success") {
    throw new Error(`factory.proxy reverted (${hash})`);
  }
  return { transactionHash: hash };
}
