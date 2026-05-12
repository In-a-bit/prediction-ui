/**
 * Browser-visible base paths for prediction-go HTTP APIs.
 * Next.js route handlers forward to real upstreams and attach X-API-Key (server-only).
 */
export const PREDICTION_PROXY_ROOT = "/api/prediction";

export type PredictionProxyService =
  | "gamma"
  | "clob"
  | "relayer"
  | "dpm"
  | "data";

export function predictionServiceBase(service: PredictionProxyService): string {
  return `${PREDICTION_PROXY_ROOT}/${service}`;
}
