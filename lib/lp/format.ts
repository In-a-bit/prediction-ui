export const LP_SESSION_COOKIE = "lp_demo_session";

export function truncateApiKey(apiKey: string): string {
  const k = apiKey.trim();
  if (k.length <= 10) return k;
  return `${k.slice(0, 4)}…${k.slice(-4)}`;
}

export function truncateAddress(address: string): string {
  const a = address.trim();
  if (a.length < 10) return a;
  return `${a.slice(0, 6)}…${a.slice(-4)}`;
}
