"use client";

import { useEffect, useMemo, useRef, useState } from "react";

export type DestinationOption = {
  key: string;
  label: string;
  /** Extra text matched by the search, e.g. the asset and chain name. */
  keywords: string;
};

type DestinationSelectProps = {
  id: string;
  options: DestinationOption[];
  value: string;
  onChange: (key: string) => void;
  disabled?: boolean;
};

/** A select whose options can be filtered by asset or blockchain. */
export function DestinationSelect({ id, options, value, onChange, disabled }: DestinationSelectProps) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [active, setActive] = useState(0);
  const rootRef = useRef<HTMLDivElement>(null);
  const listRef = useRef<HTMLUListElement>(null);

  const selected = options.find((o) => o.key === value) ?? options[0];

  const filtered = useMemo(() => {
    const words = query.toLowerCase().split(/\s+/).filter(Boolean);
    if (words.length === 0) return options;
    return options.filter((o) => {
      const text = `${o.label} ${o.keywords}`.toLowerCase();
      return words.every((w) => text.includes(w));
    });
  }, [options, query]);

  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      if (!rootRef.current?.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", onDown);
    return () => document.removeEventListener("mousedown", onDown);
  }, [open]);

  useEffect(() => {
    listRef.current?.children[active]?.scrollIntoView({ block: "nearest" });
  }, [active]);

  function openList() {
    if (disabled) return;
    setQuery("");
    setActive(Math.max(0, options.findIndex((o) => o.key === value)));
    setOpen(true);
  }

  function pick(key: string) {
    onChange(key);
    setOpen(false);
  }

  function onKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setActive((i) => Math.min(i + 1, filtered.length - 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setActive((i) => Math.max(i - 1, 0));
    } else if (e.key === "Enter") {
      e.preventDefault();
      const option = filtered[active];
      if (option) pick(option.key);
    } else if (e.key === "Escape") {
      // Close the list only, not the whole modal.
      e.stopPropagation();
      setOpen(false);
    }
  }

  return (
    <div ref={rootRef} className="relative">
      {open ? (
        <input
          id={id}
          autoFocus
          type="text"
          value={query}
          onChange={(e) => {
            setQuery(e.target.value);
            setActive(0);
          }}
          onKeyDown={onKeyDown}
          placeholder="Search asset or blockchain"
          autoComplete="off"
          role="combobox"
          aria-expanded="true"
          aria-controls={`${id}-list`}
          className="w-full rounded-xl border border-brand bg-input px-3 py-2.5 text-sm text-foreground placeholder:text-muted/50 focus:outline-none"
        />
      ) : (
        <button
          id={id}
          type="button"
          onClick={openList}
          disabled={disabled}
          aria-haspopup="listbox"
          className="flex w-full items-center justify-between rounded-xl border border-card-border bg-input px-3 py-2.5 text-left text-sm text-foreground focus:border-brand focus:outline-none disabled:opacity-40"
        >
          <span className="truncate">{selected?.label}</span>
          <span aria-hidden className="ml-2 text-muted">▾</span>
        </button>
      )}

      {open && (
        <ul
          id={`${id}-list`}
          ref={listRef}
          role="listbox"
          className="absolute z-10 mt-1 max-h-60 w-full overflow-y-auto rounded-xl border border-card-border bg-card py-1 shadow-lg"
        >
          {filtered.length === 0 ? (
            <li className="px-3 py-2 text-sm text-muted">No matches</li>
          ) : (
            filtered.map((o, i) => (
              <li
                key={o.key}
                role="option"
                aria-selected={o.key === value}
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => pick(o.key)}
                onMouseEnter={() => setActive(i)}
                className={`cursor-pointer px-3 py-2 text-sm ${
                  i === active ? "bg-brand/10 text-foreground" : "text-foreground"
                } ${o.key === value ? "font-semibold" : ""}`}
              >
                {o.label}
              </li>
            ))
          )}
        </ul>
      )}
    </div>
  );
}
