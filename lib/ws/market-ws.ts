import WebSocket from "isomorphic-ws";

const DEFAULT_WS_URL = "wss://ws-subscriptions-clob.polymarket.com/ws/market";
const LOCAL_MARKET_PATH = "/ws/market";

/** prediction-go public-ws listens on /ws/market; env often sets only host:port. */
export function normalizeMarketWebSocketUrl(raw: string): string {
  const trimmed = raw.trim();
  if (!trimmed) return DEFAULT_WS_URL;
  try {
    const u = new URL(trimmed);
    if (!u.pathname || u.pathname === "/") {
      u.pathname = LOCAL_MARKET_PATH;
    }
    return u.href;
  } catch {
    return trimmed;
  }
}

const PING_INTERVAL = 10_000;
const RECONNECT_BASE_DELAY = 1_000;
const RECONNECT_MAX_DELAY = 30_000;

export type MarketEventType =
  | "book"
  | "price_change"
  | "last_trade_price"
  | "best_bid_ask";

export type MarketEventCallback = (data: Record<string, unknown>) => void;

export class MarketWS {
  private wsUrl: string;
  private ws: WebSocket | null = null;
  private subscribedTokens = new Set<string>();
  private listeners = new Map<MarketEventType, Set<MarketEventCallback>>();
  private pingTimer: ReturnType<typeof setInterval> | null = null;
  private reconnectTimer: ReturnType<typeof setTimeout> | null = null;
  private reconnectAttempt = 0;
  private destroyed = false;

  constructor(wsUrl?: string) {
    const custom = wsUrl?.trim();
    this.wsUrl = custom ? normalizeMarketWebSocketUrl(custom) : DEFAULT_WS_URL;
  }

  connect(tokenIds: string[]) {
    if (this.destroyed) return;
    tokenIds.forEach((id) => this.subscribedTokens.add(id));
    this.openConnection();
  }

  subscribe(tokenIds: string[]) {
    const newIds = tokenIds.filter((id) => !this.subscribedTokens.has(id));
    if (newIds.length === 0) return;
    newIds.forEach((id) => this.subscribedTokens.add(id));
    if (this.ws?.readyState === WebSocket.OPEN) {
      this.sendSubscription(newIds);
    }
  }

  unsubscribe(tokenIds: string[]) {
    tokenIds.forEach((id) => this.subscribedTokens.delete(id));
  }

  on(eventType: MarketEventType, callback: MarketEventCallback) {
    if (!this.listeners.has(eventType)) {
      this.listeners.set(eventType, new Set());
    }
    this.listeners.get(eventType)!.add(callback);
  }

  off(eventType: MarketEventType, callback: MarketEventCallback) {
    this.listeners.get(eventType)?.delete(callback);
  }

  get isConnected() {
    return this.ws?.readyState === WebSocket.OPEN;
  }

  destroy() {
    this.destroyed = true;
    this.clearTimers();
    if (this.ws) {
      this.ws.onclose = null;
      this.ws.close();
      this.ws = null;
    }
    this.listeners.clear();
    this.subscribedTokens.clear();
  }

  private openConnection() {
    if (this.ws?.readyState === WebSocket.OPEN || this.ws?.readyState === WebSocket.CONNECTING) {
      return;
    }

    try {
      this.ws = new WebSocket(this.wsUrl);
    } catch {
      this.scheduleReconnect();
      return;
    }

    this.ws.onopen = () => {
      this.reconnectAttempt = 0;
      this.startPing();
      if (this.subscribedTokens.size > 0) {
        this.sendSubscription([...this.subscribedTokens]);
      }
    };

    this.ws.onmessage = (event: WebSocket.MessageEvent) => {
      const raw = String(event.data);
      if (!raw.startsWith("[") && !raw.startsWith("{")) return;

      let parsed: unknown;
      try {
        parsed = JSON.parse(raw);
      } catch {
        return;
      }

      const messages = Array.isArray(parsed) ? parsed : [parsed];
      for (const msg of messages) {
        if (msg && typeof msg === "object") {
          this.handleMessage(msg as Record<string, unknown>);
        }
      }
    };

    this.ws.onclose = () => {
      this.stopPing();
      if (!this.destroyed) {
        this.scheduleReconnect();
      }
    };

    this.ws.onerror = () => {
      // onclose will fire after onerror, triggering reconnect
    };
  }

  private handleMessage(msg: Record<string, unknown>) {
    const eventType = msg.event_type as MarketEventType | undefined;
    if (!eventType) return;

    // price_change events nest per-asset data inside a price_changes array.
    // Flatten them into individual events so consumers get a consistent shape
    // with asset_id, best_bid, best_ask at the top level.
    if (eventType === "price_change" && Array.isArray(msg.price_changes)) {
      const callbacks = this.listeners.get("price_change");
      if (!callbacks) return;
      for (const change of msg.price_changes as Record<string, unknown>[]) {
        const assetId = change.asset_id as string | undefined;
        if (assetId && !this.subscribedTokens.has(assetId)) continue;
        const flattened = {
          ...change,
          event_type: "price_change",
          timestamp: msg.timestamp,
        };
        for (const cb of callbacks) {
          cb(flattened);
        }
      }
      return;
    }

    const assetId = msg.asset_id as string | undefined;
    if (assetId && !this.subscribedTokens.has(assetId)) return;

    const callbacks = this.listeners.get(eventType);
    if (callbacks) {
      for (const cb of callbacks) {
        cb(msg);
      }
    }
  }

  private sendSubscription(tokenIds: string[]) {
    if (this.ws?.readyState !== WebSocket.OPEN) return;
    this.ws.send(
      JSON.stringify({
        assets_ids: tokenIds,
        type: "market",
        custom_feature_enabled: true,
      })
    );
  }

  private startPing() {
    this.stopPing();
    this.pingTimer = setInterval(() => {
      if (this.ws?.readyState === WebSocket.OPEN) {
        this.ws.send("PING");
      }
    }, PING_INTERVAL);
  }

  private stopPing() {
    if (this.pingTimer) {
      clearInterval(this.pingTimer);
      this.pingTimer = null;
    }
  }

  private scheduleReconnect() {
    if (this.destroyed || this.reconnectTimer) return;
    const delay = Math.min(
      RECONNECT_BASE_DELAY * Math.pow(2, this.reconnectAttempt),
      RECONNECT_MAX_DELAY
    );
    this.reconnectAttempt++;
    this.reconnectTimer = setTimeout(() => {
      this.reconnectTimer = null;
      this.openConnection();
    }, delay);
  }

  private clearTimers() {
    this.stopPing();
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }
  }
}
