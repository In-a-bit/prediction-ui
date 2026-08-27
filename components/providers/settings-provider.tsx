"use client";

import { createContext, useCallback, useContext, useMemo, useSyncExternalStore } from "react";

import { siteConfig } from "@/lib/site-config";

/**
 * Viewer-controlled UI settings, persisted per browser.
 *
 * These are preferences, not platform configuration: they change what this
 * browser shows, never what the backend accepts. siteConfig supplies the shipped
 * defaults; anything stored here is an override on top of them.
 */
export const WS_NOTIFICATION_CHANNELS = ["markets", "events", "activity"] as const;

export type WsNotificationChannel = (typeof WS_NOTIFICATION_CHANNELS)[number];

export interface Settings {
  /** Show the recipient address field in the trade panel. */
  showOrderRecipientInput: boolean;
  /**
   * Public WebSocket streams that feed the header notification popup.
   * Empty means no connection and no icon.
   */
  wsPopupNotifications: WsNotificationChannel[];
}

const DEFAULT_SETTINGS: Settings = {
  showOrderRecipientInput: siteConfig.showOrderRecipientInput,
  wsPopupNotifications: [],
};

const STORAGE_KEY = "dpm.settings.v1";

function parseWsChannels(value: unknown): WsNotificationChannel[] | undefined {
  if (!Array.isArray(value)) return undefined;
  const allowed = new Set<string>(WS_NOTIFICATION_CHANNELS);
  const out: WsNotificationChannel[] = [];
  for (const item of value) {
    if (typeof item === "string" && allowed.has(item) && !out.includes(item as WsNotificationChannel)) {
      out.push(item as WsNotificationChannel);
    }
  }
  return out;
}

/** Ignores unknown or wrongly-typed keys so an old or hand-edited value cannot break the app. */
function parseStored(raw: string | null): Partial<Settings> {
  if (!raw) return {};
  try {
    const parsed: unknown = JSON.parse(raw);
    if (!parsed || typeof parsed !== "object") return {};
    const record = parsed as Record<string, unknown>;
    const out: Partial<Settings> = {};
    if (typeof record.showOrderRecipientInput === "boolean") {
      out.showOrderRecipientInput = record.showOrderRecipientInput;
    }
    const channels = parseWsChannels(record.wsPopupNotifications);
    if (channels) out.wsPopupNotifications = channels;
    return out;
  } catch {
    return {};
  }
}

// localStorage is read through useSyncExternalStore rather than an effect, so
// React drives the server/client handoff itself: the server snapshot renders
// during hydration and the stored values take over immediately after, with no
// setState-in-effect and no hydration mismatch.
//
// getSnapshot must return a referentially stable value or React re-renders
// forever, so the parsed object is cached and only rebuilt when the raw string
// actually changes.
let snapshot: Settings = DEFAULT_SETTINGS;
let snapshotRaw: string | null = null;
let snapshotValid = false;

const listeners = new Set<() => void>();

function getSnapshot(): Settings {
  let raw: string | null = null;
  try {
    raw = window.localStorage.getItem(STORAGE_KEY);
  } catch {
    // Storage can throw outright in some privacy modes; fall back to defaults.
    raw = null;
  }
  if (!snapshotValid || raw !== snapshotRaw) {
    snapshotRaw = raw;
    snapshot = { ...DEFAULT_SETTINGS, ...parseStored(raw) };
    snapshotValid = true;
  }
  return snapshot;
}

function getServerSnapshot(): Settings {
  return DEFAULT_SETTINGS;
}

function subscribe(onChange: () => void): () => void {
  listeners.add(onChange);
  // Keeps other tabs in step when the value changes elsewhere.
  window.addEventListener("storage", onChange);
  return () => {
    listeners.delete(onChange);
    window.removeEventListener("storage", onChange);
  };
}

function write(next: Settings) {
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
  } catch {
    // Private browsing or a full quota — the preference will not survive a
    // reload, which is not worth interrupting the user for. Still update the
    // in-memory snapshot so the current session reflects the choice.
  }
  snapshotValid = false;
  for (const listener of listeners) listener();
}

interface SettingsContextValue {
  settings: Settings;
  setSetting: <K extends keyof Settings>(key: K, value: Settings[K]) => void;
  resetSettings: () => void;
}

const SettingsContext = createContext<SettingsContextValue>({
  settings: DEFAULT_SETTINGS,
  setSetting: () => {},
  resetSettings: () => {},
});

export function SettingsProvider({ children }: { children: React.ReactNode }) {
  const settings = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);

  const setSetting = useCallback<SettingsContextValue["setSetting"]>((key, value) => {
    write({ ...getSnapshot(), [key]: value });
  }, []);

  const resetSettings = useCallback(() => write(DEFAULT_SETTINGS), []);

  const value = useMemo(
    () => ({ settings, setSetting, resetSettings }),
    [settings, setSetting, resetSettings],
  );

  return <SettingsContext.Provider value={value}>{children}</SettingsContext.Provider>;
}

export function useSettings(): SettingsContextValue {
  return useContext(SettingsContext);
}
