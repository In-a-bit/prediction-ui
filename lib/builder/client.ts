"use client";

import { builderBackendUrl } from "./config";
import type {
  BuilderMode,
  BuilderSiteConfig,
  CashEntry,
  CustomerProfile,
  PredictionSession,
  TransferResult,
} from "./types";

/**
 * The browser's view of a builder's site.
 *
 * Every call goes from the page straight to the builder's backend, so the builder sees the
 * customer's own IP — the same as it would on a real builder's site. That backend must list this
 * app's origin in its `CORS_ORIGINS`.
 *
 * The session is an HttpOnly cookie the builder's backend sets on sign-in; the page never sees the
 * token, it only asks the browser to send the cookie along.
 */
async function call<T>(mode: BuilderMode, path: string, init?: RequestInit): Promise<T> {
  let response: Response;
  try {
    response = await fetch(`${builderBackendUrl(mode)}/v1/site${path}`, {
      ...init,
      cache: "no-store",
      credentials: "include",
      headers: {
        "Content-Type": "application/json",
        Accept: "application/json",
        ...(init?.headers ?? {}),
      },
    });
  } catch {
    throw new Error(`The ${mode} builder's backend is not reachable`);
  }
  const text = await response.text();
  let body: unknown = null;
  try {
    body = text ? (JSON.parse(text) as unknown) : null;
  } catch {
    // An HTML page here is something in front of the builder answering — a WAF block page or a
    // proxy error — not the builder itself, which only ever speaks JSON.
    throw new Error(
      `The ${mode} builder's backend answered ${response.status} with a non-JSON page — ` +
        "likely a firewall or proxy in front of it",
    );
  }
  if (!response.ok) throw new Error(message(body) ?? `Request failed (${response.status})`);
  return body as T;
}

/** Every service in this demo answers with `{error:{message}}`. */
function message(body: unknown): string | null {
  if (!body || typeof body !== "object") return null;
  const { error } = body as { error?: unknown };
  if (typeof error === "string") return error;
  if (error && typeof error === "object") {
    const { message: text } = error as { message?: unknown };
    if (typeof text === "string") return text;
  }
  return null;
}

type SiteUser = Pick<CustomerProfile, "id" | "email" | "displayName" | "plaeeUserId">;

export function fetchSiteConfig(mode: BuilderMode): Promise<BuilderSiteConfig> {
  return call<BuilderSiteConfig>(mode, "/config");
}

/** Resolves to null when nobody is signed in, which is an answer rather than a failure. */
export async function fetchProfile(mode: BuilderMode): Promise<CustomerProfile | null> {
  try {
    return await call<CustomerProfile>(mode, "/me");
  } catch {
    return null;
  }
}

export function signUp(
  mode: BuilderMode,
  input: { email: string; password: string; displayName?: string },
) {
  return call<{ user: SiteUser; expiresAt: string }>(mode, "/signup", {
    method: "POST",
    body: JSON.stringify(input),
  });
}

export function signIn(mode: BuilderMode, input: { email: string; password: string }) {
  return call<{ user: SiteUser; expiresAt: string }>(mode, "/login", {
    method: "POST",
    body: JSON.stringify(input),
  });
}

/** The builder's backend revokes the session and clears the cookie; only it can, being HttpOnly. */
export async function signOut(mode: BuilderMode) {
  await call<unknown>(mode, "/logout", { method: "POST" });
  return { ok: true as const };
}

/** Paying money in. Lands in the trading balance in shared custody, the cash book in segregated. */
export function deposit(mode: BuilderMode, amountDecimal: string) {
  return call<{ balances: CustomerProfile["balances"] }>(mode, "/deposit", {
    method: "POST",
    body: JSON.stringify({ amountDecimal }),
  });
}

/** Segregated custody only: real USDC between the operations wallet and the customer's proxy. */
export function transfer(
  mode: BuilderMode,
  amountDecimal: string,
  direction: "to_predictions" | "from_predictions",
): Promise<TransferResult> {
  return call<TransferResult>(mode, "/transfer", {
    method: "POST",
    body: JSON.stringify({ amountDecimal, direction }),
  });
}

export async function fetchCashEntries(mode: BuilderMode): Promise<CashEntry[]> {
  const { data } = await call<{ data: CashEntry[] }>(mode, "/cash-entries");
  return data;
}

/** Sell shares in a position the signed-in customer holds. */
export function sellPosition(
  mode: BuilderMode,
  input: { tokenId: string; shares: number; price: number },
) {
  return call<{ id: string; submitState: string; clobStatus: string | null }>(
    mode,
    "/positions/sell",
    { method: "POST", body: JSON.stringify(input) },
  );
}

/** Redeem a resolved market. */
export function redeemPosition(mode: BuilderMode, conditionId: string) {
  return call<{ id: string; state: string; relayerTxId?: string }>(mode, "/positions/redeem", {
    method: "POST",
    body: JSON.stringify({ conditionId }),
  });
}

export function openPredictionSession(mode: BuilderMode): Promise<PredictionSession> {
  return call<PredictionSession>(mode, "/prediction-session", { method: "POST" });
}
