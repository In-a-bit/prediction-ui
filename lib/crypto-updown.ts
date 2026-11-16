/**
 * Up/Down series helpers. Named after crypto, the first kind, they serve both
 * crypto_updown and finance_updown events: the slot fields are the same, only
 * the price feed (see UpdownPriceFeed) differs.
 */
import {
  FINANCE_CATEGORIES,
  type FinanceCategory,
  type GammaEvent,
  type UpdownMetadata,
  type UpdownPriceFeed,
} from "@/lib/types/event";
import { priceFeedAdapter } from "@/lib/updown-price-feed";

export type { UpdownMetadata, UpdownPriceFeed } from "@/lib/types/event";

export const CRYPTO_UPDOWN_METADATA_TYPE = "crypto_updown";
export const FINANCE_UPDOWN_METADATA_TYPE = "finance_updown";

function embeddedSeries(event: GammaEvent | null | undefined) {
  return event?.series?.[0];
}

/** Series title from event.series[0] on the events API payload (not a separate series fetch). */
export function cryptoUpdownDisplayTitle(
  ...events: (GammaEvent | null | undefined)[]
): string | undefined {
  for (const event of events) {
    const title = embeddedSeries(event)?.title?.trim();
    if (title) return title;
  }
  return undefined;
}

export function cryptoUpdownDisplayImage(
  ...events: (GammaEvent | null | undefined)[]
): string | undefined {
  for (const event of events) {
    const ref = embeddedSeries(event);
    const img = ref?.image ?? ref?.icon;
    if (img) return img;
  }
  return undefined;
}

export function parseUpdownMetadata(event: GammaEvent): UpdownMetadata | null {
  const m = parseMetadataRecord(event.metadata);
  if (!m) return null;
  const slotStart = Number(m.slot_start);
  const slotEnd = Number(m.slot_end);
  const intervalMinutes = Number(m.interval_minutes);
  if (
    !Number.isFinite(slotStart) ||
    !Number.isFinite(slotEnd) ||
    !Number.isFinite(intervalMinutes)
  ) {
    return null;
  }
  const feed = parsePriceFeed(event, m);
  if (!feed) return null;
  const priceToBeat = readPriceToBeatRaw(m);
  return {
    feed,
    interval_minutes: intervalMinutes,
    slot_start: slotStart,
    slot_end: slotEnd,
    ...(priceToBeat ? { priceToBeat } : {}),
  };
}

/** Finance events carry asset_key and category; crypto events base and target. */
function parsePriceFeed(
  event: GammaEvent,
  m: Record<string, unknown>,
): UpdownPriceFeed | null {
  const assetKey = String(m.asset_key ?? "").trim().toLowerCase();
  if (event.metadataType === FINANCE_UPDOWN_METADATA_TYPE || assetKey) {
    if (!assetKey) return null;
    return {
      kind: "finance",
      assetKey,
      category: parseFinanceCategory(m.category),
    };
  }
  return {
    kind: "crypto",
    base: String(m.base ?? ""),
    target: String(m.target ?? ""),
  };
}

function parseFinanceCategory(raw: unknown): FinanceCategory | null {
  const value = String(raw ?? "").trim().toLowerCase();
  return (FINANCE_CATEGORIES as readonly string[]).includes(value)
    ? (value as FinanceCategory)
    : null;
}

function readPriceToBeatRaw(m: Record<string, unknown>): string | null {
  const v = m.priceToBeat ?? m.price_to_beat;
  if (v == null || v === "") return null;
  return String(v);
}

function parseMetadataRecord(
  raw: GammaEvent["metadata"],
): Record<string, unknown> | null {
  if (!raw) return null;
  if (typeof raw === "string") {
    try {
      return JSON.parse(raw) as Record<string, unknown>;
    } catch {
      return null;
    }
  }
  if (typeof raw === "object") return raw as Record<string, unknown>;
  return null;
}

export function getCryptoPriceToBeat(
  event: GammaEvent,
  market?: { metadata?: Record<string, unknown> },
): string | null {
  const fromEvent = parseMetadataRecord(event.metadata);
  if (fromEvent) {
    const price = readPriceToBeatRaw(fromEvent);
    if (price) return price;
  }
  if (market?.metadata) {
    return readPriceToBeatRaw(market.metadata);
  }
  return null;
}

function formatTimeCompact(date: Date, withMeridiem: boolean): string {
  const formatted = date.toLocaleTimeString("en-US", {
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
    timeZone: SLOT_LABEL_TZ,
  });
  if (withMeridiem) return formatted.replace(/\s+/g, "");
  return formatted.replace(/\s?(AM|PM)$/i, "");
}

function meridiemForDate(date: Date): string {
  return (
    date
      .toLocaleTimeString("en-US", {
        hour: "numeric",
        hour12: true,
        timeZone: SLOT_LABEL_TZ,
      })
      .split(" ")[1] ?? ""
  );
}

/** e.g. "May 25, 10:20-10:25AM" (UTC, matching slot picker labels). */
export function formatCryptoSlotTimeRange(meta: UpdownMetadata): string {
  const start = new Date(meta.slot_start * 1000);
  const end = new Date(meta.slot_end * 1000);
  const datePart = start.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    timeZone: SLOT_LABEL_TZ,
  });
  const sameMeridiem = meridiemForDate(start) === meridiemForDate(end);
  const timeRange = sameMeridiem
    ? `${formatTimeCompact(start, false)}-${formatTimeCompact(end, true)}`
    : `${formatTimeCompact(start, true)}-${formatTimeCompact(end, true)}`;
  return `${datePart}, ${timeRange}`;
}

function fixedDecimals(n: number, decimals: number): string {
  return n.toLocaleString("en-US", {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  });
}

/** Quote currency of a finance asset key, e.g. "jpy" for "fx.usd/jpy". */
function financeQuote(assetKey: string): string {
  const slash = assetKey.lastIndexOf("/");
  return slash >= 0 ? assetKey.slice(slash + 1) : "";
}

/** FX decimals: 5, or 3 when the quote currency is JPY. */
function fxDecimals(assetKey: string): number {
  return financeQuote(assetKey) === "jpy" ? 3 : 5;
}

/**
 * Display format of a spot price (price to beat, current price, chart axis).
 * Crypto: "$" with 2 decimals for USD/USDT quotes. Finance: FX with 5
 * decimals (1.08523; USD/JPY 153.412); metals, commodities, stocks, indices "$" with 2.
 */
export function formatUpdownPrice(
  price: string,
  feed?: UpdownPriceFeed,
): string {
  const n = Number(price);
  if (!Number.isFinite(n)) return price;
  if (feed?.kind === "finance") {
    if (feed.category === "fx") return fixedDecimals(n, fxDecimals(feed.assetKey));
    return `$${fixedDecimals(n, 2)}`;
  }
  const quote = feed?.target.toLowerCase();
  if (quote === "usdt" || quote === "usd") {
    return `$${fixedDecimals(n, 2)}`;
  }
  if (n >= 1000) {
    return n.toLocaleString("en-US", { maximumFractionDigits: 2 });
  }
  if (n >= 1) {
    return n.toLocaleString("en-US", { maximumFractionDigits: 4 });
  }
  return n.toLocaleString("en-US", { maximumFractionDigits: 8 });
}

/** Absolute distance from the price to beat, e.g. "$12" (crypto), "0.00042" (FX). */
export function formatUpdownPriceDelta(
  absDelta: number,
  feed?: UpdownPriceFeed,
): string {
  if (feed?.kind === "finance") {
    return formatUpdownPrice(String(absDelta), feed);
  }
  return `$${absDelta.toLocaleString("en-US", {
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  })}`;
}

export function cryptoUpdownSlotHeader(
  event: GammaEvent,
  market?: { metadata?: Record<string, unknown> },
): { timeLabel: string | null; priceToBeatLabel: string } {
  const meta = parseUpdownMetadata(event);
  const timeLabel = meta ? formatCryptoSlotTimeRange(meta) : null;
  const rawPrice =
    meta?.priceToBeat ?? getCryptoPriceToBeat(event, market) ?? null;
  const priceToBeatLabel = rawPrice
    ? formatUpdownPrice(rawPrice, meta?.feed)
    : "-";
  return { timeLabel, priceToBeatLabel };
}

export function isLiveSlot(meta: UpdownMetadata, nowMs = Date.now()): boolean {
  const nowSec = nowMs / 1000;
  return meta.slot_start <= nowSec && nowSec < meta.slot_end;
}

export function findLiveEvent(
  events: GammaEvent[],
  nowMs = Date.now(),
): GammaEvent | null {
  for (const e of events) {
    const meta = parseUpdownMetadata(e);
    if (meta && isLiveSlot(meta, nowMs)) return e;
  }
  const nowSec = nowMs / 1000;
  const upcoming = events
    .map((e) => ({ e, meta: parseUpdownMetadata(e) }))
    .filter((x) => x.meta && x.meta.slot_end > nowSec)
    .sort((a, b) => (a.meta!.slot_start ?? 0) - (b.meta!.slot_start ?? 0));
  if (upcoming.length > 0) return upcoming[0].e;
  if (events.length === 0) return null;
  return events[events.length - 1];
}

export function getLiveEventSlug(
  events: GammaEvent[],
  nowMs = Date.now(),
): string | null {
  return findLiveEvent(events, nowMs)?.slug ?? null;
}

/** Slug of a slot whose window contains now — null when nothing is actively live. */
export function getActiveLiveEventSlug(
  events: GammaEvent[],
  nowMs = Date.now(),
): string | null {
  for (const e of events) {
    const meta = parseUpdownMetadata(e);
    if (meta && isLiveSlot(meta, nowMs)) return e.slug;
  }
  return null;
}

export interface ClosedHoursState {
  /** Start (unix seconds) of the next listed slot; null when none is listed yet. */
  nextSlotStartSec: number | null;
}

/**
 * Finance series trade in sessions, so between sessions no slot is live and the
 * next one may start hours or days later. Returns the closed state then; null
 * while a slot is live, and always for feeds whose slots run back to back (crypto).
 */
export function getClosedHoursState(
  events: GammaEvent[],
  nowMs = Date.now(),
): ClosedHoursState | null {
  const nowSec = nowMs / 1000;
  let hasClosedHours = false;
  let nextSlotStartSec: number | null = null;
  for (const e of events) {
    const meta = parseUpdownMetadata(e);
    if (!meta) continue;
    if (isLiveSlot(meta, nowMs)) return null;
    if (priceFeedAdapter(meta.feed).hasClosedHours) hasClosedHours = true;
    if (
      meta.slot_start > nowSec &&
      (nextSlotStartSec == null || meta.slot_start < nextSlotStartSec)
    ) {
      nextSlotStartSec = meta.slot_start;
    }
  }
  return hasClosedHours ? { nextSlotStartSec } : null;
}

/** e.g. "Nov 16, 11:00 PM UTC" — slots are labelled in UTC. */
export function formatNextMarketTime(slotStartUnix: number): string {
  const date = new Date(slotStartUnix * 1000);
  const day = date.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    timeZone: SLOT_LABEL_TZ,
  });
  return `${day}, ${formatSlotLabel(slotStartUnix)} UTC`;
}

const SLOT_LABEL_TZ = "UTC";

export function formatSlotLabel(slotEndUnix: number): string {
  return new Date(slotEndUnix * 1000).toLocaleTimeString("en-US", {
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
    timeZone: SLOT_LABEL_TZ,
  });
}

export function slotLabelForEvent(event: GammaEvent): string {
  const meta = parseUpdownMetadata(event);
  if (meta) return formatSlotLabel(meta.slot_end);
  if (event.endDate) {
    const d = new Date(event.endDate);
    if (!Number.isNaN(d.getTime())) {
      return d.toLocaleTimeString("en-US", {
        hour: "numeric",
        minute: "2-digit",
        hour12: true,
        timeZone: SLOT_LABEL_TZ,
      });
    }
  }
  return event.slug;
}

export function getLiveEventIndex(
  events: GammaEvent[],
  nowMs = Date.now(),
): number {
  const liveSlug = getLiveEventSlug(events, nowMs);
  if (liveSlug) {
    const idx = events.findIndex((e) => e.slug === liveSlug);
    if (idx >= 0) return idx;
  }
  const nowSec = nowMs / 1000;
  const idx = events.findIndex((e) => {
    const meta = parseUpdownMetadata(e);
    return meta && meta.slot_end > nowSec;
  });
  if (idx >= 0) return idx;
  return Math.max(0, events.length - 1);
}

export function isPastEvent(
  event: GammaEvent,
  events: GammaEvent[],
  nowMs = Date.now(),
): boolean {
  const liveIdx = getLiveEventIndex(events, nowMs);
  const idx = events.findIndex((e) => e.slug === event.slug);
  if (idx >= 0 && idx < liveIdx) return true;
  const meta = parseUpdownMetadata(event);
  if (meta) return meta.slot_end <= nowMs / 1000;
  return false;
}

/** Default bar: live on the left, then the next futures (up to 4). */
export function buildDefaultBarSlugs(
  events: GammaEvent[],
  maxVisible = 4,
  nowMs = Date.now(),
): string[] {
  if (events.length === 0) return [];
  const anchorIdx = getLiveEventIndex(events, nowMs);
  return events
    .slice(anchorIdx, anchorIdx + maxVisible)
    .map((e) => e.slug);
}

/** When picking a slot outside the bar, swap in past (before live) or future (replace last). */
export function adjustBarAfterSelect(
  events: GammaEvent[],
  barSlugs: string[],
  selectedSlug: string,
  maxVisible = 4,
  nowMs = Date.now(),
): string[] {
  if (barSlugs.includes(selectedSlug)) return barSlugs;

  const selected = events.find((e) => e.slug === selectedSlug);
  if (!selected) return barSlugs;

  const liveIdx = getLiveEventIndex(events, nowMs);
  const liveSlug = events[liveIdx]?.slug;
  if (!liveSlug) return barSlugs;

  if (isPastEvent(selected, events, nowMs)) {
    const slugs = [selectedSlug, liveSlug];
    for (let i = liveIdx + 1; i < events.length && slugs.length < maxVisible; i++) {
      slugs.push(events[i].slug);
    }
    return slugs.slice(0, maxVisible);
  }

  if (barSlugs.length < maxVisible) {
    return [...barSlugs, selectedSlug].slice(0, maxVisible);
  }
  return [...barSlugs.slice(0, maxVisible - 1), selectedSlug];
}

export function eventsToBarSlugs(
  events: GammaEvent[],
  barSlugs: string[],
): GammaEvent[] {
  return barSlugs
    .map((slug) => events.find((e) => e.slug === slug))
    .filter((e): e is GammaEvent => e != null);
}

/** All ended slots, newest first (for the Past dropdown). */
export function getPastEvents(
  events: GammaEvent[],
  nowMs = Date.now(),
): GammaEvent[] {
  const nowSec = nowMs / 1000;
  return events
    .filter((e) => {
      const meta = parseUpdownMetadata(e);
      if (meta) return meta.slot_end <= nowSec;
      if (e.endDate) {
        const endMs = Date.parse(e.endDate);
        if (!Number.isNaN(endMs)) return endMs / 1000 <= nowSec;
      }
      return false;
    })
    .reverse();
}

/** Off-bar upcoming slots (for the More dropdown on the right). */
export function getMoreEvents(
  events: GammaEvent[],
  barSlugs: string[],
  nowMs = Date.now(),
): GammaEvent[] {
  const inBar = new Set(barSlugs);
  const pastSlugs = new Set(getPastEvents(events, nowMs).map((e) => e.slug));
  return events.filter(
    (e) => !inBar.has(e.slug) && !pastSlugs.has(e.slug),
  );
}

export const PAST_SLOTS_IN_MORE = 48;

export function slotEndAfterForLookback(
  intervalMinutes: number,
  pastSlots = PAST_SLOTS_IN_MORE,
): Date {
  return new Date(Date.now() - intervalMinutes * pastSlots * 60 * 1000);
}

export type CryptoChartMode = "live" | "upcoming" | "past";

export function priceHistoryInterval(intervalMinutes: number): string {
  return intervalMinutes <= 15 ? "1m" : "5m";
}

/** Bucket width of a price-service history interval ("1m", "5m", …). */
export function priceHistoryBucketMs(interval: string): number {
  switch (interval) {
    case "1m":
      return 60_000;
    case "5m":
      return 5 * 60_000;
    case "15m":
      return 15 * 60_000;
    case "1h":
      return 60 * 60_000;
    case "4h":
      return 4 * 60 * 60_000;
    case "1d":
      return 24 * 60 * 60_000;
    default:
      return 60_000;
  }
}

/**
 * Longest step between two chart points still drawn as one line. Feeds with
 * closed hours have no candles for closed minutes, so a longer step is a
 * closure and the chart breaks the line there. Null (never break) for crypto.
 * Live charts load 1m buckets; past charts use priceHistoryInterval.
 */
export function chartGapThresholdMs(
  meta: UpdownMetadata,
  liveChart: boolean,
): number | null {
  if (!priceFeedAdapter(meta.feed).hasClosedHours) return null;
  const interval = liveChart ? "1m" : priceHistoryInterval(meta.interval_minutes);
  return priceHistoryBucketMs(interval) * 1.5;
}

export function isPastSlot(meta: UpdownMetadata, nowMs = Date.now()): boolean {
  return nowMs / 1000 >= meta.slot_end;
}

export function isUpcomingSlot(
  meta: UpdownMetadata,
  nowMs = Date.now(),
): boolean {
  return nowMs / 1000 < meta.slot_start;
}

export function cryptoChartMode(
  meta: UpdownMetadata,
  nowMs = Date.now(),
): CryptoChartMode {
  if (isPastSlot(meta, nowMs)) return "past";
  if (isUpcomingSlot(meta, nowMs)) return "upcoming";
  return "live";
}

export function isChartLiveMode(
  meta: UpdownMetadata,
  nowMs = Date.now(),
): boolean {
  const mode = cryptoChartMode(meta, nowMs);
  return mode === "live" || mode === "upcoming";
}

/** Upcoming slots have no spot history yet — show the current live slot chart instead. */
export function spotChartEvent(
  selected: GammaEvent,
  live: GammaEvent | null,
  nowMs = Date.now(),
): GammaEvent {
  const meta = parseUpdownMetadata(selected);
  if (meta && isUpcomingSlot(meta, nowMs) && live) {
    return live;
  }
  return selected;
}

/** Live chart fetch + viewport width — matches market interval (5m market → 5 minutes). */
export function liveChartWindowMs(meta: UpdownMetadata): number {
  return meta.interval_minutes * 60 * 1000;
}

export function priceHistoryWindow(
  meta: UpdownMetadata,
  nowMs = Date.now(),
): { openTimeMs: number; closeTimeMs: number } {
  const mode = cryptoChartMode(meta, nowMs);

  if (mode === "past") {
    return {
      openTimeMs: meta.slot_start * 1000,
      closeTimeMs: meta.slot_end * 1000,
    };
  }

  if (mode === "live") {
    return {
      openTimeMs: meta.slot_start * 1000,
      closeTimeMs: nowMs,
    };
  }

  const lookbackMs = meta.interval_minutes * 60 * 1000;
  return {
    openTimeMs: nowMs - lookbackMs,
    closeTimeMs: nowMs,
  };
}

export function countdownTargetSec(
  meta: UpdownMetadata,
  nowMs = Date.now(),
): number {
  return isUpcomingSlot(meta, nowMs) ? meta.slot_start : meta.slot_end;
}
