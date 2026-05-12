/**
 * Same-origin WebSocket paths; Next.js rewrites `/__/go-ws/*` to prediction-go
 * with `api_key` (server env APP_API_KEY — never in client JS).
 */
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

/** Server components: build WS URL from forwarded Host / proto. */
export function predictionGoMarketWsUrlForServer(
  host: string,
  forwardedProto: string | null,
): string {
  const isHttps = forwardedProto === "https";
  const wsProto = isHttps ? "wss:" : "ws:";
  return `${wsProto}//${host}/__/go-ws/market`;
}
