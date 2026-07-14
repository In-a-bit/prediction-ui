/**
 * Direct prediction-go service URLs for the LP demo (bypasses prediction-gateway).
 * Auth: X-LP-Api-Key (access) + X-LP-Address (authorization) — no APP_API_KEY.
 */

export type LpGoService =
  | "gamma"
  | "clob"
  | "relayer"
  | "dpm"
  | "data"
  | "price";

export const LP_API_KEY_HEADER = "X-LP-Api-Key";
export const LP_ADDRESS_HEADER = "X-LP-Address";

/** Browser WS cannot set headers; prediction-go should accept these query params. */
export const LP_API_KEY_QUERY = "lp_api_key";
export const LP_ADDRESS_QUERY = "lp_address";

function trimSlash(s: string): string {
  return s.replace(/\/$/, "");
}

function envOr(keys: string[], fallback: string): string {
  for (const key of keys) {
    const v = process.env[key]?.trim();
    if (v) return trimSlash(v);
  }
  return trimSlash(fallback);
}

/** Upstream HTTP base URL for a prediction-go service (server-side). */
export function lpUpstreamBase(service: LpGoService): string {
  switch (service) {
    case "gamma":
      return envOr(["GAMMA_API_URL", "LP_GAMMA_API_URL"], "http://localhost:8084");
    case "clob":
      return envOr(["CLOB_API_URL", "LP_CLOB_API_URL"], "http://localhost:8083");
    case "relayer":
      return envOr(["RELAYER_API_URL", "LP_RELAYER_API_URL"], "http://localhost:8085");
    case "dpm":
      return envOr(["DPM_API_URL", "LP_DPM_API_URL"], "http://localhost:8086");
    case "data":
      return envOr(["DATA_API_URL", "LP_DATA_API_URL"], "http://localhost:8091");
    case "price":
      return envOr(
        ["PRICE_SERVICE_URL", "LP_PRICE_SERVICE_URL"],
        "http://localhost:8093",
      );
    default: {
      const _exhaustive: never = service;
      return _exhaustive;
    }
  }
}

/** Same-origin Next proxy path the browser uses for LP HTTP. */
export function lpBrowserServiceBase(service: LpGoService): string {
  return `/api/lp/go/${service}`;
}

function wsOrigin(httpLike: string): string {
  return trimSlash(httpLike).replace(/^http/i, "ws");
}

export function lpPublicWsOrigin(): string {
  return wsOrigin(
    envOr(["PUBLIC_WS_URL", "LP_PUBLIC_WS_URL"], "http://localhost:8090"),
  );
}

export function lpUserWsOrigin(): string {
  return wsOrigin(
    envOr(["USER_WS_URL", "LP_USER_WS_URL"], "http://localhost:8088"),
  );
}

/** Browser-usable WS URLs with LP credentials in the query string. */
export function lpWsUrlsWithLpAuth(apiKey: string, address: string): {
  market: string;
  prices: string;
  user: string;
} {
  // public-ws access gate only needs the LP API key (no address).
  const publicQ = new URLSearchParams({
    [LP_API_KEY_QUERY]: apiKey,
  }).toString();
  const userQ = new URLSearchParams({
    [LP_API_KEY_QUERY]: apiKey,
    [LP_ADDRESS_QUERY]: address,
  }).toString();
  const pub = lpPublicWsOrigin();
  const user = lpUserWsOrigin();
  return {
    market: `${pub}/ws/market?${publicQ}`,
    prices: `${pub}/ws/prices?${publicQ}`,
    user: `${user}/ws/user?${userQ}`,
  };
}
