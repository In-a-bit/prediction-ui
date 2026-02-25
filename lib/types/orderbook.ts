export interface OrderBookEntry {
  price: string;
  size: string;
}

export interface OrderBook {
  market: string;
  asset_id: string;
  hash: string;
  timestamp: string;
  bids: OrderBookEntry[];
  asks: OrderBookEntry[];
}

export interface PriceHistoryPoint {
  t: number;
  p: number;
}

export interface PriceResponse {
  price: string;
}

export interface MidpointResponse {
  mid: string;
}
