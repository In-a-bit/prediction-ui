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
 * Submit a PROXY transaction directly to the relayer API.
 * Cookies (predictionsession) are forwarded by the browser via credentials: "include".
 *
 * If you ever want to re-enable the Next.js API proxy, you can:
 * - add a `useProxy` flag here, and
 * - send requests to `/api/relayer/submit` instead.
 */
export async function submitTransaction(
  body: SubmitTransactionRequest,
  baseUrl: string = RELAYER_API_URL
): Promise<SubmitTransactionResponse> {
  const url = `${baseUrl.replace(/\/$/, "")}/submit`;
  const res = await fetch(url, {
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
