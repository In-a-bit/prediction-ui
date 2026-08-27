import { predictionGoActivityWsUrl } from "@/lib/prediction-go";
import { usePushWs } from "@/lib/hooks/use-push-ws";

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

/**
 * Subscribes to the builder-scoped activity WebSocket (/ws/activity via the
 * gateway). The gateway injects APP_API_KEY; this hook only sends the builder
 * publishable key as a query parameter.
 */
export function useActivityWs({ builderKey, enabled, onEvent }: UseActivityWsArgs): void {
  const url = builderKey ? predictionGoActivityWsUrl(builderKey) : null;
  usePushWs({
    url,
    enabled: enabled && Boolean(builderKey),
    label: "[Activity WS]",
    onEvent: (event) => {
      if (typeof event.event_type !== "string") return;
      onEvent(event as ActivityEvent);
    },
  });
}
