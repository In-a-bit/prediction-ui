import { useEffect, useRef } from "react";

const PING_INTERVAL_MS = 10_000;
const RECONNECT_DELAY_MS = 3_000;

type UsePushWsArgs = {
  /** Full WebSocket URL. Ignored while `enabled` is false. */
  url: string | null;
  /** When false, no connection is opened. */
  enabled: boolean;
  /** Called for each parsed JSON frame. PONG/keepalive frames are filtered. */
  onEvent: (event: Record<string, unknown>) => void;
  /** Prefix for console lines, e.g. "[Markets WS]". */
  label: string;
};

/**
 * Push-only public-ws client via the gateway. Sends periodic PING keepalives,
 * ignores PONG, forwards every JSON frame to onEvent, and reconnects on close
 * while enabled.
 */
export function usePushWs({ url, enabled, onEvent, label }: UsePushWsArgs): void {
  const onEventRef = useRef(onEvent);
  useEffect(() => {
    onEventRef.current = onEvent;
  }, [onEvent]);

  useEffect(() => {
    if (!enabled || !url) return;

    let isMounted = true;
    let closedByUs = false;
    let ws: WebSocket | null = null;
    let pingInterval: ReturnType<typeof setInterval> | null = null;
    let reconnectTimer: ReturnType<typeof setTimeout> | null = null;

    const connect = () => {
      if (!isMounted) return;
      closedByUs = false;
      ws = new WebSocket(url);

      ws.onopen = () => {
        console.log(`${label} connected`);
        pingInterval = setInterval(() => {
          if (ws?.readyState === WebSocket.OPEN) ws.send("PING");
        }, PING_INTERVAL_MS);
      };

      ws.onmessage = (event) => {
        if (event.data === "PONG") return;
        try {
          const parsed = JSON.parse(event.data as string) as unknown;
          if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) {
            onEventRef.current(parsed as Record<string, unknown>);
          }
        } catch (err) {
          console.error(`${label} failed to parse message:`, event.data, err);
        }
      };

      ws.onerror = () => {
        if (closedByUs || !isMounted) return;
        console.warn(`${label} socket error; waiting for close`);
      };

      ws.onclose = () => {
        if (pingInterval) clearInterval(pingInterval);
        pingInterval = null;
        if (!isMounted || closedByUs) return;
        console.log(`${label} disconnected; reconnecting soon…`);
        reconnectTimer = setTimeout(connect, RECONNECT_DELAY_MS);
      };
    };

    connect();

    return () => {
      isMounted = false;
      closedByUs = true;
      if (pingInterval) clearInterval(pingInterval);
      if (reconnectTimer) clearTimeout(reconnectTimer);
      ws?.close();
    };
  }, [url, enabled, label]);
}
