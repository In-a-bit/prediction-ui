/** market_resolved payload from order-engine → public-ws. */
export interface MarketResolvedWsEvent {
  event_type: "market_resolved";
  question?: string;
  /** Numeric engine/DB market id. */
  market?: string;
  condition_id?: string;
  winning_outcome?: string;
  winning_asset_id?: string;
  assets_ids?: string[];
  outcomes?: string[];
  timestamp?: string;
}

function optionalString(value: unknown): string | undefined {
  return typeof value === "string" ? value : undefined;
}

function optionalStringArray(value: unknown): string[] | undefined {
  if (!Array.isArray(value)) return undefined;
  return value.filter((item): item is string => typeof item === "string");
}

export function parseMarketResolvedEvent(
  data: Record<string, unknown>,
): MarketResolvedWsEvent | null {
  if (data.event_type !== "market_resolved") return null;
  return {
    event_type: "market_resolved",
    question: optionalString(data.question),
    market: optionalString(data.market),
    condition_id: optionalString(data.condition_id),
    winning_outcome: optionalString(data.winning_outcome),
    winning_asset_id: optionalString(data.winning_asset_id),
    assets_ids: optionalStringArray(data.assets_ids),
    outcomes: optionalStringArray(data.outcomes),
    timestamp: optionalString(data.timestamp),
  };
}

/** Dedupes fan-out: public-ws delivers one copy per subscribed assets_ids entry. */
export function marketResolvedEventKey(
  evt: MarketResolvedWsEvent,
): string {
  return [
    evt.market ?? "",
    evt.winning_asset_id ?? "",
    evt.timestamp ?? "",
  ].join("|");
}

export function marketResolvedMatchesSubscription(
  evt: MarketResolvedWsEvent,
  market: { id?: number | string } | undefined,
  tokenIds: string[],
): boolean {
  const marketId = market?.id != null ? String(market.id) : undefined;
  if (marketId && evt.market != null && evt.market === marketId) {
    return true;
  }
  const assets = evt.assets_ids ?? [];
  return assets.some((id) => tokenIds.includes(id));
}
