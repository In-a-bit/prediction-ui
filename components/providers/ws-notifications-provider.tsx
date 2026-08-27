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
import { predictionGoEventsWsUrl, predictionGoMarketsWsUrl } from "@/lib/prediction-go";

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

  useActivityWs({
    builderKey,
    enabled: channels.includes("activity"),
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
