/**
 * Browser paths to the Next.js proxy that forwards to prediction-go with APP_API_KEY (server-side).
 * Configure upstream origins with CLOB_API_ORIGIN, GAMMA_API_ORIGIN, etc. (see .env.example).
 */
export const PG = {
  clob: "/api/go/clob",
  gamma: "/api/go/gamma",
  dpm: "/api/go/dpm",
  data: "/api/go/data",
  relayer: "/api/go/relayer",
} as const;

export type PredictionGoBackend = keyof typeof PG;

/** Join proxy base and an API path (must start with `/` for the path segment). */
export function pgUrl(base: string, path: string): string {
  const p = path.startsWith("/") ? path : `/${path}`;
  return `${base}${p}`;
}

/** Same-origin WebSocket URL; Next.js rewrites `/__/go-ws/*` to prediction-go with api_key. */
export function predictionGoMarketWsUrl(): string {
  if (typeof window !== "undefined" && window.location?.host) {
    const wsProto = window.location.protocol === "https:" ? "wss:" : "ws:";
    return `${wsProto}//${window.location.host}/__/go-ws/market`;
  }
  return "ws://127.0.0.1:2030/__/go-ws/market";
}

export function predictionGoUserWsUrl(): string {
  if (typeof window !== "undefined" && window.location?.host) {
    const wsProto = window.location.protocol === "https:" ? "wss:" : "ws:";
    return `${wsProto}//${window.location.host}/__/go-ws/user`;
  }
  return "ws://127.0.0.1:2030/__/go-ws/user";
}
