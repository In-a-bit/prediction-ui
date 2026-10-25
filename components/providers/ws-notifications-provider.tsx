"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";

import { useSettings, type WsNotificationChannel } from "@/components/providers/settings-provider";
import { useActivityWs } from "@/lib/hooks/use-activity-ws";
import { usePushWs } from "@/lib/hooks/use-push-ws";
import { LP_SESSION_CHANGED_EVENT } from "@/lib/lp/direct-urls";
import {
  predictionGoActivityWsUrl,
  predictionGoEventsWsUrl,
  predictionGoMarketsWsUrl,
} from "@/lib/prediction-go";

const MAX_CACHED = 200;

/** High-frequency book ticks are not useful as pop-up notifications. */
const MARKET_EVENT_TYPES = new Set([
  "market_updated",
  "new_market",
  "market_resolved",
  "market_price_to_beat",
]);

const EVENT_EVENT_TYPES = new Set(["new_event", "event_updated"]);

export type WsNotification = {
  id: number;
  channel: WsNotificationChannel;
  eventType: string;
  receivedAt: number;
  data: unknown;
};

type WsNotificationsContextValue = {
  /** Streams currently selected in Settings. */
  channels: WsNotificationChannel[];
  /** Frames received since the popup was last opened. */
  unread: WsNotification[];
  /** Snapshot shown while the popup is open. Null when closed. */
  openItems: WsNotification[] | null;
  open: () => void;
  close: () => void;
};

const WsNotificationsContext = createContext<WsNotificationsContextValue | null>(null);

export function useWsNotifications(): WsNotificationsContextValue {
  const ctx = useContext(WsNotificationsContext);
  if (!ctx) {
    throw new Error("useWsNotifications must be used within WsNotificationsProvider");
  }
  return ctx;
}

function builderApiPublicKeyFromEnv(): string | null {
  const raw = process.env.NEXT_PUBLIC_BUILDER_API_PUBLIC_KEY?.trim();
  return raw || null;
}

function eventTypeOf(frame: Record<string, unknown>): string {
  return typeof frame.event_type === "string" ? frame.event_type : "unknown";
}

function payloadOf(frame: Record<string, unknown>): unknown {
  return "data" in frame ? frame.data : frame;
}

/**
 * Resolves the LP activity WebSocket URL from /api/lp/ws-urls while the activity
 * channel is on. Returns null when there is no LP session (401). Refetches when
 * the LP session connects or disconnects (LpDemoProviders fires the event),
 * since this provider sits above the LP providers and cannot read their context.
 */
function useLpActivityUrl(enabled: boolean): string | null {
  const [url, setUrl] = useState<string | null>(null);
  useEffect(() => {
    if (!enabled) {
      setUrl(null);
      return;
    }
    let active = true;
    const load = async () => {
      try {
        const res = await fetch("/api/lp/ws-urls");
        const activity = res.ok ? ((await res.json()) as { activity?: string }).activity : null;
        if (active) setUrl(activity ?? null);
      } catch {
        if (active) setUrl(null);
      }
    };
    void load();
    window.addEventListener(LP_SESSION_CHANGED_EVENT, load);
    return () => {
      active = false;
      window.removeEventListener(LP_SESSION_CHANGED_EVENT, load);
    };
  }, [enabled]);
  return url;
}

export function WsNotificationsProvider({ children }: { children: React.ReactNode }) {
  const { settings } = useSettings();
  const channels = settings.wsPopupNotifications;
  const builderKey = builderApiPublicKeyFromEnv();

  const [unread, setUnread] = useState<WsNotification[]>([]);
  const [openItems, setOpenItems] = useState<WsNotification[] | null>(null);
  const nextId = useRef(1);
  const openRef = useRef(false);
  useEffect(() => {
    openRef.current = openItems !== null;
  }, [openItems]);

  const push = useCallback((channel: WsNotificationChannel, frame: Record<string, unknown>) => {
    const item: WsNotification = {
      id: nextId.current++,
      channel,
      eventType: eventTypeOf(frame),
      receivedAt: Date.now(),
      data: payloadOf(frame),
    };
    if (openRef.current) {
      setOpenItems((prev) => (prev ? [...prev, item] : [item]));
      return;
    }
    setUnread((prev) => {
      const next = [...prev, item];
      return next.length > MAX_CACHED ? next.slice(next.length - MAX_CACHED) : next;
    });
  }, []);

  usePushWs({
    url: predictionGoMarketsWsUrl(),
    enabled: channels.includes("markets"),
    label: "[Markets WS]",
    onEvent: (frame) => {
      if (MARKET_EVENT_TYPES.has(eventTypeOf(frame))) push("markets", frame);
    },
  });

  usePushWs({
    url: predictionGoEventsWsUrl(),
    enabled: channels.includes("events"),
    label: "[Events WS]",
    onEvent: (frame) => {
      if (EVENT_EVENT_TYPES.has(eventTypeOf(frame))) push("events", frame);
    },
  });

  const activityEnabled = channels.includes("activity");
  const builderActivityUrl = builderKey ? predictionGoActivityWsUrl(builderKey) : null;
  const lpActivityUrl = useLpActivityUrl(activityEnabled);

  // Builder and LP streams share the "activity" channel; each frame carries its
  // own owner (builder key or LP id), so a user wearing both hats sees both.
  useActivityWs({
    url: builderActivityUrl,
    enabled: activityEnabled,
    onEvent: (event) => push("activity", event),
  });
  useActivityWs({
    url: lpActivityUrl,
    enabled: activityEnabled,
    onEvent: (event) => push("activity", event),
  });

  const open = useCallback(() => {
    setOpenItems(unread);
    setUnread([]);
  }, [unread]);

  const close = useCallback(() => {
    setOpenItems(null);
  }, []);

  const value = useMemo(
    () => ({ channels, unread, openItems, open, close }),
    [channels, unread, openItems, open, close],
  );

  return (
    <WsNotificationsContext.Provider value={value}>{children}</WsNotificationsContext.Provider>
  );
}
