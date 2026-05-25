import { predictionGoMarketWsUrl } from "./prediction-gateway-url";

export {
  gatewayOrigin,
  gatewayHttpBase,
  gatewayWsBase,
  predictionGoMarketWsUrl,
  predictionGoUserWsUrl,
} from "./prediction-gateway-url";

/** @deprecated Use predictionGoMarketWsUrl — kept for layout.tsx during migration. */
export function predictionGoMarketWsUrlForServer(
  _host: string,
  _forwardedProto: string | null,
): string {
  return predictionGoMarketWsUrl();
}
