const DPM_API_URL =
  process.env.NEXT_PUBLIC_DPM_API_URL ?? "http://localhost:8085";

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
