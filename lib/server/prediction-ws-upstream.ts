/** Defaults match prediction-go `.env.example` when ports are unset. */
const DEFAULT_PUBLIC_WS_PORT = "8090";
const DEFAULT_USER_WS_PORT = "8088";

function trimSlash(s: string): string {
  return s.replace(/\/$/, "");
}

/** Full HTTP rewrite destination for market WS (includes `api_key` query). */
export function goWsMarketRewriteDestination(): string | null {
  const appKey = process.env.APP_API_KEY;
  if (!appKey) return null;
  const fromEnv = process.env.PUBLIC_WS_REWRITE_ORIGIN?.trim();
  const origin = fromEnv
    ? trimSlash(fromEnv)
    : `http://127.0.0.1:${process.env.PUBLIC_WS_PORT ?? DEFAULT_PUBLIC_WS_PORT}`;
  return `${origin}/ws/market?api_key=${encodeURIComponent(appKey)}`;
}

/** Full HTTP rewrite destination for user WS (includes `api_key` query). */
export function goWsUserRewriteDestination(): string | null {
  const appKey = process.env.APP_API_KEY;
  if (!appKey) return null;
  const fromEnv = process.env.USER_WS_REWRITE_ORIGIN?.trim();
  const origin = fromEnv
    ? trimSlash(fromEnv)
    : `http://127.0.0.1:${process.env.USER_WS_PORT ?? DEFAULT_USER_WS_PORT}`;
  return `${origin}/ws/user?api_key=${encodeURIComponent(appKey)}`;
}
