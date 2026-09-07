"use client";

import type {
  BuilderMode,
  BuilderSiteConfig,
  CashEntry,
  CustomerProfile,
  ManagedPositions,
  ManagedUser,
  PredictionSession,
  TransferResult,
  Treasury,
  TreasuryWallet,
} from "./types";

/**
 * The browser's view of a builder's site.
 *
 * Everything goes through this app's own `/api/builder/...` routes rather than to the builder
 * directly — the session token lives in an httpOnly cookie the page cannot read, and attaching it
 * is the proxy's job.
 */
async function call<T>(mode: BuilderMode, path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(`/api/builder/${mode}${path}`, {
    ...init,
    headers: { "Content-Type": "application/json", ...(init?.headers ?? {}) },
  });
  const text = await response.text();
  const body = text ? (JSON.parse(text) as unknown) : null;
  if (!response.ok) throw new Error(message(body) ?? `Request failed (${response.status})`);
  return body as T;
}

/** Every service in this demo answers with `{error:{message}}`; Next's own routes with `{error}`. */
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

export function fetchSiteConfig(mode: BuilderMode): Promise<BuilderSiteConfig> {
  return call<BuilderSiteConfig>(mode, "/site/config");
}

/** Resolves to null when nobody is signed in, which is an answer rather than a failure. */
export async function fetchProfile(mode: BuilderMode): Promise<CustomerProfile | null> {
  try {
    return await call<CustomerProfile>(mode, "/site/me");
  } catch {
    return null;
  }
}

export function signUp(
  mode: BuilderMode,
  input: { email: string; password: string; displayName?: string },
) {
  return call<{ user: CustomerProfile }>(mode, "/auth", {
    method: "POST",
    body: JSON.stringify({ action: "signup", ...input }),
  });
}

export function signIn(mode: BuilderMode, input: { email: string; password: string }) {
  return call<{ user: CustomerProfile }>(mode, "/auth", {
    method: "POST",
    body: JSON.stringify({ action: "login", ...input }),
  });
}

export function signOut(mode: BuilderMode) {
  return call<{ ok: true }>(mode, "/auth", {
    method: "POST",
    body: JSON.stringify({ action: "logout" }),
  });
}

/** Paying money in. Lands in the trading balance in shared custody, the cash book in segregated. */
export function deposit(mode: BuilderMode, amountDecimal: string) {
  return call<{ balances: CustomerProfile["balances"] }>(mode, "/site/deposit", {
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
  return call<TransferResult>(mode, "/site/transfer", {
    method: "POST",
    body: JSON.stringify({ amountDecimal, direction }),
  });
}

export async function fetchCashEntries(mode: BuilderMode): Promise<CashEntry[]> {
  const { data } = await call<{ data: CashEntry[] }>(mode, "/site/cash-entries");
  return data;
}

// ── The builder's back office ────────────────────────────────────────────────

export async function fetchManagedUsers(mode: BuilderMode): Promise<ManagedUser[]> {
  const { data } = await call<{ data: ManagedUser[]; total: number }>(mode, "/manage/users");
  return data;
}

/**
 * One customer's holdings, fetched when their row is opened rather than with the table.
 *
 * Naming a token takes an upstream call per market, so doing it for every row would make the
 * table's cost scale with the customer list to render figures nobody has asked to see yet.
 */
export function fetchCustomerPositions(
  mode: BuilderMode,
  userId: string,
): Promise<ManagedPositions> {
  return call<ManagedPositions>(mode, `/manage/users/${userId}/positions`);
}

/**
 * Sell shares, and redeem a resolved market.
 *
 * Two surfaces, one behaviour: a customer acting on their own position goes through `/site/…` with
 * their session, an operator acting for them goes through `/manage/…` with the admin key. Both land
 * on the same Plaee call, so the custody routing cannot differ by who asked.
 */
export function sellPosition(
  mode: BuilderMode,
  input: { tokenId: string; shares: number; price: number },
  userId?: string,
) {
  const path = userId ? `/manage/users/${userId}/positions/sell` : "/site/positions/sell";
  return call<{ id: string; submitState: string; clobStatus: string | null }>(mode, path, {
    method: "POST",
    body: JSON.stringify(input),
  });
}

export function redeemPosition(mode: BuilderMode, conditionId: string, userId?: string) {
  const path = userId ? `/manage/users/${userId}/positions/redeem` : "/site/positions/redeem";
  return call<{ id: string; state: string; relayerTxId?: string }>(mode, path, {
    method: "POST",
    body: JSON.stringify({ conditionId }),
  });
}

export function adjustCustomer(
  mode: BuilderMode,
  userId: string,
  amountDecimal: string,
  reason: string,
) {
  return call<{ balanceMicro: string }>(mode, `/manage/users/${userId}/adjust`, {
    method: "POST",
    body: JSON.stringify({ amountDecimal, reason }),
  });
}

export function fetchTreasury(mode: BuilderMode) {
  return call<{ treasury: Treasury | null; error: string | null }>(mode, "/manage/treasury");
}

export function fetchWallets(mode: BuilderMode): Promise<TreasuryWallet[]> {
  return call<TreasuryWallet[]>(mode, "/manage/wallets");
}

export function transferTreasury(
  mode: BuilderMode,
  amountDecimal: string,
  direction: "to_operations" | "to_master",
) {
  return call<{ id: string; state: string; relayerTxId?: string }>(
    mode,
    "/manage/treasury/transfers",
    { method: "POST", body: JSON.stringify({ amountDecimal, direction }) },
  );
}

export function openPredictionSession(mode: BuilderMode): Promise<PredictionSession> {
  return call<PredictionSession>(mode, "/site/prediction-session", { method: "POST" });
}
