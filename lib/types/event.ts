export interface GammaMarket {
  id: number;
  question: string;
  conditionId: string;
  slug: string;
  resolutionSource: string;
  endDate: string;
  liquidity: string;
  startDate: string;
  image: string;
  icon: string;
  description: string;
  outcomes: string;
  outcomePrices: string;
  volume: string;
  active: boolean;
  closed: boolean;
  marketMakerAddress: string;
  createdAt: string;
  updatedAt: string;
  new: boolean;
  featured: boolean;
  submitted_by: string;
  archived: boolean;
  resolvedBy: string;
  restricted: boolean;
  groupItemTitle: string;
  groupItemThreshold: string;
  questionID: string;
  enableOrderBook: boolean;
  orderPriceMinTickSize: number;
  orderMinSize: number;
  volume24hr: number;
  clobTokenIds?: string;
  umaResolutionStatus?: string;
  umaBond: string;
  umaReward: string;
  volume_num: number;
  liquidityNum: number;
  metadata?: Record<string, unknown>;
  endDateIso: string;
  startDateIso: string;
  hasReviewedDates: boolean;
  commentCount: number;
  tokenId?: string;
  bestBid?: number;
  bestAsk?: number;
  metadataType?: string;
}

/** Finance asset categories (keep in sync with prediction-go financeasset.go). */
export const FINANCE_CATEGORIES = [
  "fx",
  "metals",
  "stocks",
  "commodities",
  "indices",
] as const;

export type FinanceCategory = (typeof FINANCE_CATEGORIES)[number];

/** Where an Up/Down event's spot price comes from. */
export type UpdownPriceFeed =
  | { kind: "crypto"; base: string; target: string }
  | {
      kind: "finance";
      /** Lower-cased provider symbol, e.g. "metal.xau/usd". */
      assetKey: string;
      category: FinanceCategory | null;
    };

/** Parsed metadata of a crypto_updown or finance_updown event (one slot). */
export interface UpdownMetadata {
  feed: UpdownPriceFeed;
  interval_minutes: number;
  /** Unix seconds. */
  slot_start: number;
  /** Unix seconds. */
  slot_end: number;
  priceToBeat?: string;
}

export interface GammaSeries {
  id?: string;
  slug: string;
  title: string;
  image?: string;
  icon?: string;
  volume?: number;
  events?: GammaEvent[];
}

export interface GammaEvent {
  id: number | string;
  ticker: string;
  slug: string;
  title: string;
  description: string;
  mutuallyExclusive: boolean;
  outcomes: string;
  outcomePrices: string;
  active: boolean;
  closed: boolean;
  archived: boolean;
  new: boolean;
  featured: boolean;
  restricted: boolean;
  liquidity: number;
  volume: number;
  openInterest: number;
  createdAt: string;
  updatedAt: string;
  startDate?: string;
  startTime?: string;
  endDate: string;
  image: string;
  icon: string;
  commentCount: number;
  markets: GammaMarket[];
  tags?: { id: number; label: string; slug: string }[];
  volume24hr?: number;
  metadataType?: string;
  /** Raw metadata; Up/Down events are read through parseUpdownMetadata. */
  metadata?: Record<string, unknown>;
  series?: GammaSeries[];
}
