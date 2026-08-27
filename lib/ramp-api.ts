import type { DpmSdk } from "@inabit-com/dpm-sdk";

import { predictionServiceBase } from "@/lib/prediction-proxy";

/**
 * Client for the gamma-api fiat on/off-ramp endpoints.
 *
 * Unlike the balance readers in dpm-api, these functions throw on failure: every
 * call is triggered by a deliberate user action that needs a visible error rather
 * than a silent null.
 */

function rampPath(path: string, gammaBase?: string): string {
  const base = (gammaBase ?? predictionServiceBase("gamma")).replace(/\/$/, "");
  const suffix = path.startsWith("/") ? path : `/${path}`;
  return `${base}${suffix}`;
}

export type RampType = "onramp" | "offramp";

export type RampJSON = {
  id: number;
  user_id: number;
  type: string;
  provider_name: string;
  external_id?: string;
  status: string;
  deposit_address?: string;
};

export type OfframpDetailsResponse = {
  asset: string;
  currency_code: string;
  /** Human-readable crypto amount to send, e.g. "12.5". */
  amount: string;
  destination_address: string;
  destination_tag?: string;
  blockchain: string;
  network: string;
  invoice?: string;
};

/**
 * Builds the auth headers for a ramp call. The endpoints accept either a user
 * JWT or LP credentials, and the SDK already knows which mode this session uses.
 *
 * `X-API-Key` is deliberately absent: prediction-gateway injects it, and strips
 * any value the browser sends.
 */
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

async function failure(res: Response, label: string): Promise<Error> {
  const body = await res.text().catch(() => "");
  let message = "";
  try {
    message = (JSON.parse(body) as { error?: string }).error ?? "";
  } catch {
    message = "";
  }
  console.error(`[ramp-api] ${label} failed (${res.status}):`, body);
  return new Error(message || `${label} failed (${res.status})`);
}

/**
 * Creates a ramp request and returns the provider request id (external_id)
 * used to open the widget. POST /ramp/onramp | /ramp/offramp
 */
export async function createRampRequest(
  dpmSdk: DpmSdk,
  type: RampType,
  gammaBase?: string,
): Promise<string> {
  const res = await fetch(rampPath(`/ramp/${type}`, gammaBase), {
    method: "POST",
    headers: await authHeaders(dpmSdk),
  });
  if (!res.ok) throw await failure(res, `POST /ramp/${type}`);
  const body = (await res.json()) as RampJSON;
  if (!body.external_id) throw new Error("Ramp provider returned no request id");
  return body.external_id;
}

/**
 * Fetches where and how much crypto to send for an off-ramp the user has just
 * confirmed in the widget. GET /ramp/{requestId}/offramp-details
 */
export async function getOfframpDetails(
  dpmSdk: DpmSdk,
  requestId: string,
  gammaBase?: string,
): Promise<OfframpDetailsResponse> {
  const res = await fetch(
    rampPath(`/ramp/${encodeURIComponent(requestId)}/offramp-details`, gammaBase),
    { headers: await authHeaders(dpmSdk) },
  );
  if (!res.ok) throw await failure(res, "GET /ramp/offramp-details");
  return res.json() as Promise<OfframpDetailsResponse>;
}
