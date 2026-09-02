"use client";

import { useCallback, useEffect, useState } from "react";

import Link from "next/link";

import { PlaeeEmbed } from "@/components/builder/plaee-embed";
import { BuilderAuthPanel } from "@/components/builder/builder-auth-panel";
import { ModeBadge } from "@/components/builder/mode-badge";
import { MoneyPanel } from "@/components/builder/money-panel";
import { fetchProfile, fetchSiteConfig, openPredictionSession, signOut } from "@/lib/builder/client";
import type {
  BuilderMode,
  BuilderSiteConfig,
  CustomerProfile,
  PredictionSession,
  SiteBalances,
} from "@/lib/builder/types";

const MODE_COPY: Record<BuilderMode, { funds: string; note: string }> = {
  segregated: {
    funds: "Your own on-chain wallet",
    note: "Your USDC sits in a proxy wallet only you can spend from. The balance below is read off the chain.",
  },
  shared: {
    funds: "Held by the builder",
    note: "The builder holds the USDC and funds your trades from its operations wallet. The balance below is its ledger.",
  },
};

export function BuilderSite({ mode }: { mode: BuilderMode }) {
  const [config, setConfig] = useState<BuilderSiteConfig | null>(null);
  const [profile, setProfile] = useState<CustomerProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [unreachable, setUnreachable] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const [siteConfig, customer] = await Promise.all([fetchSiteConfig(mode), fetchProfile(mode)]);
      setConfig(siteConfig);
      setProfile(customer);
      setUnreachable(null);
    } catch (err) {
      setUnreachable(err instanceof Error ? err.message : "The builder's site is not reachable");
    } finally {
      setLoading(false);
    }
  }, [mode]);

  useEffect(() => {
    void load();
  }, [load]);

  if (loading) return <Panel>Loading…</Panel>;
  if (unreachable) {
    return (
      <Panel>
        <p className="font-medium text-red">{unreachable}</p>
        <p className="mt-1 text-xs text-muted">
          Start the {mode} operator, then reload. It is the builder&apos;s own backend — Plaee is
          reachable independently of it.
        </p>
      </Panel>
    );
  }

  const name = config?.builderName ?? "This builder";

  if (!profile) {
    return (
      <div className="grid gap-4 lg:grid-cols-[1.1fr_1fr]">
        <Welcome mode={mode} name={name} />
        <BuilderAuthPanel mode={mode} onSignedIn={load} />
      </div>
    );
  }

  return <SignedIn mode={mode} name={name} profile={profile} onSignedOut={load} />;
}

function Welcome({ mode, name }: { mode: BuilderMode; name: string }) {
  const copy = MODE_COPY[mode];
  return (
    <section className="rounded-lg border border-card-border bg-card p-6">
      <ModeBadge mode={mode} />
      <h1 className="mt-2 text-2xl font-semibold">Welcome to {name}</h1>
      <p className="mt-3 text-sm leading-relaxed">
        {name} is a custody business. Create an account and it will hold your funds, run your
        wallet, and — through Plaee — let you trade prediction markets without leaving the site.
      </p>
      <dl className="mt-5 space-y-3 text-sm">
        <div>
          <dt className="text-xs uppercase tracking-wide text-muted">Who holds the money</dt>
          <dd>{copy.funds}</dd>
        </div>
        <div>
          <dt className="text-xs uppercase tracking-wide text-muted">What that means</dt>
          <dd className="text-muted">{copy.note}</dd>
        </div>
      </dl>
      <p className="mt-5 border-t border-card-border pt-4 text-xs text-muted">
        {name} never sees a DPM credential. It calls Plaee with its own key, and Plaee talks to the
        exchange.
      </p>
    </section>
  );
}

function SignedIn({
  mode,
  name,
  profile,
  onSignedOut,
}: {
  mode: BuilderMode;
  name: string;
  profile: CustomerProfile;
  onSignedOut: () => void;
}) {
  const [session, setSession] = useState<PredictionSession | null>(null);
  const [opening, setOpening] = useState(false);
  const [error, setError] = useState<string | null>(null);
  // Held here rather than re-fetched: every money action answers with the balances it produced, so
  // trusting that answer avoids a round trip that could show a figure older than the one just
  // returned.
  const [balances, setBalances] = useState<SiteBalances>(profile.balances);

  /**
   * Provisioning is not instant — the first request mints a wallet and submits two transactions —
   * so this polls rather than failing. The effect only runs while the answer is `provisioning`,
   * which is what stops it once the iframe URL arrives.
   */
  useEffect(() => {
    if (session?.state !== "provisioning") return;
    const timer = setTimeout(() => {
      void openPredictionSession(mode).then(setSession, (err: Error) => setError(err.message));
    }, 3000);
    return () => clearTimeout(timer);
  }, [session, mode]);

  const open = async () => {
    setOpening(true);
    setError(null);
    try {
      setSession(await openPredictionSession(mode));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not open prediction markets");
    } finally {
      setOpening(false);
    }
  };

  const logout = async () => {
    await signOut(mode);
    onSignedOut();
  };

  return (
    <div className="space-y-4">
      <section className="flex flex-wrap items-center justify-between gap-4 rounded-lg border border-card-border bg-card px-5 py-4">
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-[11px] uppercase tracking-wide text-muted">{name}</span>
            <ModeBadge mode={mode} />
          </div>
          <h1 className="mt-1 text-lg font-semibold">{profile.displayName ?? profile.email}</h1>
          <p className="text-xs text-muted">{MODE_COPY[mode].funds}</p>
        </div>
        <div className="flex items-center gap-2">
          <Link
            href={`/builder/${mode}/manage`}
            className="rounded-md border border-card-border px-3 py-1.5 text-xs hover:bg-card-hover"
          >
            Back office
          </Link>
          <button
            type="button"
            onClick={logout}
            className="rounded-md border border-card-border px-3 py-1.5 text-xs hover:bg-card-hover"
          >
            Sign out
          </button>
        </div>
      </section>

      <MoneyPanel mode={mode} balances={balances} onChanged={setBalances} />

      {session?.state === "ready" ? (
        <PlaeeEmbed key={session.iframeUrl} src={session.iframeUrl} />
      ) : (
        <section className="rounded-lg border border-card-border bg-card p-6 text-center">
          <h2 className="text-base font-semibold">Prediction markets</h2>
          <p className="mx-auto mt-2 max-w-md text-sm text-muted">
            Trade real markets without leaving {name}. Your first visit sets up a wallet for you,
            which takes a moment.
          </p>
          <button
            type="button"
            onClick={open}
            disabled={opening || session?.state === "provisioning"}
            className="mt-4 rounded-md bg-brand px-5 py-2 text-sm font-medium text-white hover:bg-brand-hover disabled:opacity-60"
          >
            {session?.state === "provisioning" ? "Setting up…" : "Predictions"}
          </button>
          {session?.state === "provisioning" && (
            <p className="mt-3 text-xs text-muted">{session.detail}</p>
          )}
          {session?.state === "failed" && (
            <p className="mt-3 text-xs text-red">{session.detail}</p>
          )}
          {session?.state === "unavailable" && (
            <p className="mt-3 text-xs text-muted">{session.detail}</p>
          )}
          {error && <p className="mt-3 text-xs text-red">{error}</p>}
        </section>
      )}
    </div>
  );
}

function Panel({ children }: { children: React.ReactNode }) {
  return (
    <div className="rounded-lg border border-card-border bg-card p-6 text-sm">{children}</div>
  );
}
