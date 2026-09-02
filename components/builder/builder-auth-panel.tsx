"use client";

import { useState } from "react";

import { signIn, signUp } from "@/lib/builder/client";
import type { BuilderMode } from "@/lib/builder/types";

/**
 * The builder's own sign-up, with the builder's own passwords.
 *
 * Nothing here touches Plaee. A customer of the builder is a customer of the builder; the DPM
 * account behind them is minted later, on their first prediction-markets visit, and they never see
 * it. Submitting sets an httpOnly cookie on this app, so no token passes through this component.
 */
export function BuilderAuthPanel({
  mode,
  onSignedIn,
}: {
  mode: BuilderMode;
  onSignedIn: () => void;
}) {
  const [tab, setTab] = useState<"signin" | "signup">("signup");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    setBusy(true);
    setError(null);
    try {
      if (tab === "signup") {
        await signUp(mode, {
          email,
          password,
          ...(displayName.trim() ? { displayName: displayName.trim() } : {}),
        });
      } else {
        await signIn(mode, { email, password });
      }
      onSignedIn();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not sign you in");
    } finally {
      setBusy(false);
    }
  };

  return (
    <section className="rounded-lg border border-card-border bg-card p-6">
      <div className="mb-5 flex gap-1 rounded-md bg-input p-1 text-sm">
        {(["signup", "signin"] as const).map((value) => (
          <button
            key={value}
            type="button"
            onClick={() => {
              setTab(value);
              setError(null);
            }}
            className={`flex-1 rounded px-3 py-1.5 ${
              tab === value ? "bg-card font-medium" : "text-muted hover:text-foreground"
            }`}
          >
            {value === "signup" ? "Create account" : "Sign in"}
          </button>
        ))}
      </div>

      <form onSubmit={submit} className="space-y-3">
        {tab === "signup" && (
          <Field label="Name" value={displayName} onChange={setDisplayName} placeholder="Optional" />
        )}
        <Field
          label="Email"
          type="email"
          value={email}
          onChange={setEmail}
          placeholder="you@example.com"
          required
        />
        <Field
          label="Password"
          type="password"
          value={password}
          onChange={setPassword}
          placeholder="At least 8 characters"
          required
        />
        {error && <p className="text-xs text-red">{error}</p>}
        <button
          type="submit"
          disabled={busy}
          className="w-full rounded-md bg-brand px-4 py-2 text-sm font-medium text-white hover:bg-brand-hover disabled:opacity-60"
        >
          {busy ? "Working…" : tab === "signup" ? "Create account" : "Sign in"}
        </button>
      </form>
    </section>
  );
}

function Field({
  label,
  value,
  onChange,
  type = "text",
  placeholder,
  required,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  type?: string;
  placeholder?: string;
  required?: boolean;
}) {
  return (
    <label className="block">
      <span className="text-xs uppercase tracking-wide text-muted">{label}</span>
      <input
        type={type}
        value={value}
        required={required}
        placeholder={placeholder}
        onChange={(event) => onChange(event.target.value)}
        className="mt-1 w-full rounded-md border border-input-border bg-input px-3 py-2 text-sm outline-none focus:border-brand"
      />
    </label>
  );
}
