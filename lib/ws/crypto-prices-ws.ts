import WebSocket from "isomorphic-ws";

import { predictionGoPricesWsUrl } from "@/lib/prediction-gateway-url";

const RECONNECT_BASE_DELAY = 1_000;
const RECONNECT_MAX_DELAY = 30_000;

export type CryptoPriceTick = {
  symbol: string;
  timestamp: number;
  value: number;
};

export type CryptoPriceTickCallback = (tick: CryptoPriceTick) => void;

export class CryptoPricesWS {
  private wsUrl: string;
  private ws: WebSocket | null = null;
  private symbol: string | null = null;
  private listeners = new Set<CryptoPriceTickCallback>();
  private reconnectTimer: ReturnType<typeof setTimeout> | null = null;
  private reconnectAttempt = 0;
  private destroyed = false;

  constructor(wsUrl?: string) {
    this.wsUrl = wsUrl?.trim() || predictionGoPricesWsUrl();
  }

  connect(symbol: string) {
    if (this.destroyed) return;
    const normalized = symbol.toLowerCase();
    if (this.symbol === normalized && this.ws?.readyState === WebSocket.OPEN) {
      return;
    }
    this.symbol = normalized;
    this.openConnection();
  }

  onTick(callback: CryptoPriceTickCallback) {
    this.listeners.add(callback);
    return () => this.listeners.delete(callback);
  }

  destroy() {
    this.destroyed = true;
    this.clearReconnect();
    if (!this.ws) {
      this.listeners.clear();
      this.symbol = null;
      return;
    }

    const ws = this.ws;
    this.ws = null;
    ws.onopen = null;
    ws.onmessage = null;
    ws.onerror = null;
    ws.onclose = null;

    if (ws.readyState === WebSocket.CONNECTING) {
      // Closing during CONNECTING logs "closed before connection established".
      ws.addEventListener(
        "open",
        () => {
          ws.close();
        },
        { once: true },
      );
    } else if (ws.readyState === WebSocket.OPEN) {
      ws.close();
    }

    this.listeners.clear();
    this.symbol = null;
  }

  private openConnection() {
    if (
      this.ws?.readyState === WebSocket.OPEN ||
      this.ws?.readyState === WebSocket.CONNECTING
    ) {
      if (this.symbol && this.ws?.readyState === WebSocket.OPEN) {
        this.sendSubscribe(this.symbol);
      }
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
      if (this.symbol) this.sendSubscribe(this.symbol);
    };

    this.ws.onmessage = (event: WebSocket.MessageEvent) => {
      this.handleMessage(String(event.data));
    };

    this.ws.onclose = () => {
      if (!this.destroyed) this.scheduleReconnect();
    };

    this.ws.onerror = () => {
      // onclose handles reconnect
    };
  }

  private handleMessage(raw: string) {
    if (!raw.startsWith("{")) return;

    let msg: Record<string, unknown>;
    try {
      msg = JSON.parse(raw) as Record<string, unknown>;
    } catch {
      return;
    }

    if (msg.type === "error") return;

    const payload = msg.payload as Record<string, unknown> | undefined;
    if (!payload) return;

    const symbol = String(payload.symbol ?? "").toLowerCase();
    if (!symbol || (this.symbol && symbol !== this.symbol)) return;

    const value = Number(payload.value);
    // Outer timestamp is server publish time (~2s); payload.timestamp is the 1m bucket open.
    const timestamp = Number(msg.timestamp ?? payload.timestamp);
    if (!Number.isFinite(value) || !Number.isFinite(timestamp)) return;

    const tick: CryptoPriceTick = { symbol, timestamp, value };
    for (const cb of this.listeners) cb(tick);
  }

  private sendSubscribe(symbol: string) {
    if (this.ws?.readyState !== WebSocket.OPEN) return;
    this.ws.send(
      JSON.stringify({
        action: "subscribe",
        subscriptions: [
          {
            topic: "crypto_prices",
            type: "update",
            filters: JSON.stringify({ symbol }),
          },
        ],
      }),
    );
  }

  private scheduleReconnect() {
    if (this.destroyed || this.reconnectTimer) return;
    const delay = Math.min(
      RECONNECT_BASE_DELAY * 2 ** this.reconnectAttempt,
      RECONNECT_MAX_DELAY,
    );
    this.reconnectAttempt++;
    this.reconnectTimer = setTimeout(() => {
      this.reconnectTimer = null;
      this.ws = null;
      this.openConnection();
    }, delay);
  }

  private clearReconnect() {
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }
  }
}
