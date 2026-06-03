/** Polymarket-shaped payload from order-engine → public-ws (libs/mq/market_resolved.go). */
export interface MarketResolvedWsEvent {
  event_type: "market_resolved";
  /** Numeric DB market id. */
  id?: string;
  question?: string;
  /** Condition id (0x-prefixed), not the numeric market id. */
  market?: string;
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

function normalizeConditionId(raw: string): string {
  const s = raw.trim().toLowerCase();
  return s.startsWith("0x") ? s : `0x${s}`;
}

export function parseMarketResolvedEvent(
  data: Record<string, unknown>,
): MarketResolvedWsEvent | null {
  if (data.event_type !== "market_resolved") return null;
  return {
    event_type: "market_resolved",
    id: optionalString(data.id),
    question: optionalString(data.question),
    market: optionalString(data.market),
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
    evt.id ?? "",
    evt.market ?? "",
    evt.winning_asset_id ?? "",
    evt.timestamp ?? "",
  ].join("|");
}

export function marketResolvedMatchesSubscription(
  evt: MarketResolvedWsEvent,
  market: { id?: number | string; conditionId?: string } | undefined,
  tokenIds: string[],
): boolean {
  if (market?.id != null && evt.id != null && String(evt.id) === String(market.id)) {
    return true;
  }
  if (market?.conditionId && evt.market) {
    if (
      normalizeConditionId(evt.market) ===
      normalizeConditionId(market.conditionId)
    ) {
      return true;
    }
  }
  const assets = evt.assets_ids ?? [];
  return assets.some((id) => tokenIds.includes(id));
}
