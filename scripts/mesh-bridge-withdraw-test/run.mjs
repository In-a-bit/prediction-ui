// Probe Mesh headless withdrawal bridging (routes + optional address).
//
//   node scripts/mesh-bridge-withdraw-test/run.mjs
//
// Optional:
//   MESH_DEST=usdc-eth          USDC on Ethereum (default)
//   MESH_DEST=btc               BTC on Bitcoin
//   MESH_DEST_ADDRESS=0x...     payout address (Ethereum for usdc-eth)
//   MESH_FROM=0x...             Polygon sender (proxy / EOA)
//   MESH_AMOUNT=1               USDC to send to Mesh pay-in
//   MESH_SKIP_SEND=1            skip Privy + relayer submit
//   MESH_FROM_PRIVATE_KEY=0x... send native USDC from an EOA instead
//   MESH_DEST_NETWORK / MESH_DEST_ASSET  override the preset
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import dotenv from "dotenv";
import {
  createPublicClient,
  createWalletClient,
  encodeFunctionData,
  http,
  parseUnits,
} from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { polygon } from "viem/chains";
import { submitPrivyRelayerWithdraw } from "./privy-relayer.mjs";

const root = dirname(fileURLToPath(import.meta.url));
const uiRoot = resolve(root, "../..");
dotenv.config({ path: resolve(uiRoot, "../prediction-go/.env") });

const apiUrl = (
  process.env.MESH_API_URL || "https://integration-api.meshconnect.com"
).replace(/\/$/, "");
const clientId = process.env.MESH_CLIENT_ID ?? "";
const apiKey = process.env.MESH_API_KEY ?? "";

if (!clientId || !apiKey) {
  throw new Error("MESH_CLIENT_ID and MESH_API_KEY are required");
}

const POLYGON = "eip155:137";
const ETHEREUM = "eip155:1";
const BITCOIN = "bip122:000000000019d6689c085ae165831e93";

const DEST_PRESETS = {
  "usdc-eth": { network: ETHEREUM, asset: "USDC" },
  btc: { network: BITCOIN, asset: "BTC" },
};

const destPreset =
  DEST_PRESETS[process.env.MESH_DEST || "usdc-eth"] ?? DEST_PRESETS["usdc-eth"];
const destNetwork = process.env.MESH_DEST_NETWORK || destPreset.network;
const destAsset = (process.env.MESH_DEST_ASSET || destPreset.asset).toUpperCase();
const destAddress =
  process.env.MESH_DEST_ADDRESS ||
  "0x4f1ca67680c85fb844ab66ac3ac7f0c3ac6c5ca3";
const fromAddress =
  process.env.MESH_FROM ||
  "0x5f63b4A02c40Ca3311F173262166d80Ce387827C";
const amountUsdc = process.env.MESH_AMOUNT || "1";
const fromPrivateKey = process.env.MESH_FROM_PRIVATE_KEY || "";
const polygonRpc =
  process.env.MESH_POLYGON_RPC || "https://polygon.drpc.org";
const usdcPolygon =
  process.env.MESH_USDC_POLYGON ||
  "0x3c499c542cEF5E3811e1192ce70d8cC03d5c3359";
const userId = process.env.MESH_USER_ID || "withdraw_test_user";
const transactionId =
  process.env.MESH_TX_ID || `withdraw_test_${Date.now()}`;

const headers = {
  "Content-Type": "application/json",
  "X-Client-Id": clientId,
  "X-Client-Secret": apiKey,
};

function routeKey(route) {
  const o = route.origin ?? {};
  const d = route.destination ?? {};
  return `${o.network}/${o.asset} → ${d.network}/${d.asset}`;
}

function matchesDest(route) {
  const d = route.destination ?? {};
  const network = String(d.network ?? "").toLowerCase();
  const asset = String(d.asset ?? "").toUpperCase();
  const wantNet = destNetwork.toLowerCase();
  return (
    asset === destAsset &&
    (network === wantNet ||
      (destAsset === "BTC" && network.includes("bitcoin")) ||
      (wantNet === ETHEREUM && network === "ethereum"))
  );
}

function toCurl(url, headers, body) {
  const headerFlags = Object.entries(headers)
    .map(([k, v]) => `  --header '${k}: ${v}'`)
    .join(" \\\n");
  return [
    `curl --location '${url}' \\`,
    headerFlags + " \\",
    `  --data '${body}'`,
  ].join("\n");
}

async function post(path, body) {
  const url = `${apiUrl}${path}`;
  const payload = JSON.stringify(body);
  console.log(`\n${toCurl(url, headers, payload)}`);
  const res = await fetch(url, { method: "POST", headers, body: payload });
  const raw = await res.text();
  let json;
  try {
    json = raw ? JSON.parse(raw) : {};
  } catch {
    json = { raw };
  }
  console.log(`HTTP ${res.status}\n${raw || "(empty body)"}`);
  return { ok: res.ok, status: res.status, json };
}

function printRoutes(label, routes) {
  console.log(`\n${label}: ${routes.length} route(s)`);
  for (const route of routes) {
    const name = route.displayName ? `  (${route.displayName})` : "";
    console.log(`  ${routeKey(route)}${name}`);
  }
}

const ERC20_ABI = [
  {
    name: "transfer",
    type: "function",
    stateMutability: "nonpayable",
    inputs: [
      { name: "to", type: "address" },
      { name: "amount", type: "uint256" },
    ],
    outputs: [{ name: "", type: "bool" }],
  },
  {
    name: "balanceOf",
    type: "function",
    stateMutability: "view",
    inputs: [{ name: "account", type: "address" }],
    outputs: [{ name: "", type: "uint256" }],
  },
];

async function sendUsdcOnPolygon(to) {
  if (!fromPrivateKey) {
    throw new Error("MESH_FROM_PRIVATE_KEY is required to send");
  }
  const pk = fromPrivateKey.startsWith("0x")
    ? fromPrivateKey
    : `0x${fromPrivateKey}`;
  const account = privateKeyToAccount(pk);
  if (account.address.toLowerCase() !== fromAddress.toLowerCase()) {
    throw new Error(
      `MESH_FROM_PRIVATE_KEY is ${account.address}, not ${fromAddress}`,
    );
  }
  const transport = http(polygonRpc);
  const publicClient = createPublicClient({ chain: polygon, transport });
  const wallet = createWalletClient({ account, chain: polygon, transport });
  const units = parseUnits(amountUsdc, 6);
  const bal = await publicClient.readContract({
    address: usdcPolygon,
    abi: ERC20_ABI,
    functionName: "balanceOf",
    args: [fromAddress],
  });
  console.log(`\nPolygon native USDC balance: ${Number(bal) / 1e6}`);
  if (bal < units) {
    throw new Error(`Need ${amountUsdc} USDC, wallet has ${Number(bal) / 1e6}`);
  }
  const data = encodeFunctionData({
    abi: ERC20_ABI,
    functionName: "transfer",
    args: [to, units],
  });
  console.log(
    `\nSending ${amountUsdc} USDC on Polygon\n  from ${fromAddress}\n  to   ${to}`,
  );
  const hash = await wallet.sendTransaction({
    to: usdcPolygon,
    data,
  });
  console.log(`tx ${hash}`);
  const receipt = await publicClient.waitForTransactionReceipt({ hash });
  if (receipt.status !== "success") {
    throw new Error(`USDC transfer reverted (${hash})`);
  }
  console.log("transfer confirmed");
  return hash;
}

const polygonSources = [
  { network: POLYGON, asset: "USDC" },
  // { network: POLYGON, asset: "POL" },
  // { network: POLYGON, asset: "USDC.e" },
];

const polygonRes = await post("/api/v1/bridging/routes/withdrawal", {
  sources: polygonSources,
  optimized: true,
});
const polygonRoutes = polygonRes.json?.content?.routes ?? [];
printRoutes("Polygon mainnet sources (eip155:137)", polygonRoutes);

const destRoutes = polygonRoutes.filter(matchesDest);
printRoutes(`Matching dest ${destAsset} on ${destNetwork}`, destRoutes);

const denied =
  polygonRes.json?.errorType === "permissionDenied";
console.log(
  `\nsummary` +
    `\n  headless bridging: ${denied ? "not enabled for this client" : polygonRes.ok ? "ok" : `HTTP ${polygonRes.status}`}` +
    `\n  polygon → ${destAsset} on ${destNetwork}: ${destRoutes.length} route(s)`,
);

if (!destAddress) {
  console.log(
    "\nSkip create address (set MESH_DEST_ADDRESS to a payout address, e.g. 0x… for USDC on Ethereum).",
  );
  process.exit(polygonRes.ok ? 0 : 1);
}

const selected = destRoutes[0] ?? polygonRoutes[0];
if (!selected) {
  throw new Error("No withdrawal route to create an address from");
}

const addressRes = await post("/api/v1/bridging/address", {
  userId,
  transactionId,
  origin: {
    network: selected.origin.network,
    asset: selected.origin.asset,
  },
  destination: {
    network: selected.destination.network,
    asset: selected.destination.asset,
    address: destAddress,
  },
});

const payIn =
  addressRes.json?.content?.selectedRoute?.bridgingAddress?.address;
if (!payIn) {
  throw new Error("No Mesh bridgingAddress in response");
}

console.log(
  `\nSend ${amountUsdc} USDC from proxy ${fromAddress} to Mesh pay-in ${payIn}` +
    `\nMesh will deliver ${destAsset} on ${destNetwork} to ${destAddress}.` +
    `\nDo not reuse this pay-in; it may expire.`,
);

if (process.env.MESH_SKIP_SEND === "1") {
  console.log("\nSkip send (MESH_SKIP_SEND=1).");
  process.exit(addressRes.ok ? 0 : 1);
}

if (fromPrivateKey) {
  await sendUsdcOnPolygon(payIn);
} else {
  await submitPrivyRelayerWithdraw({
    proxyWallet: fromAddress,
    recipient: payIn,
    amountUsdc,
  });
}
