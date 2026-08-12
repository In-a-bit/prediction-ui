"use client";

import { useSettings, type Settings } from "@/components/providers/settings-provider";
import { cn } from "@/lib/utils";

interface ToggleRow {
  key: keyof Settings;
  title: string;
  description: string;
}

const TRADING_TOGGLES: ToggleRow[] = [
  {
    key: "showOrderRecipientInput",
    title: "Recipient address field",
    description:
      "Adds an optional field to the trade panel for sending an order's proceeds to another address — the outcome shares on a buy, the collateral on a sell. You still fund the order, pay the fee, and remain the only one who can cancel it.",
  },
];

function SettingToggle({
  row,
  checked,
  onChange,
}: {
  row: ToggleRow;
  checked: boolean;
  onChange: (next: boolean) => void;
}) {
  return (
    <label
      className={cn(
        "flex cursor-pointer items-start justify-between gap-4 rounded-xl border",
        "border-card-border px-4 py-4 transition-colors hover:border-foreground/20",
      )}
    >
      <span className="flex flex-col gap-1">
        <span className="text-sm font-medium text-foreground">{row.title}</span>
        <span className="text-xs leading-relaxed text-muted">{row.description}</span>
      </span>

      <span className="relative mt-0.5 shrink-0">
        <input
          type="checkbox"
          className="peer sr-only"
          checked={checked}
          onChange={(e) => onChange(e.target.checked)}
        />
        <span
          className={cn(
            "block h-6 w-10 rounded-full transition-colors",
            checked ? "bg-brand" : "bg-card-border",
          )}
        />
        <span
          className={cn(
            "absolute left-0.5 top-0.5 h-5 w-5 rounded-full bg-white shadow-sm transition-transform",
            checked && "translate-x-4",
          )}
        />
      </span>
    </label>
  );
}

export function SettingsClientPage() {
  const { settings, setSetting, resetSettings } = useSettings();

  return (
    <div className="mx-auto w-full max-w-3xl py-6">
      <header className="mb-6">
        <h1 className="text-2xl font-semibold text-foreground">Settings</h1>
        <p className="mt-1 text-sm text-muted">
          These preferences are stored in this browser only. They change what this
          interface shows you — they do not change your account or affect anyone else.
        </p>
      </header>

      <section aria-labelledby="trading-settings">
        <h2
          id="trading-settings"
          className="mb-3 text-xs font-semibold uppercase tracking-wide text-muted"
        >
          Trading
        </h2>
        <div className="flex flex-col gap-3">
          {TRADING_TOGGLES.map((row) => (
            <SettingToggle
              key={row.key}
              row={row}
              checked={settings[row.key]}
              onChange={(next) => setSetting(row.key, next)}
            />
          ))}
        </div>
      </section>

      <div className="mt-8 border-t border-card-border pt-4">
        <button
          type="button"
          onClick={resetSettings}
          className="rounded-lg border border-card-border px-3 py-1.5 text-xs font-medium text-muted transition-colors hover:border-foreground/20 hover:text-foreground"
        >
          Reset to defaults
        </button>
      </div>
    </div>
  );
}
