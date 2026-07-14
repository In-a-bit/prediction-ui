import { predictionServiceBase } from "@/lib/prediction-proxy";

function resolveDpmBase(override?: string): string {
  return (override ?? predictionServiceBase("dpm")).replace(/\/$/, "");
}

function dpmPath(path: string, dpmBase?: string): string {
  const p = path.startsWith("/") ? path : `/${path}`;
  return `${resolveDpmBase(dpmBase)}${p}`;
}

export type CollateralBalanceResponse = {
  address: string;
  balance_raw: string;
  balance_normalized: string;
  decimals: number;
};

/**
 * Fetches collateral token balance for the given address.
 * GET /collateral/balance?address=0x...
 */
export async function getCollateralBalance(
  address: string,
  dpmBase?: string,
): Promise<CollateralBalanceResponse | null> {
  const qs = new URLSearchParams({ address });
  const res = await fetch(`${dpmPath("/collateral/balance", dpmBase)}?${qs}`);
  if (!res.ok) return null;
  return res.json() as Promise<CollateralBalanceResponse>;
}

export type ConditionalTokenBalanceItem = {
  address: string;
  token_id: string;
  balance: string;
};

export type ConditionalTokenBalanceBatchResponse = {
  balances: ConditionalTokenBalanceItem[];
};

/**
 * Fetches conditional token balances for (owner, tokenId) pairs in one call.
 * POST /conditional-tokens/balance-batch
 */
export type UserBalanceResponse = {
  usdc_balance: string;
  usdc_allowance: string | null;
  block_number: number;
  updated_at: string;
};

export type EngineBalanceResponse = {
  usdc_balance: string;
  usdc_locked: string;
  usdc_allowance: string | null;
};

export type UserDetailResponse = {
  id: number;
  address: string;
  proxy_wallet: string;
  balance: UserBalanceResponse | null;
  engine_balance: EngineBalanceResponse | null;
};

export async function getUserDetailedBalance(
  proxyWallet: string,
  dpmBase?: string,
): Promise<UserDetailResponse | null> {
  const qs = new URLSearchParams({
    proxy_wallet: proxyWallet,
    limit: "1",
  });
  try {
    const res = await fetch(`${dpmPath("/users", dpmBase)}?${qs}`);
    if (!res.ok) return null;
    const json = await res.json();
    const users = json.data as UserDetailResponse[];
    return users?.[0] ?? null;
  } catch {
    return null;
  }
}

export type TokenBalanceDetail = {
  token_id: string;
  balance: string;
  block_number?: number;
  updated_at?: string;
  engine_balance?: string;
  engine_locked?: string;
};

export type UserTokenBalancesResponse = {
  user_id: number;
  address: string;
  balances: TokenBalanceDetail[];
};

export async function getUserTokenBalances(
  userId: number,
  dpmBase?: string,
): Promise<UserTokenBalancesResponse | null> {
  try {
    const res = await fetch(dpmPath(`/users/${userId}/token-balances`, dpmBase));
    if (!res.ok) return null;
    return res.json() as Promise<UserTokenBalancesResponse>;
  } catch {
    return null;
  }
}

export async function getConditionalTokenBalanceBatch(
  owners: string[],
  ids: string[],
  dpmBase?: string,
): Promise<ConditionalTokenBalanceBatchResponse | null> {
  let res: Response;
  try {
    res = await fetch(dpmPath("/conditional-tokens/balance-batch", dpmBase), {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ owners, ids }),
    });
  } catch (err) {
    console.error("[dpm-api] balance-batch network error:", err);
    return null;
  }
  if (!res.ok) {
    const body = await res.text().catch(() => "");
    console.error(`[dpm-api] balance-batch failed (${res.status}):`, body);
    return null;
  }
  return res.json() as Promise<ConditionalTokenBalanceBatchResponse>;
}
