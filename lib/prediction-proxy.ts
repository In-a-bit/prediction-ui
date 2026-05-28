import { gatewayHttpBase } from "./prediction-gateway-url";

/** Browser-visible base paths for prediction-go HTTP APIs (via prediction-gateway). */
export const PREDICTION_PROXY_ROOT = gatewayHttpBase();

export type PredictionProxyService =
  | "gamma"
  | "clob"
  | "relayer"
  | "dpm"
  | "data"
  | "price";

export function predictionServiceBase(service: PredictionProxyService): string {
  return `${PREDICTION_PROXY_ROOT}/${service}`;
}
