/**
 * Base URL for prediction-gateway (HTTP + WebSocket). Replaces same-origin Next.js proxy paths.
 */
const DEFAULT_GATEWAY_ORIGIN = "http://localhost:2040";

export function gatewayOrigin(): string {
  const raw =
    process.env.NEXT_PUBLIC_PREDICTION_GATEWAY_URL?.trim() ||
    process.env.PREDICTION_GATEWAY_URL?.trim() ||
    DEFAULT_GATEWAY_ORIGIN;
  return raw.replace(/\/$/, "");
}

export function gatewayHttpBase(): string {
  return `${gatewayOrigin()}/api/prediction`;
}

export function gatewayWsBase(): string {
  return gatewayOrigin().replace(/^http/i, "ws");
}

export function predictionGoMarketWsUrl(): string {
  return `${gatewayWsBase()}/ws/market`;
}

export function predictionGoUserWsUrl(): string {
  return `${gatewayWsBase()}/ws/user`;
}

export function predictionGoPricesWsUrl(): string {
  return `${gatewayWsBase()}/ws/prices`;
}

/**
 * Builder-scoped activity stream. The builder publishable key is passed as a
 * query parameter because browser WebSockets cannot set custom headers on the
 * upgrade request; the gateway forwards it to public-ws.
 */
export function predictionGoActivityWsUrl(builderKey: string): string {
  return `${gatewayWsBase()}/ws/activity?builder_api_key=${encodeURIComponent(builderKey)}`;
}
