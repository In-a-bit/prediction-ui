import { createHmac, createDecipheriv } from "node:crypto";
import { execFileSync } from "node:child_process";
import {
  concat,
  encodeFunctionData,
  keccak256,
  parseUnits,
  toHex,
} from "viem";
import { PrivyClient, isEmbeddedWalletLinkedAccount } from "@privy-io/node";

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
];

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
];

function decryptAes256Gcm(hexKey, encoded) {
  const key = Buffer.from(hexKey, "hex");
  const data = Buffer.from(encoded, "base64");
  const nonce = data.subarray(0, 12);
  const tag = data.subarray(data.length - 16);
  const ciphertext = data.subarray(12, data.length - 16);
  const decipher = createDecipheriv("aes-256-gcm", key, nonce);
  decipher.setAuthTag(tag);
  return Buffer.concat([decipher.update(ciphertext), decipher.final()]).toString(
    "utf8",
  );
}

function loadBuilderUser(proxyWallet) {
  if (!/^0x[0-9a-fA-F]{40}$/.test(proxyWallet)) {
    throw new Error(`Invalid proxy wallet: ${proxyWallet}`);
  }
  const dbUrl = process.env.DATABASE_URL;
  if (!dbUrl) throw new Error("DATABASE_URL is required");
  const sql = `
    SELECT u.id, u.address, u.proxy_wallet, b.wallet_public_key, b.wallet_secret_encrypted
    FROM users u
    JOIN builders b ON b.id = u.builder_id
    WHERE b.id = 1
      AND lower(u.proxy_wallet) = lower('${proxyWallet}')
    LIMIT 1;
  `;
  const raw = execFileSync(
    "psql",
    [dbUrl, "-t", "-A", "-F", "\t", "-c", sql],
    { encoding: "utf8" },
  ).trim();
  if (!raw) {
    throw new Error(`No builder-1 user with proxy_wallet ${proxyWallet}`);
  }
  const [id, address, proxy, appId, secretEnc] = raw.split("\t");
  const encKey = process.env.WALLET_ENCRYPTION_KEY ?? "";
  let appSecret = process.env.PRIVY_APP_SECRET ?? "";
  if (encKey && secretEnc) {
    try {
      appSecret = decryptAes256Gcm(encKey, secretEnc).trim() || appSecret;
    } catch {
      // fall back to PRIVY_APP_SECRET
    }
  }
  if (!appId || !appSecret) {
    throw new Error("Privy app id/secret missing for builder 1");
  }
  return {
    userId: Number(id),
    eoa: address,
    proxyWallet: proxy,
    appId,
    appSecret,
  };
}

function mintAccessJwt(userId) {
  const secret = process.env.JWT_SECRET;
  if (!secret) throw new Error("JWT_SECRET is required");
  const now = Math.floor(Date.now() / 1000);
  const header = Buffer.from(
    JSON.stringify({ alg: "HS256", typ: "JWT" }),
  ).toString("base64url");
  const payload = Buffer.from(
    JSON.stringify({
      sub: String(userId),
      iss: "prediction",
      iat: now,
      exp: now + 3600,
      type: "access",
    }),
  ).toString("base64url");
  const sig = createHmac("sha256", secret)
    .update(`${header}.${payload}`)
    .digest("base64url");
  return `${header}.${payload}.${sig}`;
}

function createProxyStructHash({
  from,
  to,
  data,
  txFee,
  gasPrice,
  gasLimit,
  nonce,
  relayHub,
  relay,
}) {
  return keccak256(
    concat([
      toHex("rlx:"),
      from,
      to,
      data,
      toHex(BigInt(txFee), { size: 32 }),
      toHex(BigInt(gasPrice), { size: 32 }),
      toHex(BigInt(gasLimit), { size: 32 }),
      toHex(BigInt(nonce), { size: 32 }),
      relayHub,
      relay,
    ]),
  );
}

async function privySignMessage(appId, appSecret, eoa, messageHex) {
  const privy = new PrivyClient({ appId, appSecret });
  const user = await privy.users().getByWalletAddress({ address: eoa });
  const account = user.linked_accounts?.find(
    (a) =>
      isEmbeddedWalletLinkedAccount(a) &&
      a.address?.toLowerCase() === eoa.toLowerCase(),
  );
  const walletId = account?.id ?? account?.wallet_id;
  if (!walletId) {
    throw new Error(
      `No Privy embedded wallet id for ${eoa}. accounts=${JSON.stringify(user.linked_accounts?.map((a) => ({ type: a.type, address: a.address, id: a.id })))}`,
    );
  }
  console.log(`Privy wallet id ${walletId} (${eoa})`);
  const signed = await privy.wallets().ethereum().signMessage(walletId, {
    message: Buffer.from(messageHex.slice(2), "hex"),
  });
  const signature = signed.signature ?? signed.data?.signature;
  if (!signature) {
    throw new Error(`Privy signMessage returned no signature: ${JSON.stringify(signed)}`);
  }
  return signature;
}

async function relayerJson(base, path, { method = "GET", token, body } = {}) {
  const url = `${base.replace(/\/$/, "")}${path}`;
  const res = await fetch(url, {
    method,
    headers: {
      Authorization: `Bearer ${token}`,
      ...(body ? { "Content-Type": "application/json" } : {}),
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  const raw = await res.text();
  let json;
  try {
    json = raw ? JSON.parse(raw) : {};
  } catch {
    json = { raw };
  }
  if (!res.ok) {
    throw new Error(`relayer ${method} ${path} HTTP ${res.status}: ${raw}`);
  }
  return json;
}

export async function submitPrivyRelayerWithdraw({
  proxyWallet,
  recipient,
  amountUsdc,
}) {
  const builderUser = loadBuilderUser(proxyWallet);
  const factory = process.env.PROXY_WALLET_FACTORY_ADDRESS;
  const relayHub = process.env.RELAY_HUB_ADDRESS;
  const collateral = process.env.COLLATERAL_ADDRESS;
  const relayerBase =
    process.env.RELAYER_API_URL || "http://localhost:8085";
  if (!factory || !relayHub || !collateral) {
    throw new Error(
      "PROXY_WALLET_FACTORY_ADDRESS, RELAY_HUB_ADDRESS, COLLATERAL_ADDRESS are required",
    );
  }

  const token = mintAccessJwt(builderUser.userId);
  const amount = parseUnits(amountUsdc, 6);
  const transferData = encodeFunctionData({
    abi: ERC20_TRANSFER_ABI,
    functionName: "transfer",
    args: [recipient, amount],
  });
  const data = encodeFunctionData({
    abi: PROXY_FACTORY_ABI,
    functionName: "proxy",
    args: [
      [{ typeCode: 1, to: collateral, value: 0n, data: transferData }],
    ],
  });

  const relay = await relayerJson(
    relayerBase,
    `/relay-payload?address=${builderUser.eoa}&type=PROXY`,
    { token },
  );
  const gasPrice = "0";
  const gasLimit = "300000";
  const relayerFee = "0";
  const structHash = createProxyStructHash({
    from: builderUser.eoa,
    to: factory,
    data,
    txFee: relayerFee,
    gasPrice,
    gasLimit,
    nonce: relay.nonce,
    relayHub,
    relay: relay.address,
  });

  console.log(
    `\nSigning GSN withdraw via Privy (builder 1)` +
      `\n  eoa          ${builderUser.eoa}` +
      `\n  proxy        ${builderUser.proxyWallet}` +
      `\n  collateral   ${collateral}` +
      `\n  to           ${recipient}` +
      `\n  amount       ${amountUsdc} (6 decimals)` +
      `\n  relay hub    ${relayHub}` +
      `\n  relay        ${relay.address}` +
      `\n  nonce        ${relay.nonce}` +
      `\n  relayer api  ${relayerBase}` +
      `\n  chain id     ${process.env.CHAIN_ID || "(unset)"}`,
  );

  const signature = await privySignMessage(
    builderUser.appId,
    builderUser.appSecret,
    builderUser.eoa,
    structHash,
  );
  console.log(`Privy signature ${signature.slice(0, 18)}…`);

  const submitted = await relayerJson(relayerBase, "/submit", {
    method: "POST",
    token,
    body: {
      from: builderUser.eoa,
      to: factory,
      proxyWallet: builderUser.proxyWallet,
      data,
      nonce: String(relay.nonce),
      signature,
      signatureParams: {
        gasPrice,
        gasLimit,
        relayerFee,
        relayHub,
        relay: relay.address,
      },
      type: "PROXY",
      metadata: "mesh withdraw via privy",
    },
  });
  console.log(`relayer submit ${JSON.stringify(submitted)}`);
  return submitted;
}
