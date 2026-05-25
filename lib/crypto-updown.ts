import type { CryptoUpdownMetadata, GammaEvent } from "@/lib/types/event";

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

export function parseCryptoMetadata(
  event: GammaEvent,
): CryptoUpdownMetadata | null {
  let raw = event.metadata;
  if (!raw) return null;
  if (typeof raw === "string") {
    try {
      raw = JSON.parse(raw) as Record<string, unknown>;
    } catch {
      return null;
    }
  }
  if (typeof raw !== "object") return null;
  const m = raw as Record<string, unknown>;
  if (
    typeof m.slot_start !== "number" ||
    typeof m.slot_end !== "number" ||
    typeof m.interval_minutes !== "number"
  ) {
    return null;
  }
  return {
    base: String(m.base ?? ""),
    target: String(m.target ?? ""),
    interval_minutes: Number(m.interval_minutes),
    slot_start: Number(m.slot_start),
    slot_end: Number(m.slot_end),
  };
}

export function isLiveSlot(meta: CryptoUpdownMetadata, nowMs = Date.now()): boolean {
  const nowSec = nowMs / 1000;
  return meta.slot_start <= nowSec && nowSec < meta.slot_end;
}

export function findLiveEvent(
  events: GammaEvent[],
  nowMs = Date.now(),
): GammaEvent | null {
  for (const e of events) {
    const meta = parseCryptoMetadata(e);
    if (meta && isLiveSlot(meta, nowMs)) return e;
  }
  const nowSec = nowMs / 1000;
  const upcoming = events
    .map((e) => ({ e, meta: parseCryptoMetadata(e) }))
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
  const meta = parseCryptoMetadata(event);
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
    const meta = parseCryptoMetadata(e);
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
  const meta = parseCryptoMetadata(event);
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
      const meta = parseCryptoMetadata(e);
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
