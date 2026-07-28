import { useEffect, useRef } from "react";

import { predictionGoActivityWsUrl } from "@/lib/prediction-go";

/** A single order-activity frame as delivered over /ws/activity. */
export type ActivityEvent = {
  event_type: string;
  data: Record<string, unknown> & { timestamp?: number; status?: string; id?: string };
};

type UseActivityWsArgs = {
  /** Builder publishable key; the stream is scoped to this builder. */
  builderKey: string | null;
  /** When false, no connection is opened. */
  enabled: boolean;
  /** Called for each parsed activity frame (PONG/keepalive frames are filtered). */
  onEvent: (event: ActivityEvent) => void;
};

const PING_INTERVAL_MS = 10_000;
const RECONNECT_DELAY_MS = 3_000;

/**
 * Subscribes to the builder-scoped activity WebSocket (/ws/activity via the
 * gateway). Server-push only: it sends periodic PING keepalives, ignores PONG,
 * forwards every JSON frame to onEvent, and reconnects on close while enabled.
 *
 * In React Strict Mode (dev) the effect mounts twice: the first socket is closed
 * on cleanup. That close can fire `onerror` with an empty Event — we treat it as
 * intentional teardown and stay quiet.
 */
export function useActivityWs({ builderKey, enabled, onEvent }: UseActivityWsArgs): void {
  const onEventRef = useRef(onEvent);
  onEventRef.current = onEvent;

  useEffect(() => {
    if (!enabled || !builderKey) return;

    let isMounted = true;
    let closedByUs = false;
    let ws: WebSocket | null = null;
    let pingInterval: ReturnType<typeof setInterval> | null = null;
    let reconnectTimer: ReturnType<typeof setTimeout> | null = null;

    const connect = () => {
      if (!isMounted) return;
      closedByUs = false;
      const url = predictionGoActivityWsUrl(builderKey);
      ws = new WebSocket(url);

      ws.onopen = () => {
        console.log("[Activity WS] connected");
        pingInterval = setInterval(() => {
          if (ws?.readyState === WebSocket.OPEN) ws.send("PING");
        }, PING_INTERVAL_MS);
      };

      ws.onmessage = (event) => {
        if (event.data === "PONG") return;
        try {
          const parsed = JSON.parse(event.data as string) as ActivityEvent;
          onEventRef.current(parsed);
        } catch (err) {
          console.error("[Activity WS] failed to parse message:", event.data, err);
        }
      };

      // Browser WebSocket error events carry no useful fields (console shows {}).
      // Real failure mode is onclose; skip noise from intentional teardown.
      ws.onerror = () => {
        if (closedByUs || !isMounted) return;
        console.warn("[Activity WS] socket error; waiting for close");
      };

      ws.onclose = () => {
        if (pingInterval) clearInterval(pingInterval);
        pingInterval = null;
        if (!isMounted || closedByUs) return;
        console.log("[Activity WS] disconnected; reconnecting soon…");
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
  }, [builderKey, enabled]);
}
