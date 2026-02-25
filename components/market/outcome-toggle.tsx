"use client";

import { cn } from "@/lib/utils";

export function OutcomeToggle({
  selected,
  onSelect,
  yesPrice,
  noPrice,
}: {
  selected: "yes" | "no";
  onSelect: (outcome: "yes" | "no") => void;
  yesPrice: number;
  noPrice: number;
}) {
  return (
    <div className="flex gap-2">
      <button
        onClick={() => onSelect("yes")}
        className={cn(
          "flex flex-1 items-center justify-between rounded-xl border-2 px-4 py-3 transition-all",
          selected === "yes"
            ? "border-green bg-green-dim"
            : "border-card-border bg-card hover:border-green/30"
        )}
      >
        <span
          className={cn(
            "text-sm font-semibold",
            selected === "yes" ? "text-green" : "text-muted"
          )}
        >
          Yes
        </span>
        <span
          className={cn(
            "text-lg font-bold",
            selected === "yes" ? "text-green" : "text-muted"
          )}
        >
          {yesPrice}¢
        </span>
      </button>
      <button
        onClick={() => onSelect("no")}
        className={cn(
          "flex flex-1 items-center justify-between rounded-xl border-2 px-4 py-3 transition-all",
          selected === "no"
            ? "border-red bg-red-dim"
            : "border-card-border bg-card hover:border-red/30"
        )}
      >
        <span
          className={cn(
            "text-sm font-semibold",
            selected === "no" ? "text-red" : "text-muted"
          )}
        >
          No
        </span>
        <span
          className={cn(
            "text-lg font-bold",
            selected === "no" ? "text-red" : "text-muted"
          )}
        >
          {noPrice}¢
        </span>
      </button>
    </div>
  );
}
