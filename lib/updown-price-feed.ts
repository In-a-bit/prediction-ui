import type { UpdownPriceFeed } from "@/lib/types/event";

/**
 * How the chart, metrics and live price read an Up/Down event's spot price
 * from price-service: the REST routes (/crypto/… or /finance/…, same query
 * params and response shapes) and the /ws/prices topic.
 */
export interface UpdownPriceFeedAdapter {
  /** price-service route group: `${routePrefix}/price-history`, `/candles`, `/latest`. */
  routePrefix: "/crypto" | "/finance";
  /** ?symbol= of the REST routes. */
  restSymbol: string;
  wsTopic: "crypto_prices" | "finance_prices";
  /** Symbol of the WS subscription filter and of incoming ticks. */
  wsSymbol: string;
  /** Session-based feed: no candles or ticks while the market is closed. */
  hasClosedHours: boolean;
}

export function priceFeedAdapter(feed: UpdownPriceFeed): UpdownPriceFeedAdapter {
  if (feed.kind === "finance") {
    return {
      routePrefix: "/finance",
      restSymbol: feed.assetKey,
      wsTopic: "finance_prices",
      wsSymbol: feed.assetKey,
      hasClosedHours: true,
    };
  }
  const base = feed.base.trim().toLowerCase();
  const target = (feed.target.trim() || "usdt").toLowerCase();
  return {
    routePrefix: "/crypto",
    restSymbol: base,
    wsTopic: "crypto_prices",
    wsSymbol: `${base}/${target}`,
    hasClosedHours: false,
  };
}

/** Stable key of a feed, e.g. for remounting a chart when the asset changes. */
export function priceFeedKey(feed: UpdownPriceFeed): string {
  return feed.kind === "finance"
    ? `finance:${feed.assetKey}`
    : `${feed.base}:${feed.target}`;
}
