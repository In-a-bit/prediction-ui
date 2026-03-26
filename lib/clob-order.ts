import type { ClobCredentials } from "./clob-auth";

const ZERO_ADDRESS = "0x0000000000000000000000000000000000000000";

// EIP-712 typed data for CTF Exchange order signing.
// Must match the Go backend's crypto/eip712.go exactly.
const ORDER_EIP712_TYPES = {
  EIP712Domain: [
    { name: "name", type: "string" },
    { name: "version", type: "string" },
    { name: "chainId", type: "uint256" },
    { name: "verifyingContract", type: "address" },
  ],
  Order: [
    { name: "salt", type: "uint256" },
    { name: "maker", type: "address" },
    { name: "signer", type: "address" },
    { name: "taker", type: "address" },
    { name: "tokenId", type: "uint256" },
    { name: "makerAmount", type: "uint256" },
    { name: "takerAmount", type: "uint256" },
    { name: "expiration", type: "uint256" },
    { name: "nonce", type: "uint256" },
    { name: "feeRateBps", type: "uint256" },
    { name: "side", type: "uint8" },
    { name: "signatureType", type: "uint8" },
  ],
};

export interface OrderParams {
  /** BUY = 0, SELL = 1 */
  side: 0 | 1;
  tokenId: string;
  /** Dollar amount the user typed (e.g. 10 for "$10") */
  amount: number;
  /** Price as a decimal (e.g. 0.5 for "50¢") */
  price: number;
}

interface OrderFields {
  salt: string;
  maker: string;
  signer: string;
  taker: string;
  tokenId: string;
  makerAmount: string;
  takerAmount: string;
  expiration: string;
  nonce: string;
  feeRateBps: string;
  side: number;
  signatureType: number;
}

function randomSalt(): string {
  const bytes = new Uint8Array(32);
  crypto.getRandomValues(bytes);
  let hex = "0x";
  for (const b of bytes) hex += b.toString(16).padStart(2, "0");
  return BigInt(hex).toString();
}

/**
 * Convert a floating-point amount to an 1e18-scaled integer string.
 * e.g. 10.5 -> "10500000000000000000"
 */
function to1e18(value: number): string {
  const scaled = BigInt(Math.round(value * 1e9)) * BigInt(1e9);
  return scaled.toString();
}

function buildOrderFields(params: OrderParams, maker: string): OrderFields {
  const { side, tokenId, amount, price } = params;

  // BUY: maker pays collateral, receives tokens.
  //   makerAmount = amount (collateral), takerAmount = amount / price (tokens)
  // SELL: maker pays tokens, receives collateral.
  //   makerAmount = amount / price (tokens), takerAmount = amount (collateral)
  let makerAmount: string;
  let takerAmount: string;

  if (side === 0) {
    makerAmount = to1e18(amount);
    takerAmount = to1e18(amount / price);
  } else {
    makerAmount = to1e18(amount / price);
    takerAmount = to1e18(amount);
  }

  return {
    salt: randomSalt(),
    maker,
    signer: maker,
    taker: ZERO_ADDRESS,
    tokenId,
    makerAmount,
    takerAmount,
    expiration: "0",
    nonce: "0",
    feeRateBps: "0",
    side,
    signatureType: 0,
  };
}

/**
 * Sign the order via Magic's eth_signTypedData_v4 and return the signature hex string.
 */
async function signOrder(
  rpcProvider: { request: (args: { method: string; params: unknown[] }) => Promise<string> },
  maker: string,
  order: OrderFields,
): Promise<string> {
  const chainId = Number(process.env.NEXT_PUBLIC_CHAIN_ID || "80002");
  const exchangeAddress = process.env.NEXT_PUBLIC_CTF_EXCHANGE_ADDRESS;
  if (!exchangeAddress) throw new Error("NEXT_PUBLIC_CTF_EXCHANGE_ADDRESS is not set");

  const typedData = {
    types: ORDER_EIP712_TYPES,
    domain: {
      name: "Polymarket CTF Exchange",
      version: "1",
      chainId,
      verifyingContract: exchangeAddress,
    },
    primaryType: "Order",
    message: {
      salt: order.salt,
      maker: order.maker,
      signer: order.signer,
      taker: order.taker,
      tokenId: order.tokenId,
      makerAmount: order.makerAmount,
      takerAmount: order.takerAmount,
      expiration: order.expiration,
      nonce: order.nonce,
      feeRateBps: order.feeRateBps,
      side: order.side,
      signatureType: order.signatureType,
    },
  };

  return rpcProvider.request({
    method: "eth_signTypedData_v4",
    params: [maker, JSON.stringify(typedData)],
  });
}

/**
 * Build the L2 HMAC authentication headers required by POST /order.
 * Mirrors the Go GenerateHMACSignature in libs/clob-auth/hmac.go.
 */
async function buildHmacHeaders(
  creds: ClobCredentials,
  method: string,
  requestPath: string,
): Promise<Record<string, string>> {
  const timestamp = Math.floor(Date.now() / 1000).toString();
  const message = timestamp + method + requestPath;

  const encoder = new TextEncoder();
  const secretBytes = Uint8Array.from(atob(creds.secret), (c) => c.charCodeAt(0));

  const key = await globalThis.crypto.subtle.importKey(
    "raw",
    secretBytes,
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );

  const sigBytes = await globalThis.crypto.subtle.sign("HMAC", key, encoder.encode(message));
  let sig = btoa(String.fromCharCode(...new Uint8Array(sigBytes)));
  sig = sig.replace(/\+/g, "-").replace(/\//g, "_");

  return {
    PREDICTION_API_KEY: creds.apiKey,
    PREDICTION_PASSPHRASE: creds.passphrase,
    PREDICTION_TIMESTAMP: timestamp,
    PREDICTION_SIGNATURE: sig,
  };
}

/**
 * Look up the clob market ID for a given token by calling GET /book.
 */
async function fetchMarketId(clobBaseUrl: string, tokenId: string): Promise<string> {
  const res = await fetch(`${clobBaseUrl}/book?token_id=${tokenId}`);
  if (!res.ok) throw new Error("Failed to fetch order book for market ID lookup");
  const data = await res.json();
  return data.market;
}

export interface SubmitOrderResult {
  orderHash: string;
  status: string;
  match?: { takerFillAmount: string; makerCount: number; marketId: string };
}

/**
 * Full order submission flow:
 * 1. Look up clob market ID from token
 * 2. Build order struct
 * 3. Sign via Magic EIP-712
 * 4. Build HMAC auth headers
 * 5. POST to clob-api /order
 */
export async function submitOrder(
  magic: {
    rpcProvider: { request: (args: { method: string; params: unknown[] }) => Promise<string> };
    user: { getInfo: () => Promise<{ wallets?: { ethereum?: { publicAddress?: string | null } } }> };
  },
  creds: ClobCredentials,
  clobBaseUrl: string,
  params: OrderParams,
): Promise<SubmitOrderResult> {
  const info = await magic.user.getInfo();
  const maker = info.wallets?.ethereum?.publicAddress;
  if (!maker) throw new Error("No Magic wallet address found");

  const marketId = await fetchMarketId(clobBaseUrl, params.tokenId);

  const order = buildOrderFields(params, maker);
  const signature = await signOrder(magic.rpcProvider, maker, order);

  const hmacHeaders = await buildHmacHeaders(creds, "POST", "/order");

  const res = await fetch(`${clobBaseUrl}/order`, {
    method: "POST",
    headers: { "Content-Type": "application/json", ...hmacHeaders },
    body: JSON.stringify({
      order: {
        salt: order.salt,
        maker: order.maker,
        signer: order.signer,
        taker: order.taker,
        token_id: order.tokenId,
        maker_amount: order.makerAmount,
        taker_amount: order.takerAmount,
        expiration: order.expiration,
        nonce: order.nonce,
        fee_rate_bps: order.feeRateBps,
        side: order.side,
        signature_type: order.signatureType,
      },
      signature,
      market_id: marketId,
    }),
  });

  if (!res.ok) {
    const errBody = await res.json().catch(() => ({ error: res.statusText }));
    throw new Error(errBody.error || `Order submission failed: ${res.status}`);
  }

  const data = await res.json();
  return {
    orderHash: data.order_hash,
    status: data.status,
    match: data.match
      ? {
          takerFillAmount: data.match.taker_fill_amount,
          makerCount: data.match.maker_count,
          marketId: data.match.market_id,
        }
      : undefined,
  };
}
