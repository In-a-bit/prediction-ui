/**
 * Relayer API client: relay payload via /api/go/relayer (APP_API_KEY on server);
 * submit goes through /api/relayer/submit (forwards cookies + upstream APP key).
 */

import { PG, pgUrl } from "@/lib/prediction-go";

export type RelayPayload = {
  address: string;
  nonce: string;
};

/** GET /relay-payload?address=0x...&type=PROXY */
export async function getRelayPayload(
  signerAddress: string,
  relayerBase: string = PG.relayer,
): Promise<RelayPayload> {
  const path = pgUrl(relayerBase, "/relay-payload");
  const q = new URLSearchParams({
    address: signerAddress,
    type: "PROXY",
  });
  const res = await fetch(`${path}?${q}`);
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

/** POST submit — Next.js route proxies to prediction-go with APP_API_KEY. */
export async function submitTransaction(
  body: SubmitTransactionRequest,
): Promise<SubmitTransactionResponse> {
  const res = await fetch("/api/relayer/submit", {
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
