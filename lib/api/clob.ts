import { ClobClient } from "@polymarket/clob-client";
import type { OrderBook, PriceHistoryPoint } from "@/lib/types/orderbook";

const client = new ClobClient("https://clob.polymarket.com", 137);

export async function fetchOrderBook(tokenId: string): Promise<OrderBook> {
  const book = await client.getOrderBook(tokenId);
  return book;
}

export async function fetchMidpoint(tokenId: string): Promise<string> {
  const mid = await client.getMidpoint(tokenId);
  return mid;
}

export async function fetchPrice(tokenId: string, side: "BUY" | "SELL"): Promise<string> {
  const price = await client.getPrice(tokenId, side);
  return price;
}

export async function fetchPriceHistory(params: {
  tokenId: string;
  startTs?: number;
  endTs?: number;
  fidelity?: number;
}): Promise<PriceHistoryPoint[]> {
  const fidelity = params.fidelity ?? 60;
  let interval: string;
  if (fidelity <= 60) interval = "1m";
  else if (fidelity <= 300) interval = "5m";
  else if (fidelity <= 900) interval = "15m";
  else if (fidelity <= 3600) interval = "1h";
  else if (fidelity <= 14400) interval = "4h";
  else if (fidelity <= 86400) interval = "1d";
  else interval = "1w";

  const searchParams = new URLSearchParams();
  searchParams.set("market", params.tokenId);
  searchParams.set("interval", interval);
  if (params.startTs) searchParams.set("startTs", String(params.startTs));
  if (params.endTs) searchParams.set("endTs", String(params.endTs));
  searchParams.set("fidelity", String(fidelity));

  const res = await fetch(
    `https://clob.polymarket.com/prices-history?${searchParams}`,
    { cache: "no-store" }
  );
  if (!res.ok) return [];
  const data = await res.json();
  return data.history ?? [];
}
