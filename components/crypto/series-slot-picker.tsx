"use client";

import { useEffect, useRef, useState } from "react";

import {
  eventsToBarSlugs,
  getActiveLiveEventSlug,
  getMoreEvents,
  getPastEvents,
  slotLabelForEvent,
} from "@/lib/crypto-updown";
import type { GammaEvent } from "@/lib/types/event";

export type SlotSelectSource = "past" | "more" | "bar";

interface SeriesSlotPickerProps {
  events: GammaEvent[];
  barSlugs: string[];
  selectedSlug: string;
  onSelect: (slug: string, source: SlotSelectSource) => void;
}

function SlotDropdown({
  label,
  items,
  selectedSlug,
  liveSlug,
  onSelect,
  align,
  emptyMessage,
  selectSource,
  disabled = false,
}: {
  label: string;
  items: GammaEvent[];
  selectedSlug: string;
  liveSlug: string | null;
  onSelect: (slug: string, source: SlotSelectSource) => void;
  align: "left" | "right";
  emptyMessage: string;
  selectSource: SlotSelectSource;
  disabled?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    function handleClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, [open]);

  useEffect(() => {
    if (disabled) setOpen(false);
  }, [disabled]);

  const selectedInList = items.some((e) => e.slug === selectedSlug);

  return (
    <div className="relative z-50 shrink-0" ref={ref}>
      <button
        type="button"
        disabled={disabled}
        onClick={(e) => {
          e.stopPropagation();
          if (disabled) return;
          setOpen((o) => !o);
        }}
        className={`flex items-center gap-1 rounded-full px-4 py-2 text-sm font-semibold transition-colors disabled:cursor-not-allowed disabled:opacity-40 ${
          disabled
            ? "bg-neutral-800 text-white"
            : selectedInList
              ? "cursor-pointer bg-neutral-200 text-neutral-900"
              : "cursor-pointer bg-neutral-800 text-white hover:bg-neutral-700"
        }`}
        aria-expanded={open}
        aria-haspopup="listbox"
        aria-disabled={disabled}
      >
        {label}
        <span className="text-xs opacity-70" aria-hidden>
          ▾
        </span>
      </button>

      {open && !disabled && (
        <ul
          className={`absolute top-full z-50 mt-2 max-h-64 min-w-[10rem] overflow-y-auto rounded-xl border border-card-border bg-card py-1 shadow-lg ${
            align === "left" ? "left-0" : "right-0"
          }`}
          role="listbox"
        >
          {items.length === 0 ? (
            <li className="px-4 py-2 text-sm text-muted">{emptyMessage}</li>
          ) : null}
          {items.map((event) => {
            const isSelected = event.slug === selectedSlug;
            const isLive = event.slug === liveSlug;
            return (
              <li key={event.slug} role="option" aria-selected={isSelected}>
                <button
                  type="button"
                  onClick={() => {
                    onSelect(event.slug, selectSource);
                    setOpen(false);
                  }}
                  className={`flex w-full items-center gap-2 px-4 py-2 text-left text-sm hover:bg-card-hover ${
                    isSelected ? "font-semibold text-brand" : "text-foreground"
                  }`}
                >
                  {isLive && (
                    <span
                      className="h-2 w-2 shrink-0 animate-pulse rounded-full bg-green-500"
                      aria-hidden
                    />
                  )}
                  {slotLabelForEvent(event)}
                </button>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}

export function SeriesSlotPicker({
  events,
  barSlugs,
  selectedSlug,
  onSelect,
}: SeriesSlotPickerProps) {
  const [nowMs, setNowMs] = useState(0);

  useEffect(() => {
    const id = setInterval(() => setNowMs(Date.now()), 1000);
    return () => clearInterval(id);
  }, []);

  const liveSlug = getActiveLiveEventSlug(events, nowMs || undefined);
  const pastEvents = getPastEvents(events, nowMs || undefined);
  const moreEvents = getMoreEvents(events, barSlugs, nowMs || undefined);
  const visible = eventsToBarSlugs(events, barSlugs);
  const selectedPast = pastEvents.find((e) => e.slug === selectedSlug);
  const selectedMore = moreEvents.find((e) => e.slug === selectedSlug);

  function renderCapsule(event: GammaEvent) {
    const isSelected = event.slug === selectedSlug;
    const isLive = event.slug === liveSlug;

    return (
      <button
        key={event.slug}
        type="button"
        onClick={() => onSelect(event.slug, "bar")}
        className={`flex shrink-0 items-center gap-2 rounded-full px-4 py-2 text-sm font-semibold transition-colors ${
          isSelected
            ? "bg-neutral-200 text-neutral-900"
            : "bg-neutral-800 text-white hover:bg-neutral-700"
        }`}
      >
        {isLive && (
          <span
            className="h-2 w-2 shrink-0 animate-pulse rounded-full bg-green-500"
            aria-hidden
          />
        )}
        {slotLabelForEvent(event)}
      </button>
    );
  }

  return (
    <div className="inline-flex max-w-full flex-wrap items-center gap-2">
      <SlotDropdown
        label={selectedPast ? slotLabelForEvent(selectedPast) : "Past"}
        items={pastEvents}
        selectedSlug={selectedSlug}
        liveSlug={liveSlug}
        onSelect={onSelect}
        align="left"
        emptyMessage="No past events"
        selectSource="past"
      />

      <div className="inline-flex max-w-full items-center gap-2 overflow-x-auto pb-1">
        {visible.map(renderCapsule)}
      </div>

      <SlotDropdown
        label={selectedMore ? slotLabelForEvent(selectedMore) : "More"}
        items={moreEvents}
        selectedSlug={selectedSlug}
        liveSlug={liveSlug}
        onSelect={onSelect}
        align="right"
        emptyMessage="No more events"
        selectSource="more"
        disabled={moreEvents.length === 0}
      />
    </div>
  );
}
