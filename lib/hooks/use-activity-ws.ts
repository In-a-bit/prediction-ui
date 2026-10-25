import { usePushWs } from "@/lib/hooks/use-push-ws";

/** A single order-activity frame as delivered over /ws/activity. */
export type ActivityEvent = {
  event_type: string;
  data: Record<string, unknown> & { timestamp?: number; status?: string; id?: string };
};

type UseActivityWsArgs = {
  /**
   * Full /ws/activity URL, already carrying the owner key (builder_api_key or
   * lp_api_key). When null, no connection is opened.
   */
  url: string | null;
  /** When false, no connection is opened. */
  enabled: boolean;
  /** Called for each parsed activity frame (PONG/keepalive frames are filtered). */
  onEvent: (event: ActivityEvent) => void;
};

/**
 * Subscribes to an owner-scoped activity WebSocket (/ws/activity). The caller
 * supplies the full URL, so the same hook serves the builder stream (via the
 * gateway) and the LP stream (direct to public-ws).
 */
export function useActivityWs({ url, enabled, onEvent }: UseActivityWsArgs): void {
  usePushWs({
    url,
    enabled: enabled && Boolean(url),
    label: "[Activity WS]",
    onEvent: (event) => {
      if (typeof event.event_type !== "string") return;
      onEvent(event as ActivityEvent);
    },
  });
}
