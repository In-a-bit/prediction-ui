import type { DpmSdk } from "@inabit-com/dpm-sdk";

import { authHeaders, failure, rampPath } from "@/lib/ramp-api";

/**
 * Client for the gamma-api Mesh bridge endpoints. Throws on failure, like the
 * ramp client: every call follows a user action that needs a visible error.
 */

/** Asset on a network, named by CAIP-2 id ("eip155:1") and symbol ("USDC"). */
export type BridgeAsset = { network: string; asset: string };

export type WithdrawalRoute = {
  origin: BridgeAsset;
  destination: BridgeAsset;
  display_name?: string;
  /** Smallest USDC amount this route accepts, e.g. "5". */
  min_amount: string;
};

type BridgeSessionResponse = { id: number; link_token: string };

type WithdrawalRoutesResponse = { routes: WithdrawalRoute[] };

export type BridgeWithdrawalResponse = {
  id: number;
  status: string;
  /** Single-use Mesh pay-in address; send exactly `amount` USDC here. */
  bridging_address: string;
  /** RFC3339; the address does not accept funds after this. */
  address_expires_at?: string;
  amount: string;
  symbol: string;
};

/** Starts a Mesh deposit and returns the Link token. POST /bridge-requests/deposit */
export async function createBridgeDeposit(
  dpmSdk: DpmSdk,
  gammaBase?: string,
): Promise<string> {
  const res = await fetch(rampPath("/bridge-requests/deposit", gammaBase), {
    method: "POST",
    headers: await authHeaders(dpmSdk),
  });
  if (!res.ok) throw await failure(res, "POST /bridge-requests/deposit");
  const body = (await res.json()) as BridgeSessionResponse;
  if (!body.link_token) throw new Error("Mesh returned no link token");
  return body.link_token;
}

/** Lists withdrawal destinations. GET /bridge-requests/withdrawal/routes */
export async function listWithdrawalRoutes(
  dpmSdk: DpmSdk,
  gammaBase?: string,
): Promise<WithdrawalRoute[]> {
  const res = await fetch(
    rampPath("/bridge-requests/withdrawal/routes", gammaBase),
    { headers: await authHeaders(dpmSdk) },
  );
  if (!res.ok) throw await failure(res, "GET /bridge-requests/withdrawal/routes");
  const body = (await res.json()) as WithdrawalRoutesResponse;
  return body.routes ?? [];
}

/**
 * Starts a Mesh withdrawal and returns the pay-in address. The caller then
 * sends the USDC there from the proxy wallet. POST /bridge-requests/withdrawal
 */
export async function createBridgeWithdrawal(
  dpmSdk: DpmSdk,
  input: {
    amount: string;
    recipientAddress: string;
    destination: BridgeAsset;
  },
  gammaBase?: string,
): Promise<BridgeWithdrawalResponse> {
  const res = await fetch(rampPath("/bridge-requests/withdrawal", gammaBase), {
    method: "POST",
    headers: {
      ...(await authHeaders(dpmSdk)),
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      amount: input.amount,
      recipient_address: input.recipientAddress,
      destination_network: input.destination.network,
      destination_asset: input.destination.asset,
    }),
  });
  if (!res.ok) throw await failure(res, "POST /bridge-requests/withdrawal");
  return res.json() as Promise<BridgeWithdrawalResponse>;
}

export type BridgeWithdrawalQuote = {
  /** USDC sent. */
  amount: string;
  symbol: string;
  /** Estimated amount received, in `destination_asset`, after fees. */
  estimated_amount: string;
  destination_asset: string;
  /** Bridge fees in USD, already taken off `estimated_amount`. */
  fee_usd?: string;
  quoted_at: number;
};

/**
 * The quote was refused because of what the user entered: the amount is
 * outside the route's limits or the recipient does not fit the network.
 * "invalid_request" is gamma-api's own check, which sends no code.
 */
export class QuoteRejectedError extends Error {
  constructor(
    message: string,
    readonly code:
      | "amount_below_minimum"
      | "amount_above_maximum"
      | "invalid_recipient_address"
      | "invalid_request",
  ) {
    super(message);
    this.name = "QuoteRejectedError";
  }
}

/**
 * Estimates what a withdrawal delivers after Mesh fees. Nothing is created.
 * Throws QuoteRejectedError when Mesh refuses the amount or the recipient.
 * POST /bridge-requests/withdrawal/quote
 */
export async function quoteBridgeWithdrawal(
  dpmSdk: DpmSdk,
  input: {
    amount: string;
    recipientAddress: string;
    destination: BridgeAsset;
  },
  gammaBase?: string,
  signal?: AbortSignal,
): Promise<BridgeWithdrawalQuote> {
  const res = await fetch(rampPath("/bridge-requests/withdrawal/quote", gammaBase), {
    method: "POST",
    headers: {
      ...(await authHeaders(dpmSdk)),
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      amount: input.amount,
      recipient_address: input.recipientAddress,
      destination_network: input.destination.network,
      destination_asset: input.destination.asset,
    }),
    signal,
  });
  // 400 is gamma-api rejecting the input (e.g. a recipient that does not fit
  // the network); 422 is Mesh rejecting it. Both carry a user-facing message.
  if (res.status === 400 || res.status === 422) {
    const body = (await res.json().catch(() => ({}))) as {
      error?: string;
      code?: QuoteRejectedError["code"];
    };
    throw new QuoteRejectedError(
      body.error || "Withdrawal details were rejected",
      body.code ?? "invalid_request",
    );
  }
  if (!res.ok) throw await failure(res, "POST /bridge-requests/withdrawal/quote");
  return res.json() as Promise<BridgeWithdrawalQuote>;
}

/**
 * Network name for a route, taken from Mesh's display name
 * ("USDC on Polygon → BTC on Bitcoin" gives "Bitcoin"). Falls back to the
 * CAIP-2 id.
 */
export function routeNetworkName(route: WithdrawalRoute): string {
  const name = route.display_name?.split(" on ").pop()?.trim();
  return name || route.destination.network;
}
