const DPM_API_URL =
  process.env.NEXT_PUBLIC_DPM_API_URL ?? "http://localhost:8086";

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
): Promise<CollateralBalanceResponse | null> {
  const url = new URL(`${DPM_API_URL}/collateral/balance`);
  url.searchParams.set("address", address);
  const res = await fetch(url.toString());
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
export async function getConditionalTokenBalanceBatch(
  owners: string[],
  ids: string[],
): Promise<ConditionalTokenBalanceBatchResponse | null> {
  const res = await fetch(`${DPM_API_URL}/conditional-tokens/balance-batch`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ owners, ids }),
  });
  if (!res.ok) return null;
  return res.json() as Promise<ConditionalTokenBalanceBatchResponse>;
}
