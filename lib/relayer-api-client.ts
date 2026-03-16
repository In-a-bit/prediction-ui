/**
 * Relayer API client: fetch relay payload (public) and submit (via our API route with auth).
 */

export type RelayPayload = {
  address: string;
  nonce: string;
};

const RELAYER_API_URL =
  typeof process === "undefined"
    ? "http://localhost:8085"
    : process.env.NEXT_PUBLIC_RELAYER_API_URL ?? "http://localhost:8085";

/** GET /relay-payload?address=0x...&type=PROXY */
export async function getRelayPayload(
  signerAddress: string,
  baseUrl: string = RELAYER_API_URL
): Promise<RelayPayload> {
  const url = new URL("/relay-payload", baseUrl);
  url.searchParams.set("address", signerAddress);
  url.searchParams.set("type", "PROXY");
  const res = await fetch(url.toString());
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`relay-payload failed (${res.status}): ${text}`);
  }
  return res.json() as Promise<RelayPayload>;
}

export type SubmitTransactionRequest = {
  from: string;
  to: string;
  proxyWallet?: string;
  data: string;
  nonce: string;
  signature: string;
  signatureParams: {
    gasPrice?: string;
    relayerFee?: string;
    gasLimit?: string;
    relayHub?: string;
    relay?: string;
  };
  type: "PROXY";
  metadata?: string;
};

export type SubmitTransactionResponse = {
  transactionID: string;
  transactionHash: string;
  state: string;
};

/**
 * Submit a PROXY transaction to the relayer API via our Next.js API route.
 * The route adds poly_* auth headers (server-side).
 */
export async function submitTransaction(
  body: SubmitTransactionRequest,
  apiRouteBase: string = ""
): Promise<SubmitTransactionResponse> {
  const path = apiRouteBase ? `${apiRouteBase}/api/relayer/submit` : "/api/relayer/submit";
  const res = await fetch(path, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
    credentials: "include",
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`submit failed (${res.status}): ${text}`);
  }
  return res.json() as Promise<SubmitTransactionResponse>;
}
